/**
 * Event Bus Service - Global communication layer for JasonJS Framework
 *
 * Enables component-to-component communication across different contexts,
 * including sandboxed components and regular React components.
 *
 * Features:
 * - Channel-based messaging with wildcard support
 * - Memory management with automatic cleanup
 * - Event replay for late subscribers
 * - Debug mode for development
 * - Resource limits to prevent memory leaks
 *
 * Usage:
 * eventBus.emit('user.login', { userId: 123, name: 'John' });
 * eventBus.on('user.*', (data, channel) => console.log(channel, data));
 * eventBus.off('user.login', myHandler);
 * eventBus.once('cart.checkout', handler);
 * eventBus.clear('user.*');
 */

class EventBus {
  constructor() {
    // Map of channel patterns to arrays of listeners
    this.listeners = new Map();

    // Map of exact channel names to last emitted data (for replay)
    this.lastEvents = new Map();

    // Configuration
    this.config = {
      maxListeners: 100, // Maximum listeners per channel
      maxChannels: 1000, // Maximum total channels
      maxLastEvents: 500, // Maximum stored last events
      debug: false, // Debug logging
      enableReplay: true // Enable last event replay
    };

    // Stats for monitoring
    this.stats = {
      totalEmits: 0,
      totalListeners: 0,
      channelsCount: 0
    };
  }

  /**
   * Emit data to a channel
   * @param {string} channel - Channel name (e.g., 'user.login', 'cart.update')
   * @param {any} data - Data to emit
   * @param {Object} options - Emit options
   */
  emit(channel, data, options = {}) {
    if (typeof channel !== 'string' || !channel.trim()) {
      throw new Error('Channel name must be a non-empty string');
    }

    this.stats.totalEmits++;

    if (this.config.debug) {
      console.log(`[EventBus] Emitting to channel "${channel}":`, data);
    }

    // Store last event for replay if enabled
    if (this.config.enableReplay) {
      this._storeLastEvent(channel, data);
    }

    // Find all matching listeners (exact match + wildcards)
    const matchingListeners = this._getMatchingListeners(channel);

    let handlerCount = 0;

    // Execute all matching listeners
    matchingListeners.forEach(({ listeners, pattern }) => {
      listeners.forEach(({ callback, once }) => {
        try {
          // Call with data and channel name for wildcard patterns
          if (pattern.includes('*')) {
            callback(data, channel);
          } else {
            callback(data);
          }
          handlerCount++;

          // Remove one-time listeners
          if (once) {
            this._removeListener(pattern, callback);
          }
        } catch (error) {
          console.error(`[EventBus] Error in listener for channel "${channel}":`, error);
        }
      });
    });

    if (this.config.debug && handlerCount === 0) {
      console.warn(`[EventBus] No listeners found for channel "${channel}"`);
    }

    return handlerCount;
  }

  /**
   * Subscribe to a channel
   * @param {string} channelPattern - Channel pattern (supports wildcards: 'user.*')
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   */
  on(channelPattern, callback, options = {}) {
    if (typeof channelPattern !== 'string' || !channelPattern.trim()) {
      throw new Error('Channel pattern must be a non-empty string');
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const { replay = false } = options;

    // Check resource limits
    if (this.listeners.size >= this.config.maxChannels) {
      throw new Error(`Maximum number of channels (${this.config.maxChannels}) exceeded`);
    }

    // Add listener
    if (!this.listeners.has(channelPattern)) {
      this.listeners.set(channelPattern, []);
      this.stats.channelsCount++;
    }

    const channelListeners = this.listeners.get(channelPattern);

    if (channelListeners.length >= this.config.maxListeners) {
      throw new Error(`Maximum number of listeners (${this.config.maxListeners}) for channel "${channelPattern}" exceeded`);
    }

    channelListeners.push({ callback, once: false });
    this.stats.totalListeners++;

    if (this.config.debug) {
      console.log(`[EventBus] Added listener to channel "${channelPattern}"`);
    }

    // Replay last event if requested and available
    if (replay && this.config.enableReplay && !channelPattern.includes('*')) {
      const lastEvent = this.lastEvents.get(channelPattern);
      if (lastEvent) {
        try {
          callback(lastEvent.data);
        } catch (error) {
          console.error(`[EventBus] Error in replay for channel "${channelPattern}":`, error);
        }
      }
    }

    // Return unsubscribe function
    return () => this.off(channelPattern, callback);
  }

  /**
   * Subscribe to a channel (one-time only)
   * @param {string} channelPattern - Channel pattern
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   */
  once(channelPattern, callback, options = {}) {
    if (typeof channelPattern !== 'string' || !channelPattern.trim()) {
      throw new Error('Channel pattern must be a non-empty string');
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Check resource limits
    if (this.listeners.size >= this.config.maxChannels) {
      throw new Error(`Maximum number of channels (${this.config.maxChannels}) exceeded`);
    }

    // Add one-time listener
    if (!this.listeners.has(channelPattern)) {
      this.listeners.set(channelPattern, []);
      this.stats.channelsCount++;
    }

    const channelListeners = this.listeners.get(channelPattern);

    if (channelListeners.length >= this.config.maxListeners) {
      throw new Error(`Maximum number of listeners (${this.config.maxListeners}) for channel "${channelPattern}" exceeded`);
    }

    channelListeners.push({ callback, once: true });
    this.stats.totalListeners++;

    if (this.config.debug) {
      console.log(`[EventBus] Added one-time listener to channel "${channelPattern}"`);
    }

    // Return unsubscribe function
    return () => this.off(channelPattern, callback);
  }

  /**
   * Unsubscribe from a channel
   * @param {string} channelPattern - Channel pattern
   * @param {Function} callback - Callback function to remove
   */
  off(channelPattern, callback) {
    if (!this.listeners.has(channelPattern)) {
      return false;
    }

    return this._removeListener(channelPattern, callback);
  }

  /**
   * Clear all listeners for a channel pattern
   * @param {string} channelPattern - Channel pattern (optional, clears all if not provided)
   */
  clear(channelPattern) {
    if (channelPattern) {
      // Clear specific channel pattern
      if (this.listeners.has(channelPattern)) {
        const listeners = this.listeners.get(channelPattern);
        this.stats.totalListeners -= listeners.length;
        this.listeners.delete(channelPattern);
        this.stats.channelsCount--;

        if (this.config.debug) {
          console.log(`[EventBus] Cleared ${listeners.length} listeners from channel "${channelPattern}"`);
        }
        return true;
      }
      return false;
    } else {
      // Clear all channels
      const totalListeners = this.stats.totalListeners;
      this.listeners.clear();
      this.lastEvents.clear();
      this.stats.totalListeners = 0;
      this.stats.channelsCount = 0;

      if (this.config.debug) {
        console.log(`[EventBus] Cleared all ${totalListeners} listeners from all channels`);
      }
      return true;
    }
  }

  /**
   * Get the last emitted data for a channel
   * @param {string} channel - Exact channel name
   * @returns {any|null} Last emitted data or null
   */
  getLastEvent(channel) {
    if (!this.config.enableReplay) {
      return null;
    }

    const lastEvent = this.lastEvents.get(channel);
    return lastEvent ? lastEvent.data : null;
  }

  /**
   * Get list of active channels
   * @returns {Array<string>} Array of channel patterns
   */
  getChannels() {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get statistics
   * @returns {Object} EventBus statistics
   */
  getStats() {
    return {
      ...this.stats,
      lastEventsCount: this.lastEvents.size,
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Configure the event bus
   * @param {Object} newConfig - Configuration options
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Clean up if limits were reduced
    this._enforceResourceLimits();
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Debug enabled
   */
  setDebug(enabled) {
    this.config.debug = !!enabled;
    if (enabled) {
      console.log('[EventBus] Debug mode enabled');
    }
  }

  // Private methods

  /**
   * Store last event for replay functionality
   * @private
   */
  _storeLastEvent(channel, data) {
    // Don't store for wildcard patterns
    if (channel.includes('*')) {
      return;
    }

    this.lastEvents.set(channel, {
      data,
      timestamp: Date.now()
    });

    // Enforce max last events limit
    if (this.lastEvents.size > this.config.maxLastEvents) {
      // Remove oldest entries
      const entries = Array.from(this.lastEvents.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - this.config.maxLastEvents);
      toRemove.forEach(([channel]) => this.lastEvents.delete(channel));
    }
  }

  /**
   * Get all listeners matching a channel
   * @private
   */
  _getMatchingListeners(channel) {
    const matches = [];

    for (const [pattern, listeners] of this.listeners.entries()) {
      if (this._matchesPattern(channel, pattern)) {
        matches.push({ pattern, listeners });
      }
    }

    return matches;
  }

  /**
   * Check if a channel matches a pattern
   * @private
   */
  _matchesPattern(channel, pattern) {
    // Exact match
    if (channel === pattern) {
      return true;
    }

    // Wildcard pattern
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(channel);
    }

    return false;
  }

  /**
   * Remove a specific listener
   * @private
   */
  _removeListener(channelPattern, callback) {
    const channelListeners = this.listeners.get(channelPattern);
    if (!channelListeners) {
      return false;
    }

    const index = channelListeners.findIndex(listener => listener.callback === callback);
    if (index !== -1) {
      channelListeners.splice(index, 1);
      this.stats.totalListeners--;

      // Remove channel if no more listeners
      if (channelListeners.length === 0) {
        this.listeners.delete(channelPattern);
        this.stats.channelsCount--;
      }

      if (this.config.debug) {
        console.log(`[EventBus] Removed listener from channel "${channelPattern}"`);
      }
      return true;
    }

    return false;
  }

  /**
   * Enforce resource limits
   * @private
   */
  _enforceResourceLimits() {
    // Limit total channels
    if (this.listeners.size > this.config.maxChannels) {
      const entries = Array.from(this.listeners.entries());
      const toRemove = entries.slice(this.config.maxChannels);
      toRemove.forEach(([pattern]) => {
        const listeners = this.listeners.get(pattern);
        this.stats.totalListeners -= listeners.length;
        this.listeners.delete(pattern);
        this.stats.channelsCount--;
      });
    }

    // Limit last events
    if (this.lastEvents.size > this.config.maxLastEvents) {
      const entries = Array.from(this.lastEvents.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - this.config.maxLastEvents);
      toRemove.forEach(([channel]) => this.lastEvents.delete(channel));
    }
  }

  /**
   * Estimate memory usage
   * @private
   */
  _estimateMemoryUsage() {
    let size = 0;

    // Estimate listeners size
    for (const [pattern, listeners] of this.listeners.entries()) {
      size += pattern.length * 2; // string chars
      size += listeners.length * 50; // rough function size
    }

    // Estimate last events size
    for (const [channel, event] of this.lastEvents.entries()) {
      size += channel.length * 2;
      size += JSON.stringify(event.data).length * 2;
      size += 16; // timestamp + overhead
    }

    return `${Math.round(size / 1024)}KB`;
  }
}

// Create singleton instance
const eventBus = new EventBus();

// Debug mode disabled by default
// To enable debug mode, call: eventBus.setDebug(true)
// Or set environment variable: EVENTBUS_DEBUG=true
if (typeof process !== 'undefined' && process.env.EVENTBUS_DEBUG === 'true') {
  eventBus.setDebug(true);
}

export default eventBus;
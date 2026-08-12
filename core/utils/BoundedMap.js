// core/utils/BoundedMap.js
// Drop-in Map replacement with size bounds and TTL to prevent memory leaks

class BoundedMap {
  /**
   * @param {Object} options
   * @param {number} options.maxSize - Max entries before FIFO eviction (default: 10000)
   * @param {number} [options.ttl] - Entry TTL in ms (0 = no expiry)
   * @param {number} [options.cleanupInterval] - Cleanup interval in ms (default: 60000)
   */
  constructor({ maxSize = 10000, ttl = 0, cleanupInterval = 60000 } = {}) {
    this._map = new Map();
    this._maxSize = maxSize;
    this._ttl = ttl;
    this._cleanupTimer = null;

    if (ttl > 0 && cleanupInterval > 0) {
      this._cleanupTimer = setInterval(() => this._cleanup(), cleanupInterval);
      if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    }
  }

  _isExpired(entry) {
    return this._ttl > 0 && Date.now() >= entry._expiresAt;
  }

  _cleanup() {
    if (this._ttl <= 0) return;
    const now = Date.now();
    for (const [key, entry] of this._map) {
      if (now >= entry._expiresAt) {
        this._map.delete(key);
      }
    }
  }

  _evict() {
    while (this._map.size >= this._maxSize) {
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
  }

  _wrap(value) {
    return {
      value,
      _expiresAt: this._ttl > 0 ? Date.now() + this._ttl : Infinity,
    };
  }

  has(key) {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) {
      this._map.delete(key);
      return false;
    }
    return true;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this._map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    // Delete first so re-insertion moves to end (refreshes FIFO position)
    this._map.delete(key);
    this._evict();
    this._map.set(key, this._wrap(value));
    return this;
  }

  delete(key) {
    return this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  get size() {
    return this._map.size;
  }

  *entries() {
    for (const [key, entry] of this._map) {
      if (!this._isExpired(entry)) {
        yield [key, entry.value];
      }
    }
  }

  *keys() {
    for (const [key, entry] of this._map) {
      if (!this._isExpired(entry)) {
        yield key;
      }
    }
  }

  *values() {
    for (const [, entry] of this._map) {
      if (!this._isExpired(entry)) {
        yield entry.value;
      }
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  forEach(callback, thisArg) {
    for (const [key, value] of this.entries()) {
      callback.call(thisArg, value, key, this);
    }
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this._map.clear();
  }
}

export default BoundedMap;

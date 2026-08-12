// core/services/tracking/analytics.js
// Secure MongoDB-based analytics system (like Mixpanel) with tenant isolation

import { getMongoClient } from '../../db/adapters/mongodb/index.js';
import { getSite } from '../../sites/files.js';

/**
 * ANALYTICS TRACKING SYSTEM
 * 
 * Mixpanel-like analytics with automatic tenant isolation
 * CRITICAL: All events are automatically scoped to siteId for security
 */

export class AnalyticsTracker {
  constructor() {
    this.eventsCollection = 'analytics_events';
    this.usersCollection = 'analytics_users';
    this.funnelsCollection = 'analytics_funnels';
    this.cohortCollection = 'analytics_cohorts';
  }

  /**
   * Get MongoDB connection to the APP database (jason-apps).
   * This is where analytics_events, analytics_salts, and tenant user data live.
   * Server-only — this database must never be exposed to tenant client code.
   */
  async getDatabase() {
    const client = await getMongoClient(process.env.MONGODB_URI);
    return client.db(process.env.MONGODB_DB_NAME);
  }

  /**
   * Track an event with automatic tenant isolation
   * CRITICAL: siteId derived from host for consistent tenant isolation
   */
  async track(host, event, properties = {}, userId = null) {
    if (!host) {
      throw new Error('SECURITY: host is required for analytics tracking');
    }

    if (!event || typeof event !== 'string') {
      throw new Error('Event name is required and must be a string');
    }

    // Get consistent siteId from getSite utility
    const site = await getSite(host);
    if (!site) {
      throw new Error(`SECURITY: Unable to resolve site for host: ${host}`);
    }
    
    const siteId = site.id || site._id || site.domain;

    try {
      const db = await this.getDatabase();
      const collection = db.collection(this.eventsCollection);

      // Strip null/undefined properties so Mongo doesn't store explicit nulls.
      // Data is kept forever — every byte matters long-term.
      // Also promote structural fields (visitorHash, $sessionId) out of
      // `properties` into top-level fields so they can be indexed cleanly.
      // MongoDB rejects $-prefixed field names in index keys, so visitorHash
      // is deliberately NOT prefixed when callers pass it.
      const cleanProperties = {};
      for (const [k, v] of Object.entries(properties || {})) {
        // Skip fields that get promoted to top-level, plus empties.
        if (k === '$sessionId' || k === 'visitorHash') continue;
        if (v == null || v === '') continue;
        cleanProperties[k] = v;
      }

      const now = new Date();
      const eventRecord = {
        siteId, // CRITICAL: Tenant isolation
        event,
        properties: cleanProperties,
        userId: userId || null,
        sessionId: properties.$sessionId || null,
        timestamp: now,
      };
      // Only attach visitorHash when the caller (Tier 1 auto-tracker) provided
      // one. Tier 2 events from app.analytics.track() don't set it, and we
      // don't want a noisy null on every custom event.
      if (properties.visitorHash) {
        eventRecord.visitorHash = properties.visitorHash;
      }

      // Insert event record
      const result = await collection.insertOne(eventRecord);

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[analytics] Tracked ${event} for site ${siteId} → ${result.insertedId}`
        );
      }

      // Update user profile if userId provided
      if (userId) {
        await this.updateUserProfile(host, userId, properties);
      }

      return {
        success: true,
        eventId: result.insertedId,
        siteId,
        event
      };

    } catch (error) {
      console.error('Analytics tracking failed:', error);
      throw new Error(`Failed to track event: ${error.message}`);
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(host, userId, properties = {}) {
    // Get consistent siteId from getSite utility
    const site = await getSite(host);
    if (!site) {
      console.error(`Unable to resolve site for host: ${host}`);
      return;
    }
    
    const siteId = site.id || site._id || site.domain;

    try {
      const db = await this.getDatabase();
      const collection = db.collection(this.usersCollection);
      
      const updateData = {
        $set: {
          siteId, // CRITICAL: Tenant scoped
          userId,
          lastSeen: new Date(),
          lastSeenDate: new Date().toISOString().slice(0, 10),
          updatedAt: new Date()
        },
        $inc: {
          eventCount: 1
        },
        $setOnInsert: {
          firstSeen: new Date(),
          createdAt: new Date()
        }
      };

      // Add profile properties if provided
      if (properties.$name) updateData.$set.name = properties.$name;
      if (properties.$email) updateData.$set.email = properties.$email;
      if (properties.$avatar) updateData.$set.avatar = properties.$avatar;
      if (properties.$plan) updateData.$set.plan = properties.$plan;
      if (properties.$browser) updateData.$set.browser = properties.$browser;
      if (properties.$os) updateData.$set.os = properties.$os;
      if (properties.$device) updateData.$set.device = properties.$device;

      await collection.updateOne(
        { siteId, userId }, // CRITICAL: Tenant scoped
        updateData,
        { upsert: true }
      );
      
    } catch (error) {
      console.error('User profile update failed:', error);
      // Don't throw - profile update is not critical
    }
  }

  /**
   * Track page view
   */
  async page(host, page, properties = {}, userId = null) {
    return await this.track(host, '$page_view', {
      $page: page,
      ...properties
    }, userId);
  }

  /**
   * Identify user (update user profile)
   */
  async identify(host, userId, traits = {}) {
    if (!host || !userId) {
      throw new Error('SECURITY: host and userId are required');
    }

    // Get consistent siteId from getSite utility
    const site = await getSite(host);
    if (!site) {
      throw new Error(`SECURITY: Unable to resolve site for host: ${host}`);
    }
    
    const siteId = site.id || site._id || site.domain;

    try {
      const db = await this.getDatabase();
      const collection = db.collection(this.usersCollection);
      
      await collection.updateOne(
        { siteId, userId }, // CRITICAL: Tenant scoped
        {
          $set: {
            siteId,
            userId,
            ...traits,
            updatedAt: new Date()
          },
          $setOnInsert: {
            firstSeen: new Date(),
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      return { success: true, siteId, userId };
      
    } catch (error) {
      console.error('User identification failed:', error);
      throw new Error(`Failed to identify user: ${error.message}`);
    }
  }

  /**
   * Get events with tenant isolation
   * CRITICAL: Always scoped to siteId
   */
  async getEvents(host, options = {}) {
    if (!host) {
      throw new Error('SECURITY: host is required for event retrieval');
    }

    // Get consistent siteId from getSite utility
    const site = await getSite(host);
    if (!site) {
      throw new Error(`SECURITY: Unable to resolve site for host: ${host}`);
    }
    
    const siteId = site.id || site._id || site.domain;

    const {
      startDate,
      endDate,
      event,
      userId,
      limit = 100,
      skip = 0,
      sortBy = 'timestamp',
      sortOrder = -1 // newest first
    } = options;

    try {
      const db = await this.getDatabase();
      const collection = db.collection(this.eventsCollection);
      
      // Build query - ALWAYS scoped to tenant
      const query = { siteId };
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }
      
      if (event) query.event = event;
      if (userId) query.userId = userId;
      
      const events = await collection
        .find(query)
        .sort({ [sortBy]: sortOrder })
        .limit(limit)
        .skip(skip)
        .toArray();
      
      return {
        success: true,
        siteId,
        events,
        count: events.length
      };
      
    } catch (error) {
      console.error('Event retrieval failed:', error);
      throw new Error(`Failed to get events: ${error.message}`);
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboard(host, days = 30) {
    if (!host) {
      throw new Error('SECURITY: host is required for dashboard');
    }

    // Get consistent siteId from getSite utility
    const site = await getSite(host);
    if (!site) {
      throw new Error(`SECURITY: Unable to resolve site for host: ${host}`);
    }
    
    const siteId = site.id || site._id || site.domain;

    try {
      const db = await this.getDatabase();
      const eventsCollection = db.collection(this.eventsCollection);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Aggregate dashboard stats
      const pipeline = [
        {
          $match: {
            siteId, // CRITICAL: Tenant scoped
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
              event: "$event"
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            events: {
              $push: {
                event: "$_id.event",
                count: "$count",
                uniqueUsers: { $size: "$uniqueUsers" }
              }
            },
            totalEvents: { $sum: "$count" }
          }
        },
        { $sort: { "_id": 1 } },
        { $limit: days }
      ];
      
      const dailyStats = await eventsCollection.aggregate(pipeline).toArray();
      
      // Get top events
      const topEventsPipeline = [
        {
          $match: {
            siteId, // CRITICAL: Tenant scoped
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: "$event",
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" }
          }
        },
        {
          $project: {
            event: "$_id",
            count: 1,
            uniqueUsers: { $size: "$uniqueUsers" }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];
      
      const topEvents = await eventsCollection.aggregate(topEventsPipeline).toArray();
      
      return {
        success: true,
        siteId,
        period: `${days} days`,
        dailyStats,
        topEvents,
        totalDays: dailyStats.length
      };
      
    } catch (error) {
      console.error('Dashboard retrieval failed:', error);
      throw new Error(`Failed to get dashboard: ${error.message}`);
    }
  }

  /**
   * Track funnel step
   */
  async trackFunnel(host, funnelName, step, properties = {}, userId = null) {
    // Get consistent siteId from getSite utility
    const site = await getSite(host);
    if (!site) {
      throw new Error(`SECURITY: Unable to resolve site for host: ${host}`);
    }
    
    const siteId = site.id || site._id || site.domain;

    // Track the funnel step as a regular event
    const stepEvent = `funnel_${funnelName}_${step}`;
    await this.track(host, stepEvent, {
      $funnel: funnelName,
      $step: step,
      ...properties
    }, userId);

    // Update funnel progress
    if (userId) {
      try {
        const db = await this.getDatabase();
        const collection = db.collection(this.funnelsCollection);
        
        await collection.updateOne(
          { siteId, userId, funnel: funnelName }, // CRITICAL: Tenant scoped
          {
            $set: {
              siteId,
              userId,
              funnel: funnelName,
              currentStep: step,
              updatedAt: new Date()
            },
            $addToSet: {
              completedSteps: step
            },
            $setOnInsert: {
              startedAt: new Date(),
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
        
      } catch (error) {
        console.error('Funnel tracking failed:', error);
        // Don't throw - funnel tracking is supplementary
      }
    }
  }

  /**
   * Get funnel analysis
   */
  async getFunnelAnalysis(host, funnelName, days = 30) {
    if (!host || !funnelName) {
      throw new Error('SECURITY: host and funnelName are required');
    }

    // Get consistent siteId from getSite utility
    const site = await getSite(host);
    if (!site) {
      throw new Error(`SECURITY: Unable to resolve site for host: ${host}`);
    }
    
    const siteId = site.id || site._id || site.domain;

    try {
      const db = await this.getDatabase();
      const collection = db.collection(this.funnelsCollection);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const pipeline = [
        {
          $match: {
            siteId, // CRITICAL: Tenant scoped
            funnel: funnelName,
            startedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: "$currentStep",
            users: { $addToSet: "$userId" },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            step: "$_id",
            uniqueUsers: { $size: "$users" },
            count: 1
          }
        },
        { $sort: { step: 1 } }
      ];
      
      const stepAnalysis = await collection.aggregate(pipeline).toArray();
      
      return {
        success: true,
        siteId,
        funnel: funnelName,
        period: `${days} days`,
        steps: stepAnalysis
      };
      
    } catch (error) {
      console.error('Funnel analysis failed:', error);
      throw new Error(`Failed to analyze funnel: ${error.message}`);
    }
  }

  /**
   * Clean up old analytics data (cleanup job)
   * Removes events older than specified days
   */
  async cleanupOldData(daysToKeep = 365) {
    try {
      const db = await this.getDatabase();
      const eventsCollection = db.collection(this.eventsCollection);
      
      const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
      
      const result = await eventsCollection.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      console.log(`Cleaned up ${result.deletedCount} old analytics events`);
      return result.deletedCount;
      
    } catch (error) {
      console.error('Analytics cleanup failed:', error);
      return 0;
    }
  }
}

// Singleton instance
const analyticsTracker = new AnalyticsTracker();

export default analyticsTracker;
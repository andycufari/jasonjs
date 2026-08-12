// core/services/tracking/aiUsage.js
// MongoDB-based AI usage tracking with tenant isolation

import { getMongoClient } from '../../db/adapters/mongodb/index.js';

/**
 * AI USAGE TRACKING CLASS
 * 
 * Secure MongoDB-based tracking of AI usage per tenant
 * CRITICAL: All operations are automatically tenant-scoped
 */

export class AIUsageTracker {
  constructor() {
    this.collectionName = 'ai_usage';
    this.rateLimitCollection = 'ai_rate_limits';
  }

  /**
   * Get MongoDB database connection
   */
  async getDatabase() {
    const client = await getMongoClient(process.env.MONGODB_URI);
    if (!client) {
      console.warn('MongoDB client not available - AI usage tracking disabled');
      return null;
    }
    return client.db(process.env.MONGODB_DB_NAME);
  }

  /**
   * Track AI usage with automatic tenant isolation
   * CRITICAL: siteId is required and validated
   */
  async trackUsage(siteId, userId, model, tokensUsed, cost, metadata = {}) {
    if (!siteId) {
      throw new Error('SECURITY: siteId is required for AI usage tracking');
    }

    try {
      const db = await this.getDatabase();
      if (!db) {
        console.warn('Database not available - skipping AI usage tracking');
        return false;
      }
      const collection = db.collection(this.collectionName);
      
      const usageRecord = {
        siteId, // CRITICAL: Tenant isolation
        userId,
        model,
        tokensUsed,
        cost,
        timestamp: new Date(),
        date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
        metadata: {
          provider: metadata.provider,
          temperature: metadata.temperature,
          maxTokens: metadata.maxTokens,
          promptLength: metadata.promptLength,
          responseLength: metadata.responseLength,
          ...metadata
        },
        createdAt: new Date()
      };

      // Insert usage record
      const result = await collection.insertOne(usageRecord);
      
      // Update daily summary
      await this.updateDailySummary(siteId, model, tokensUsed, cost);
      
      console.log(`AI usage tracked for site ${siteId}: ${model} - ${tokensUsed} tokens - $${cost.toFixed(4)}`);
      
      return {
        success: true,
        usageId: result.insertedId,
        siteId
      };
      
    } catch (error) {
      console.error('AI usage tracking failed:', error);
      throw new Error(`Failed to track AI usage: ${error.message}`);
    }
  }

  /**
   * Update daily summary for efficient reporting
   */
  async updateDailySummary(siteId, model, tokensUsed, cost) {
    try {
      const db = await this.getDatabase();
      const collection = db.collection('ai_usage_daily');
      const today = new Date().toISOString().slice(0, 10);
      
      await collection.updateOne(
        { 
          siteId, // CRITICAL: Tenant scoped
          date: today,
          model
        },
        {
          $inc: {
            requests: 1,
            tokensUsed,
            totalCost: cost
          },
          $set: {
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
      
    } catch (error) {
      console.error('Daily summary update failed:', error);
      // Don't throw - summary is not critical
    }
  }

  /**
   * Get usage statistics for a tenant
   * CRITICAL: Automatically scoped to siteId
   */
  async getUsage(siteId, options = {}) {
    if (!siteId) {
      throw new Error('SECURITY: siteId is required for usage retrieval');
    }

    const {
      startDate,
      endDate,
      model,
      userId,
      groupBy = 'day', // day, model, user
      limit = 100
    } = options;

    try {
      const db = await this.getDatabase();
      if (!db) {
        console.warn('Database not available - returning empty AI usage data');
        return { usage: [], summary: { totalTokens: 0, totalCost: 0, totalRequests: 0 } };
      }
      const collection = db.collection(this.collectionName);

      // Build query - ALWAYS scoped to tenant
      const query = { siteId };
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }
      
      if (model) query.model = model;
      if (userId) query.userId = userId;
      
      // Aggregation pipeline for grouped data
      const pipeline = [
        { $match: query }
      ];
      
      if (groupBy === 'day') {
        pipeline.push(
          {
            $group: {
              _id: { 
                date: '$date',
                siteId: '$siteId' // Always include siteId for security
              },
              requests: { $sum: 1 },
              tokensUsed: { $sum: '$tokensUsed' },
              totalCost: { $sum: '$cost' },
              models: { $addToSet: '$model' }
            }
          },
          { $sort: { '_id.date': -1 } },
          { $limit: limit }
        );
      } else if (groupBy === 'model') {
        pipeline.push(
          {
            $group: {
              _id: { 
                model: '$model',
                siteId: '$siteId' // Always include siteId for security
              },
              requests: { $sum: 1 },
              tokensUsed: { $sum: '$tokensUsed' },
              totalCost: { $sum: '$cost' },
              avgTokensPerRequest: { $avg: '$tokensUsed' }
            }
          },
          { $sort: { totalCost: -1 } },
          { $limit: limit }
        );
      }
      
      const results = await collection.aggregate(pipeline).toArray();
      
      return {
        success: true,
        siteId,
        groupBy,
        data: results,
        totalRecords: results.length
      };
      
    } catch (error) {
      console.error('Usage retrieval failed:', error);
      throw new Error(`Failed to get usage data: ${error.message}`);
    }
  }

  /**
   * Check and enforce rate limits
   * CRITICAL: Per-tenant rate limiting
   */
  async checkRateLimit(siteId, userId, limit = 10, windowMinutes = 1) {
    if (!siteId) {
      throw new Error('SECURITY: siteId is required for rate limiting');
    }

    try {
      const db = await this.getDatabase();
      if (!db) {
        console.warn('Database not available - rate limiting disabled (allowing request)');
        return { allowed: true, remainingRequests: limit };
      }
      const collection = db.collection(this.rateLimitCollection);
      
      const now = new Date();
      const windowStart = new Date(now.getTime() - (windowMinutes * 60 * 1000));
      
      // Count requests in the current window - TENANT SCOPED
      const requestCount = await collection.countDocuments({
        siteId, // CRITICAL: Tenant isolation
        userId,
        timestamp: { $gte: windowStart }
      });
      
      const remaining = Math.max(0, limit - requestCount);
      const allowed = requestCount < limit;
      
      // Log the attempt - TENANT SCOPED
      await collection.insertOne({
        siteId, // CRITICAL: Tenant isolation
        userId,
        timestamp: now,
        allowed,
        requestCount,
        limit,
        windowMinutes
      });
      
      return {
        allowed,
        remaining,
        resetTime: windowStart.getTime() + (windowMinutes * 60 * 1000),
        currentCount: requestCount,
        limit
      };
      
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // In case of error, allow the request but log it
      return {
        allowed: true,
        remaining: 0,
        resetTime: Date.now() + (windowMinutes * 60 * 1000),
        error: error.message
      };
    }
  }

  /**
   * Clean up old rate limit records (cleanup job)
   * Removes records older than 24 hours
   */
  async cleanupRateLimits() {
    try {
      const db = await this.getDatabase();
      if (!db) {
        console.warn('Database not available - skipping rate limit cleanup');
        return { deletedCount: 0 };
      }
      const collection = db.collection(this.rateLimitCollection);
      
      const yesterday = new Date(Date.now() - (24 * 60 * 60 * 1000));
      
      const result = await collection.deleteMany({
        timestamp: { $lt: yesterday }
      });
      
      console.log(`Cleaned up ${result.deletedCount} old rate limit records`);
      return result.deletedCount;
      
    } catch (error) {
      console.error('Rate limit cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get total usage summary for a tenant
   */
  async getTotalUsage(siteId, days = 30) {
    if (!siteId) {
      throw new Error('SECURITY: siteId is required for usage summary');
    }

    try {
      const db = await this.getDatabase();
      const collection = db.collection('ai_usage_daily');
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const pipeline = [
        {
          $match: {
            siteId, // CRITICAL: Tenant scoped
            lastUpdated: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$siteId', // Group by tenant
            totalRequests: { $sum: '$requests' },
            totalTokens: { $sum: '$tokensUsed' },
            totalCost: { $sum: '$totalCost' },
            models: { $addToSet: '$model' },
            days: { $addToSet: '$date' }
          }
        }
      ];
      
      const result = await collection.aggregate(pipeline).toArray();
      
      return {
        success: true,
        siteId,
        period: `${days} days`,
        summary: result[0] || {
          _id: siteId,
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0,
          models: [],
          days: []
        }
      };
      
    } catch (error) {
      console.error('Total usage summary failed:', error);
      throw new Error(`Failed to get usage summary: ${error.message}`);
    }
  }
}

// Singleton instance
const aiUsageTracker = new AIUsageTracker();

export default aiUsageTracker;
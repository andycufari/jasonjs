// core/billing/db.js
/**
 * Billing Database Helpers
 *
 * Billing collections are SHARED infrastructure collections (not tenant-prefixed).
 * They store data for all tenants with `siteId` field for isolation.
 *
 * Collections:
 * - billing_customers: Maps userId/accountId ↔ provider customerId
 * - billing_subscriptions: Subscription status synced from webhooks
 * - billing_payments: Payment history
 *
 * These are different from tenant collections like `{siteId}_todos` which
 * are prefixed with the tenant's siteId.
 */

import { getMongoClient } from '../db/adapters/mongodb/index.js';

/**
 * Get the shared MongoDB database for JasonJS
 * @returns {Promise<Db>} MongoDB database instance
 */
async function getDatabase() {
  const connectionString = process.env.MONGODB_URI;

  if (!connectionString) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const client = await getMongoClient(connectionString);
  const dbName = process.env.MONGODB_DB_NAME || 'jasonjs_universal';
  return client.db(dbName);
}

/**
 * Generate a simple string ID for documents
 * @returns {string} Simple string ID
 */
function generateId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${randomStr}`;
}

/**
 * Billing DB wrapper for shared collections
 * Automatically includes siteId in all operations for tenant isolation
 */
export class BillingDB {
  constructor(siteId) {
    if (!siteId) {
      throw new Error('siteId is required for billing operations');
    }
    this.siteId = siteId.toString(); // Normalize ObjectId to string
    this.db = null;
  }

  async getDb() {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Get a shared billing collection
   * @param {string} name - Collection name (billing_customers, billing_subscriptions, billing_payments)
   * @returns {Collection} MongoDB collection
   */
  async collection(name) {
    const db = await this.getDb();
    return db.collection(name);
  }

  // ===== CUSTOMER OPERATIONS =====

  /**
   * Find a customer by provider's customer ID
   * @param {string} customerId - Provider's customer ID (e.g., cus_xxx)
   * @param {string} provider - Provider name (stripe, mercadopago)
   * @returns {Promise<Object|null>}
   */
  async findCustomerByProviderId(customerId, provider) {
    const col = await this.collection('billing_customers');
    return col.findOne({
      siteId: this.siteId,
      customerId,
      provider,
    });
  }

  /**
   * Find a customer by userId
   * @param {string} userId - User ID
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>}
   */
  async findCustomerByUserId(userId, provider) {
    const col = await this.collection('billing_customers');
    return col.findOne({
      siteId: this.siteId,
      userId,
      provider,
    });
  }

  /**
   * Find a customer by email
   * @param {string} email - Customer email
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>}
   */
  async findCustomerByEmail(email, provider) {
    const col = await this.collection('billing_customers');
    return col.findOne({
      siteId: this.siteId,
      email,
      provider,
    });
  }

  /**
   * Find a customer by reference ID (userId or accountId based on customerType)
   * @param {string} refId - Reference ID
   * @param {string} customerType - "user" or "account"
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>}
   */
  async findCustomerByRefId(refId, customerType, provider) {
    const col = await this.collection('billing_customers');
    return col.findOne({
      siteId: this.siteId,
      customerRefId: refId,
      customerType,
      provider,
    });
  }

  /**
   * Create a new customer record
   * @param {Object} data - Customer data
   * @returns {Promise<Object>} Created customer
   */
  async createCustomer(data) {
    const col = await this.collection('billing_customers');
    const doc = {
      id: generateId(),
      siteId: this.siteId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await col.insertOne(doc);
    return doc;
  }

  // ===== SUBSCRIPTION OPERATIONS =====

  /**
   * Find active subscription for a user
   * Includes: active, trialing, incomplete (payment processing), past_due (grace period)
   * @param {string} userId - User ID
   * @param {string} [provider] - Optional provider filter
   * @returns {Promise<Object|null>}
   */
  async findActiveSubscription(userId, provider = null) {
    const col = await this.collection('billing_subscriptions');
    const query = {
      siteId: this.siteId,
      userId,
      // Include multiple "valid" statuses - not just 'active'
      // 'incomplete' = payment processing, 'trialing' = trial period, 'past_due' = grace period
      status: { $in: ['active', 'trialing', 'incomplete', 'past_due'] },
    };
    if (provider) {
      query.provider = provider;
    }
    // Get most recent subscription, prioritizing 'active' status
    return col.findOne(query, { sort: { status: 1, currentPeriodEnd: -1 } });
  }

  /**
   * Find subscription by provider's subscription ID
   * @param {string} subscriptionId - Provider's subscription ID
   * @returns {Promise<Object|null>}
   */
  async findSubscriptionById(subscriptionId) {
    const col = await this.collection('billing_subscriptions');
    return col.findOne({
      siteId: this.siteId,
      subscriptionId,
    });
  }

  /**
   * Get all subscriptions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async findAllSubscriptions(userId) {
    const col = await this.collection('billing_subscriptions');
    return col.find({
      siteId: this.siteId,
      userId,
    }).sort({ createdAt: -1 }).toArray();
  }

  /**
   * Create or update a subscription (upsert by subscriptionId)
   * Handles race conditions: won't downgrade status from 'active' to 'incomplete'
   * Uses ATOMIC MongoDB operations to prevent race conditions between concurrent webhooks
   * @param {Object} data - Subscription data (must include subscriptionId)
   * @returns {Promise<Object>} Upserted subscription
   */
  async upsertSubscription(data) {
    const col = await this.collection('billing_subscriptions');
    const { subscriptionId, status, ...rest } = data;

    // Status priority: active > trialing > past_due > incomplete > canceled
    // Higher number = better status (don't downgrade)
    const statusPriority = {
      'active': 5,
      'trialing': 4,
      'past_due': 3,
      'incomplete': 2,
      'incomplete_expired': 1,
      'canceled': 0,
      'unpaid': 0,
    };

    const newPriority = statusPriority[status] || 0;
    const now = new Date();

    // Build the base document for updates
    const baseDoc = {
      siteId: this.siteId,
      subscriptionId,
      ...rest,
      updatedAt: now,
      syncedAt: now,
    };

    // STRATEGY: Use TWO atomic operations to handle race conditions
    // 1. First, try to UPDATE only if new status is better or equal
    // 2. If no update (doc doesn't exist), INSERT with new status

    // Build list of statuses we should NOT overwrite (higher priority statuses)
    const betterStatuses = Object.entries(statusPriority)
      .filter(([_, priority]) => priority > newPriority)
      .map(([statusName]) => statusName);

    // Try to update existing subscription, but ONLY if current status is NOT better
    const updateResult = await col.findOneAndUpdate(
      {
        siteId: this.siteId,
        subscriptionId,
        // Only update if current status is NOT in the "better" list
        // This is atomic - no race condition possible
        status: { $nin: betterStatuses },
      },
      {
        $set: { ...baseDoc, status },
      },
      { returnDocument: 'after' }
    );

    if (updateResult) {
      console.log(`[BillingDB] Updated subscription ${subscriptionId}: status=${status}`);
      return updateResult;
    }

    // Check if the subscription exists with a better status (that's why update failed)
    const existing = await col.findOne({ siteId: this.siteId, subscriptionId });

    if (existing) {
      // Document exists but has better status - don't downgrade
      console.log(`[BillingDB] Preventing status downgrade: ${existing.status} -> ${status}, keeping ${existing.status}`);
      // Still update other fields, just keep the better status
      const preserveResult = await col.findOneAndUpdate(
        { siteId: this.siteId, subscriptionId },
        {
          $set: { ...baseDoc }, // Update everything except status
        },
        { returnDocument: 'after' }
      );
      return preserveResult;
    }

    // Document doesn't exist - create new
    const newDoc = {
      ...baseDoc,
      status,
      id: generateId(),
      createdAt: now,
    };

    try {
      await col.insertOne(newDoc);
      console.log(`[BillingDB] Created subscription ${subscriptionId}: status=${status}`);
      return newDoc;
    } catch (err) {
      // Handle race condition where another process inserted between our check and insert
      if (err.code === 11000) { // Duplicate key error
        console.log(`[BillingDB] Race condition on insert, retrying update for ${subscriptionId}`);
        // Retry the update logic
        return this.upsertSubscription(data);
      }
      throw err;
    }
  }

  /**
   * Update subscription status
   * @param {string} subscriptionId - Provider's subscription ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>}
   */
  async updateSubscription(subscriptionId, updates) {
    const col = await this.collection('billing_subscriptions');
    const result = await col.findOneAndUpdate(
      { siteId: this.siteId, subscriptionId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  // ===== PAYMENT OPERATIONS =====

  /**
   * Check if payment already recorded (idempotency)
   * @param {string} paymentId - Provider's payment ID
   * @returns {Promise<boolean>}
   */
  async paymentExists(paymentId) {
    const col = await this.collection('billing_payments');
    const existing = await col.findOne({
      siteId: this.siteId,
      paymentId,
    });
    return !!existing;
  }

  /**
   * Record a payment
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} Created payment record
   */
  async recordPayment(data) {
    const col = await this.collection('billing_payments');
    const doc = {
      id: generateId(),
      siteId: this.siteId,
      ...data,
      recordedAt: new Date(),
      createdAt: new Date(),
    };
    await col.insertOne(doc);
    return doc;
  }

  /**
   * Get payment history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum records to return
   * @returns {Promise<Array>}
   */
  async getPaymentHistory(userId, limit = 50) {
    const col = await this.collection('billing_payments');
    return col.find({
      siteId: this.siteId,
      userId,
    }).sort({ createdAt: -1 }).limit(limit).toArray();
  }
}

/**
 * Create a BillingDB instance for a site
 * @param {string} siteId - Site identifier
 * @returns {BillingDB}
 */
export function createBillingDB(siteId) {
  return new BillingDB(siteId);
}

export default BillingDB;

/**
 * Customer Management Service
 *
 * Handles lazy creation and management of customers across payment providers.
 * Customers are created in the provider on-demand during first payment interaction.
 *
 * Supports two customer types:
 * - "user": Direct user billing (default) - userId is the customer
 * - "account": Account-based billing (SaaS) - accountId is the customer, userId is subscriber
 *
 * SECURITY: These functions access SHARED billing collections.
 * They should ONLY be called from:
 * - API routes (/app/api/billing/*)
 * - Server-side core code
 * NEVER from client components or tenant code.
 */

import { createBillingDB } from '@/core/billing/db';

/**
 * Get or create a customer in the payment provider
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {Object} provider - Payment provider instance (Stripe, MercadoPago)
 * @param {Object} userData - Customer data
 * @param {string} userData.userId - User ID from JasonJS auth (required)
 * @param {string} userData.email - User email (required)
 * @param {string} [userData.name] - User name
 * @param {string} [userData.customerType='user'] - "user" or "account"
 * @param {string} [userData.accountId] - Account ID (for account-based billing)
 * @returns {Promise<Object>} Customer record with customerId
 */
export async function getOrCreateCustomer(siteId, provider, userData) {
  const billingDb = createBillingDB(siteId);

  const {
    userId,
    email,
    name,
    customerType = 'user',
    accountId,
  } = userData;

  if (!userId || !email) {
    throw new Error('User ID and email are required to create a customer');
  }

  const providerName = provider.name;

  // Determine the reference ID based on customer type
  const customerRefId = customerType === 'account' ? accountId : userId;

  if (!customerRefId) {
    throw new Error(`${customerType === 'account' ? 'Account ID' : 'User ID'} is required for ${customerType} billing`);
  }

  // Check if customer already exists locally
  const existingCustomer = await billingDb.findCustomerByRefId(customerRefId, customerType, providerName);

  if (existingCustomer) {
    console.log(`Found existing ${providerName} customer ${existingCustomer.customerId} for ${customerType} ${customerRefId}`);
    return existingCustomer;
  }

  // Customer doesn't exist - create in provider
  console.log(`Creating new ${providerName} customer for ${customerType} ${customerRefId}`);

  const providerCustomer = await provider.createCustomer({
    email,
    name: name || email,
    metadata: {
      userId,
      customerType,
      customerRefId,
      siteId,
      source: 'jasonjs',
      ...(accountId && { accountId }),
    },
  });

  // Build customer record
  const customerData = {
    customerId: providerCustomer.id,
    customerType,
    customerRefId,
    userId,
    provider: providerName,
    email: providerCustomer.email || email,
    metadata: {},
  };

  // For account-based billing, store additional fields
  if (customerType === 'account') {
    customerData.accountId = accountId;
    customerData.subscriberUserId = userId;
  }

  // Save customer to local database
  const savedCustomer = await billingDb.createCustomer(customerData);

  console.log(`Created ${providerName} customer ${providerCustomer.id} for ${customerType} ${customerRefId}`);

  return savedCustomer;
}

/**
 * Get customer by provider's customer ID (e.g., cus_xxx for Stripe)
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} customerId - Provider's customer ID
 * @param {string} providerName - Provider name (stripe, mercadopago)
 * @returns {Promise<Object|null>} Customer record or null
 */
export async function getCustomerByProviderId(siteId, customerId, providerName) {
  const billingDb = createBillingDB(siteId);
  return billingDb.findCustomerByProviderId(customerId, providerName);
}

/**
 * Get customer by email address
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} email - Customer email
 * @param {string} providerName - Provider name
 * @returns {Promise<Object|null>} Customer record or null
 */
export async function getCustomerByEmail(siteId, email, providerName) {
  const billingDb = createBillingDB(siteId);
  return billingDb.findCustomerByEmail(email, providerName);
}

/**
 * Get customer by userId
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {string} providerName - Provider name
 * @returns {Promise<Object|null>} Customer record or null
 */
export async function getCustomer(siteId, userId, providerName) {
  const billingDb = createBillingDB(siteId);
  return billingDb.findCustomerByUserId(userId, providerName);
}

/**
 * Create a customer record from webhook data (fallback)
 * Used when checkout didn't create the record properly
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {Object} data - Customer data from webhook
 * @returns {Promise<Object>} Created customer record
 */
export async function createCustomerFromWebhook(siteId, data) {
  const billingDb = createBillingDB(siteId);

  const {
    customerId,
    userId,
    email,
    customerType = 'user',
    providerName,
    metadata = {},
  } = data;

  if (!customerId || !userId) {
    throw new Error('customerId and userId are required to create customer from webhook');
  }

  const customerData = {
    customerId,
    customerType,
    customerRefId: userId,
    userId,
    provider: providerName,
    email: email || null,
    metadata: {
      ...metadata,
      createdFromWebhook: true,
    },
  };

  const result = await billingDb.createCustomer(customerData);

  console.log(`Created customer from webhook: ${customerId} -> ${userId}`);

  return result;
}

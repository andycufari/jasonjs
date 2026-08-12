// core/auth/lib.js - Shared authentication library for JasonJS Framework
import { getServerSession } from "next-auth";
import { createAuthOptions } from './options';
import bcrypt from 'bcryptjs';

// Constants
const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

async function connectToDatabase() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set - database operations will fail');
    return { db: null, client: null };
  }

  try {
    // Dynamic import to avoid client-side bundling
    const { getMongoClient } = await import('../db/adapters/mongodb/index.js');
    const client = await getMongoClient(process.env.MONGODB_URI);
    if (!client) {
      console.warn('MongoDB client not available - database operations will fail');
      return { db: null, client: null };
    }

    const dbName = process.env.MONGODB_DB_NAME || process.env.WEBAPP_DB_NAME || 'jasonjs_universal';
    const db = client.db(dbName);

    return { db, client };
  } catch (error) {
    console.error('Failed to connect to database:', error);
    return { db: null, client: null };
  }
}

/**
 * Get current authenticated user
 * Works on both server (with session) and client (with context)
 */
export async function getUser(req = null, pageData = null) {
  if (typeof window !== 'undefined') {
    // Client-side: Use context or fetch from API
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      return await response.json();
    }
    return null;
  }
  
  // Server-side: Use NextAuth session
  if (pageData) {
    const authOptions = await createAuthOptions(pageData);
    const session = await getServerSession(authOptions);
    return session?.user || null;
  }
  
  return null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(req = null, pageData = null) {
  const user = await getUser(req, pageData);
  return !!user;
}

/**
 * Check if user has specific role
 */
export async function hasRole(role, req = null, pageData = null) {
  const user = await getUser(req, pageData);
  if (!user) return false;
  
  // Check if user has the required role
  if (Array.isArray(user.roles)) {
    return user.roles.includes(role);
  }
  
  return user.role === role;
}

/**
 * Get user by ID from database
 */
export async function getUserById(userId, siteId = null) {
  const { db } = await connectToDatabase();

  // Dynamic import to avoid client-side bundling
  const { ObjectId } = await import('mongodb');
  const query = { _id: new ObjectId(userId) };
  if (siteId) {
    query.siteId = siteId;
  }

  const user = await db.collection('users').findOne(query);

  if (!user) return null;

  // Remove sensitive data
  delete user.password;

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    name: user.name,
    image: user.image,
    role: user.role || 'user',
    roles: user.roles || [user.role || 'user'],
    siteId: user.siteId,
    emailVerified: user.emailVerified,
    customFields: user.customFields || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/**
 * Get user by username from database
 */
export async function getUserByUsername(username, siteId) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - getUserByUsername returning null');
    return null;
  }

  const user = await db.collection('users').findOne({
    username: username.toLowerCase(),
    siteId
  });

  if (!user) return null;

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    name: user.name,
    image: user.image,
    role: user.role || 'user',
    roles: user.roles || [user.role || 'user'],
    password: user.password, // Include for password verification
    siteId: user.siteId,
    emailVerified: user.emailVerified,
    customFields: user.customFields || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/**
 * Get user by email from database
 */
export async function getUserByEmail(email, siteId) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - getUserByEmail returning null');
    return null;
  }

  const user = await db.collection('users').findOne({
    email: email.toLowerCase(),
    siteId
  });

  if (!user) return null;

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    name: user.name,
    image: user.image,
    role: user.role || 'user',
    roles: user.roles || [user.role || 'user'],
    password: user.password, // Include for password verification
    siteId: user.siteId,
    emailVerified: user.emailVerified,
    customFields: user.customFields || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/**
 * Count users for a site
 * @param {string} siteId - Site ID to count users for
 * @param {Object} filter - Optional filter (e.g., { role: 'user' })
 */
export async function countUsers(siteId, filter = {}) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - countUsers returning 0');
    return 0;
  }

  const query = { siteId, ...filter };
  return await db.collection('users').countDocuments(query);
}

/**
 * Get users for a site with pagination
 * @param {string} siteId - Site ID
 * @param {Object} options - Query options
 * @param {Object} options.filter - Filter criteria (e.g., { role: 'admin' })
 * @param {number} options.limit - Max results (default: 50, max: 100)
 * @param {number} options.skip - Offset for pagination
 * @param {Object} options.sort - Sort criteria (e.g., { createdAt: -1 })
 */
export async function getUsers(siteId, options = {}) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - getUsers returning empty array');
    return [];
  }

  const {
    filter = {},
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;

  // Cap limit at 100 to prevent abuse
  const safeLimit = Math.min(limit, 100);

  const users = await db.collection('users')
    .find({ siteId, ...filter })
    .sort(sort)
    .skip(skip)
    .limit(safeLimit)
    .toArray();

  // Return sanitized user objects (no passwords)
  return users.map(user => ({
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    name: user.name,
    image: user.image,
    role: user.role || 'user',
    roles: user.roles || [user.role || 'user'],
    siteId: user.siteId,
    emailVerified: user.emailVerified,
    customFields: user.customFields || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }));
}

/**
 * Create new user
 */
export async function createUser(userData) {
  const { db } = await connectToDatabase();

  // Hash password if provided
  if (userData.password) {
    userData.password = await hashPassword(userData.password);
  }

  // Ensure lowercase username and email
  if (userData.username) {
    userData.username = userData.username.toLowerCase();
  }
  if (userData.email) {
    userData.email = userData.email.toLowerCase();
  }

  // Add timestamps
  const now = new Date();
  userData.createdAt = now;
  userData.updatedAt = now;
  userData.lastLogin = null; // Will be set on first login

  // Set default role (string for backward compatibility)
  if (!userData.role) {
    userData.role = 'user';
  }

  // Ensure roles array exists (for multi-role support)
  if (!userData.roles) {
    userData.roles = [userData.role];
  }

  // Ensure customFields object exists
  if (!userData.customFields) {
    userData.customFields = {};
  }

  const result = await db.collection('users').insertOne(userData);

  return {
    id: result.insertedId.toString(),
    ...userData,
    password: undefined // Don't return password
  };
}

/**
 * Update user data
 */
export async function updateUser(userId, data) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - updateUser returning null');
    return null;
  }

  // Remove sensitive fields that shouldn't be updated directly
  delete data._id;
  delete data.password; // Use updatePassword for password changes
  delete data.createdAt;

  // Update timestamp
  data.updatedAt = new Date();

  // Dynamic import to avoid client-side bundling
  const { ObjectId } = await import('mongodb');
  const result = await db.collection('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: data },
    { returnDocument: 'after' }
  );

  if (!result) return null;

  // Remove password from response
  delete result.password;

  return result;
}

/**
 * Update a single custom field for a user
 */
export async function updateUserCustomField(userId, fieldName, fieldValue) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - updateUserCustomField returning null');
    return null;
  }

  // Dynamic import to avoid client-side bundling
  const { ObjectId } = await import('mongodb');

  const result = await db.collection('users').findOneAndUpdate(
    { _id: new ObjectId(userId) },
    {
      $set: {
        [`customFields.${fieldName}`]: fieldValue,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) return null;

  // Remove password from response
  delete result.password;

  return result;
}

/**
 * Get a single custom field value for a user
 */
export async function getUserCustomField(userId, fieldName) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - getUserCustomField returning null');
    return null;
  }

  // Dynamic import to avoid client-side bundling
  const { ObjectId } = await import('mongodb');

  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { [`customFields.${fieldName}`]: 1 } }
  );

  if (!user || !user.customFields) return null;

  return user.customFields[fieldName];
}

/**
 * Delete a custom field from a user
 */
export async function deleteUserCustomField(userId, fieldName) {
  const { db } = await connectToDatabase();

  if (!db) {
    console.warn('Database not available - deleteUserCustomField returning false');
    return false;
  }

  // Dynamic import to avoid client-side bundling
  const { ObjectId } = await import('mongodb');

  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: { [`customFields.${fieldName}`]: '' },
      $set: { updatedAt: new Date() }
    }
  );

  return result.modifiedCount > 0;
}

/**
 * Update user password
 */
export async function updatePassword(userId, newPassword) {
  const { db } = await connectToDatabase();

  const hashedPassword = await hashPassword(newPassword);

  // Dynamic import to avoid client-side bundling
  const { ObjectId } = await import('mongodb');
  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Delete user account
 */
export async function deleteUser(userId) {
  const { db } = await connectToDatabase();

  // Dynamic import to avoid client-side bundling
  const { ObjectId } = await import('mongodb');
  const result = await db.collection('users').deleteOne({
    _id: new ObjectId(userId)
  });
  
  return result.deletedCount > 0;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
export function validatePassword(password, config = {}) {
  const {
    minLength = MIN_PASSWORD_LENGTH,
    requireNumbers = false,
    requireSymbols = false,
    requireUppercase = false,
    requireLowercase = false
  } = config;

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate username
 */
export function validateUsername(username) {
  const errors = [];
  
  if (!username || username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 30) {
    errors.push('Username must be less than 30 characters');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate email
 */
export function validateEmail(email) {
  const errors = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || !emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Require authentication middleware for API routes
 */
export function requireAuth(handler) {
  return async (req, res) => {
    const user = await getUser(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Attach user to request
    req.user = user;
    
    return handler(req, res);
  };
}

/**
 * Require specific role middleware for API routes
 */
export function requireRole(role) {
  return (handler) => {
    return requireAuth(async (req, res) => {
      if (!hasRole(role, req)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      return handler(req, res);
    });
  };
}

// Export all functions
export default {
  getUser,
  isAuthenticated,
  hasRole,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  createUser,
  updateUser,
  updateUserCustomField,
  getUserCustomField,
  deleteUserCustomField,
  updatePassword,
  deleteUser,
  hashPassword,
  verifyPassword,
  validatePassword,
  validateUsername,
  validateEmail,
  requireAuth,
  requireRole
};
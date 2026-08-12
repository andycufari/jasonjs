// studio/core/auth/options.js
import { cache } from 'react';
import { headers } from 'next/headers';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { DEFAULT_AUTH_CONFIG } from './defaults';
import { deepMerge } from '../utils/deepMerge';
import { getUserByUsername, getUserByEmail, verifyPassword, validatePassword, validateUsername, updateUser } from './lib';
import { getSite } from '../sites/files';
import { createLogger } from '../utils/logger';
import { isDevModeActive } from '../utils/devModeCache.js';
import { getClientIp } from '../utils/getClientIp.js';

const logger = createLogger('AuthOptions');

/**
 * SECURITY NOTE: This cache is SERVER-SIDE ONLY
 * - Uses React cache() for per-request deduplication
 * - Never sends cached auth options to client
 * - Cache key uses safe identifiers only (domain, not secrets)
 * - Respects dev mode for fresh config during development
 */

export async function getAuthConfig(pageData) {
  try {
    // Handle null pageData
    if (!pageData) {
      return {
        settings: DEFAULT_AUTH_CONFIG,
        startupId: null
      };
    }

    const authConfig = pageData.auth 
      ? deepMerge(DEFAULT_AUTH_CONFIG, pageData.auth)
      : DEFAULT_AUTH_CONFIG;

    return {
      settings: authConfig,
      startupId: pageData.startup_id
    };
  } catch (error) {
    console.error('Error getting auth config:', error);
    return {
      settings: DEFAULT_AUTH_CONFIG,
      startupId: null
    };
  }
}

/**
 * Internal cached auth options builder (React cache for per-request deduplication)
 * SECURITY: This function is wrapped with React's cache() to deduplicate calls
 * within the same request, preventing expensive re-computation
 */
const createAuthOptionsInternal = cache(async (cacheKey, pageData) => {
  logger.debug('Building auth options', { cacheKey, hasDomain: !!pageData?.domain });

  const { settings, startupId } = await getAuthConfig(pageData);

  // Dynamic import to avoid client-side bundling
  const { clientPromise } = await import('../db/adapters/mongodb');
  const client = await clientPromise;

  let db = null;
  let dbName = process.env.MONGODB_DB_NAME || process.env.WEBAPP_DB_NAME || 'jasonjs_universal';

  // Handle case where MongoDB client is not available (e.g., during build)
  if (!client) {
    console.warn('MongoDB client not available, creating auth options without database adapter');
  } else {
    db = client.db(dbName);
  }
  
  // Get domain and resolve to proper siteId using getSite
  let domain = pageData?.domain || pageData?.host;
  // Remove port for consistency (handles any port, not just :3000)
  if (domain && domain.includes(':')) {
    domain = domain.split(':')[0];
  }

  // Get site object to extract the proper siteId
  let siteId = null;
  if (domain) {
    try {
      const site = await getSite(domain);
      if (site && site._id) {
        siteId = typeof site._id === 'string' ? site._id : site._id.toString();
      }
    } catch (error) {
      console.error('Error getting site for auth:', error);
    }
  }

  // Fallback to using domain if site not found (for local/standalone mode)
  if (!siteId) {
    siteId = domain;
  }

  const authOptions = {
    secret: process.env.NEXTAUTH_SECRET || process.env.WEBAPP_AUTH_SECRET,
    trustHost: true, // Trust the host header for multi-tenant/dynamic domains
    session: {
      strategy: 'jwt',  // Use JWT for sessions (required for credentials provider)
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
  };

  // Only add MongoDB adapter if client is available
  if (client && db) {
    const { MongoDBAdapter } = await import("@auth/mongodb-adapter");
    authOptions.adapter = MongoDBAdapter(clientPromise, {
      databaseName: dbName,
      collections: {
        Users: 'users',  // Use the same collection as JasonJS database
        Accounts: 'accounts',
        Sessions: 'sessions',
        VerificationTokens: 'verification_tokens',
      },
    });
  }

  authOptions.providers = [
      // Verification Code Provider (for passwordless auth)
      CredentialsProvider({
        id: "verification-code",
        name: "verification-code",
        credentials: {
          email: { label: "Email", type: "email" },
          code: { label: "Code", type: "text" },
          type: { label: "Type", type: "text" }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.code || !credentials?.type) {
            return null;
          }

          try {
            const { getMongoClient } = await import('../db/adapters/mongodb/index.js');
            const client = await getMongoClient(process.env.MONGODB_URI);
            const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

            // Find valid verification code
            const verificationCode = await db.collection('verification_codes').findOne({
              email: credentials.email.toLowerCase(),
              code: credentials.code.toString(),
              type: credentials.type,
              used: false,
              expiresAt: { $gt: new Date() }
            });

            if (!verificationCode) {
              return null;
            }

            // Mark code as used
            await db.collection('verification_codes').updateOne(
              { _id: verificationCode._id },
              {
                $set: {
                  used: true,
                  usedAt: new Date()
                }
              }
            );

            // Get user details
            const user = await db.collection('users').findOne({
              _id: new (await import('mongodb')).ObjectId(verificationCode.userId)
            });

            if (!user) {
              return null;
            }

            // Update user based on verification type
            if (credentials.type === 'registration') {
              await updateUser(verificationCode.userId, {
                emailVerified: true,
                emailVerifiedAt: new Date()
              });
            }

            if (credentials.type === 'login') {
              await updateUser(verificationCode.userId, {
                lastLogin: new Date()
              });
            }

            // Return user object for session
            return {
              id: user._id.toString(),
              email: user.email,
              username: user.username,
              name: user.name,
              role: user.role || 'user',
              roles: user.roles || [user.role || 'user'],
              siteId: user.siteId,
              emailVerified: credentials.type === 'registration' ? true : user.emailVerified
            };
          } catch (error) {
            console.error('Verification auth error:', error);
            return null;
          }
        }
      }),

      // Credentials Provider (Username/Password)
      ...(settings.providers?.credentials?.enabled ? [
        CredentialsProvider({
          name: "credentials",
          credentials: {
            username: {
              label: "Username",
              type: "text",
              placeholder: "Username"
            },
            password: {
              label: "Password",
              type: "password"
            }
          },
          async authorize(credentials) {
            if (!credentials?.username || !credentials?.password) {
              return null;
            }

            try {
              console.log('Auth attempt:', { username: credentials.username, siteId });
              
              // Try to find user by email first (since we use email as username), then by username
              let user = await getUserByEmail(credentials.username, siteId);
              console.log('User found by email:', !!user);
              
              if (!user) {
                // If not found by email, validate username format and try username lookup
                const usernameValidation = validateUsername(credentials.username);
                if (usernameValidation.isValid) {
                  user = await getUserByUsername(credentials.username, siteId);
                  console.log('User found by username:', !!user);
                }
              }

              if (!user || !user.password) {
                return null;
              }

              // Verify password
              const isValidPassword = await verifyPassword(credentials.password, user.password);
              if (!isValidPassword) {
                return null;
              }

              // Update lastLogin timestamp
              try {
                await updateUser(user.id, {
                  lastLogin: new Date(),
                  lastLoginIp: pageData?.ip || null
                });
              } catch (error) {
                console.error('Failed to update lastLogin:', error);
              }

              // Return user object for session
              return {
                id: user.id,
                email: user.email,
                username: user.username,
                name: user.name,
                role: user.role || 'user',
                roles: user.roles || [user.role || 'user'],
                siteId: user.siteId
              };
            } catch (error) {
              console.error('Auth error:', error);
              return null;
            }
          }
        })
      ] : []),

      // Email Provider
      ...(settings.providers?.email?.enabled ? [
        EmailProvider({
          server: {
            host: settings.providers.email.server?.host || process.env.EMAIL_SERVER_HOST,
            port: settings.providers.email.server?.port || process.env.EMAIL_SERVER_PORT,
            auth: {
              user: settings.providers.email.server?.auth?.user || process.env.EMAIL_SERVER_USER,
              pass: settings.providers.email.server?.auth?.pass || process.env.EMAIL_SERVER_PASSWORD
            }
          },
          from: settings.providers.email.from || process.env.EMAIL_FROM,
          ...settings.providers.email  
        })
      ] : []),

      // Google Provider
      ...(settings.providers?.google?.enabled && settings.providers.google.clientId ? [
        GoogleProvider({
          clientId: settings.providers.google.clientId,
          clientSecret: settings.providers.google.clientSecret,
        })
      ] : []),

      // GitHub Provider
      ...(settings.providers?.github?.enabled && settings.providers.github.clientId ? [
        GitHubProvider({
          clientId: settings.providers.github.clientId,
          clientSecret: settings.providers.github.clientSecret,
        })
      ] : []),

    ];

  authOptions.callbacks = {
      async signIn({ user, account, profile, email }) {
        // For credentials and verification-code providers, user is already authenticated
        if (account?.provider === 'credentials' || account?.provider === 'verification-code') {
          return true;
        }

        // For OAuth providers, check/create user in database
        const existingUser = await db.collection('users').findOne({
          email: user.email,
          siteId: siteId
        });

        if (!existingUser) {
          // Create new user for OAuth providers
          await db.collection('users').insertOne({
            email: user.email,
            name: user.name || '',
            username: user.email.split('@')[0], // Generate username from email
            role: 'user',
            roles: ['user'],
            siteId: siteId,
            emailVerified: account?.provider !== 'credentials', // OAuth users are pre-verified
            lastLogin: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          // Update lastLogin for existing OAuth users
          await db.collection('users').updateOne(
            { _id: existingUser._id },
            {
              $set: {
                lastLogin: new Date(),
                updatedAt: new Date()
              }
            }
          );
        }

        return true;
      },
      async session({ session, user, token }) {
        // Debug only when needed
        // console.log('Session callback - token:', token);
        // console.log('Session callback - session:', session);
        // console.log('Session callback - user:', user);

        // For JWT strategy (credentials provider), use token data
        if (token) {
          session.user = {
            id: token.sub,
            email: token.email,
            username: token.username,
            name: token.name,
            image: token.image || null,
            role: token.role || 'user',
            roles: token.roles || [token.role || 'user'],
            siteId: token.siteId,
            customFields: token.customFields || {}
          };
        } else if (user) {
          // For database strategy, use user data
          session.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            image: user.image || null,
            role: user.role || 'user',
            roles: user.roles || [user.role || 'user'],
            siteId: user.siteId,
            customFields: user.customFields || {}
          };
        }

        return session;
      },
      async jwt({ token, user, account, profile, trigger }) {
        // console.log('JWT callback - user:', user, 'trigger:', trigger);
        if (user) {
          // Initial sign in
          token.id = user.id;
          token.email = user.email;
          token.username = user.username;
          token.name = user.name;
          token.image = user.image || null;
          token.role = user.role;
          token.roles = user.roles || [user.role || 'user'];
          token.customFields = user.customFields || {};
          // Use the user's actual siteId from database, not the calculated one
          token.siteId = user.siteId || siteId;
        }

        // On session update or token refresh, fetch fresh user data from database
        // This ensures profile updates (image, name, customFields) are reflected
        if (trigger === 'update' || (!user && token.sub)) {
          try {
            const { getUserById } = await import('./lib');
            const freshUser = await getUserById(token.sub);
            if (freshUser) {
              token.name = freshUser.name;
              token.username = freshUser.username;
              token.image = freshUser.image || null;
              token.role = freshUser.role;
              token.roles = freshUser.roles || [freshUser.role || 'user'];
              token.customFields = freshUser.customFields || {};
            }
          } catch (error) {
            // Silently fail - use cached token data
            logger.debug('Failed to refresh user data for JWT', { error: error.message });
          }
        }

        return token;
      }
    };

  authOptions.pages = {
    signIn: '/auth/login',
    error: '/auth/error',
    signOut: '/auth/logout'
  };

  authOptions.events = {
    // 🔔 Emit auth:login event on successful sign-in (fire-and-forget, non-blocking)
    async signIn({ user, account, profile, isNewUser }) {
      try {
        const { emitWorkerEvent, FRAMEWORK_EVENTS } = await import('../worker/events.js');
        emitWorkerEvent({
          siteId,
          domain,
          eventName: FRAMEWORK_EVENTS.AUTH_LOGIN,
          payload: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name
            },
            provider: account?.provider || 'credentials',
            isNewUser: !!isNewUser,
            timestamp: new Date().toISOString()
          },
          userId: user.id
        }).catch(err => {
          // Don't fail login if event emission fails
          console.warn('[Auth] Failed to emit auth:login event:', err.message);
        });
      } catch (err) {
        // Module load error - worker system might not be initialized
        console.debug('[Auth] Worker event system not available:', err.message);
      }
    },
    async signOut() {},
    async createUser() {},
    async updateUser() {},
    async linkAccount() {},
    async session() {}
  };

  authOptions.debug = false;  // Disable debug to reduce session callback spam

  logger.debug('Auth options built', {
    cacheKey,
    providersCount: authOptions.providers?.length || 0,
    hasAdapter: !!authOptions.adapter
  });

  return authOptions;
});

/**
 * Create NextAuth options with server-side caching
 *
 * SECURITY FEATURES:
 * - Server-side ONLY caching (never client-side)
 * - Uses React cache() for per-request deduplication
 * - Cache key based on safe identifiers (domain) not secrets
 * - Respects development mode for fresh config
 * - No sensitive data in logs or cache keys
 *
 * PERFORMANCE:
 * - Eliminates 3 calls × 5s = 15s waste
 * - Uses React's cache() for automatic per-request deduplication
 * - Cache automatically cleared at end of request
 *
 * @param {Object} pageData - Page data containing domain/auth config
 * @returns {Promise<Object>} NextAuth options
 */
export async function createAuthOptions(pageData) {
  // SECURITY: Generate cache key from safe identifiers only
  // Use domain (safe) not secrets/credentials
  const domain = pageData?.domain || pageData?.host || 'default';

  // Remove port for consistency
  const cleanDomain = domain.includes(':') ? domain.split(':')[0] : domain;

  // Check if JasonJS dev mode is active (cache-based, per-IP)
  let isDev = false;
  try {
    const headersList = await headers();
    const clientIp = getClientIp(headersList);
    isDev = await isDevModeActive(cleanDomain, clientIp);
  } catch (error) {
    // Silently fallback if headers not available (build time, etc.)
    isDev = false;
  }

  // SECURITY: In dev mode, use timestamp to bypass cache for fresh config
  // This ensures developers see config changes immediately
  const cacheKey = isDev ? `auth:${cleanDomain}:${Date.now()}` : `auth:${cleanDomain}`;

  logger.debug('Creating auth options', {
    domain: cleanDomain,
    isDev,
    cacheKey: isDev ? 'bypassed' : cacheKey
  });

  // Use cached internal function (React cache handles deduplication)
  return createAuthOptionsInternal(cacheKey, pageData);
}
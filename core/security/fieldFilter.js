// core/security/fieldFilter.js
// Shared security field filtering utilities

// Security levels that require no session. Anything not listed here needs auth,
// so a typo in a level name fails closed rather than opening the database.
const PUBLIC_LEVELS = new Set(['public']);

/**
 * Normalize a security rule to its object form.
 *
 * Both spellings appear in the wild and in our own docs:
 *   { "read": "admin" }              <- string form
 *   { "read": { "level": "admin" } } <- object form
 *
 * The string form used to fall through validateSecurityLevel's `!security.level`
 * guard and return unvalidated, so `{"read": "admin"}` silently meant "public".
 * That exposed cat_miembros (269 emails, 268 WhatsApp numbers) to anonymous GETs.
 * Accept both spellings and treat them identically.
 */
export function normalizeSecurityRule(security) {
  if (security === null || security === undefined) return null;
  if (typeof security === 'string') return { level: security };
  if (typeof security === 'object' && typeof security.level === 'string') return security;

  // Some other shape (a bare object, an array, a number). We cannot tell what was
  // meant, so treat it as a declared-but-unreadable rule and fail closed.
  return { level: '__malformed__', __original: security };
}

// Validate specific security level
// SECURITY: For admin checks, this should be followed by database verification
export function validateSecurityLevel(security, session) {
  const rule = normalizeSecurityRule(security);

  // No rule at all: the caller decides. validateSecurity() never passes null here
  // for a write, so this only reaches reads with no declared policy.
  if (!rule) return security || true;

  security = rule;

  // SECURITY NOTE: This is a preliminary check based on session
  // For admin-level access, the calling code should verify with database
  // We check session.user.role and session.user.roles for initial validation
  const sessionRoles = Array.isArray(session?.user?.roles)
    ? session.user.roles
    : [session?.user?.role || 'user'];
  const isAdmin = sessionRoles.includes('admin') || session?.user?.isAdmin;

  switch (security.level) {
    case 'public':
      // Anyone can access
      return security;

    case 'authenticated':
    case 'user':
      // User must be logged in (or be admin)
      if (!session && !isAdmin) throw new Error('Authentication required');
      return security;

    case 'owner':
      // User must be logged in and will be checked later against record (or be admin)
      if (!session?.user?.id && !isAdmin) throw new Error('Authentication required');
      return security;

    case 'admin':
      // User must be admin
      // NOTE: This checks session only. For page-level auth, authorizeUser()
      // will verify with database. For API calls, implement database check.
      if (!session?.user?.id) throw new Error('Authentication required');
      if (!isAdmin) {
        throw new Error('Admin access required');
      }
      return security;

    case 'system':
      // Only system/internal calls allowed (even admins can't access)
      throw new Error('This operation is restricted to system use only');

    case 'never':
      // Documented in docs/databases.md for fields like password. Nobody gets it.
      throw new Error('This operation is not permitted');

    default:
      // Unknown or malformed level. Fail closed: an unrecognised level must never
      // be more permissive than the strictest one the author might have meant.
      if (!isAdmin) {
        throw new Error('Access denied: unrecognised security level');
      }
      return security;
  }
}

// Validate security rules for a specific operation
export function validateSecurity(database, method, session) {
  const operationType = getOperationType(method);
  const security = database.security?.[operationType];

  if (!security) {
    // No specific rule for this operation, check if there's a general write rule
    if (operationType !== 'read' && database.security?.write) {
      return validateSecurityLevel(database.security.write, session);
    }

    // SECURITY: writes default to closed.
    //
    // This used to return null ("no rule, nothing to filter") for every
    // operation, which meant a database declaring only `read` left create,
    // update and delete wide open to anonymous requests. Declaring a read
    // policy and saying nothing about writes is the common case, so the common
    // case was an unauthenticated write endpoint.
    //
    // Reads keep the permissive default: an undeclared read policy has always
    // meant public, and pages rely on that. Only mutations change behaviour.
    if (operationType !== 'read') {
      const sessionRoles = Array.isArray(session?.user?.roles)
        ? session.user.roles
        : [session?.user?.role || 'user'];
      const isAdmin = sessionRoles.includes('admin') || session?.user?.isAdmin;

      if (!session?.user?.id && !isAdmin) {
        throw new Error('Authentication required');
      }
      return { level: 'authenticated', __implicit: true };
    }

    return null; // Return null to indicate no filtering needed
  }

  return validateSecurityLevel(security, session);
}

// Map HTTP methods to database operations
function getOperationType(method) {
  //console.log('🔍 Raw method input:', method, 'Type:', typeof method);
  const processedMethod = method?.toUpperCase?.() || method;
  //console.log('🔍 Processed method:', processedMethod);
  
  switch (processedMethod) {
    case 'GET':
    case 'READ':
    case 'FETCH': 
      return 'read';
    case 'POST':
    case 'CREATE':
      return 'create';
    case 'PUT': 
    case 'PATCH':
    case 'UPDATE':
      return 'update';
    case 'DELETE':
      return 'delete';
    default: 
      return 'write';
  }
}

// Filter fields based on security rules
export function filterFields(data, allowedFields) {
  // Empty array or no allowedFields means no filtering (allow all)
  if (!allowedFields || !data || allowedFields.length === 0) return data;

  if (Array.isArray(data)) {
    return data.map(item => filterFields(item, allowedFields));
  }

  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([key]) => allowedFields.includes(key))
    );
  }

  return data;
}

// Apply security field filtering to data
// NOTE: This function only filters FIELDS — it does NOT re-validate access level.
// Access-level validation (public/authenticated/owner/admin) must be done upstream
// by the caller (e.g., API route validateSecurity, page auth middleware).
export function applySecurityFiltering(data, database, session, operation = 'read') {
  // ⚠️ ADMIN BYPASS: Admin users see all fields regardless of security.read.fields
  const userRole = session?.user?.role;
  if (userRole === 'admin') {
    return data; // Return all fields for admin users
  }

  try {
    // Extract field restrictions directly from database security config
    // without re-validating the access level (that's the caller's job)
    const operationType = getOperationType(operation);
    const security = database.security?.[operationType];
    const allowedFields = security?.fields || null;
    const result = allowedFields ? filterFields(data, allowedFields) : data;

    return result;
  } catch (error) {
    // Field filtering should never fail, but if it does, log and return data as-is
    console.error('🚨 Security filtering error:', error.message);
    return data;
  }
}
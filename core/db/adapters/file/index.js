// core/databases/file/index.js
//
// File-backed JSON store — the zero-config default for app.db.
//
// When MONGODB_URI is not set, the 'jason' database type is served by this
// adapter instead of MongoDB (see the connector map in core/database.js).
// Records live in one JSON file per collection:
//
//   <SITES_PATH>/<domain>/data/<collection>.json   (array of records)
//
// Conventions match the jason (MongoDB) adapter exactly so swapping stores
// never changes app code: string `_id` (mirrored as `id`), `createdAt` /
// `updatedAt` timestamps, `created_by` / `updated_by` when a user is known,
// soft deletes via `deletedAt`.
//
// Supported: add/get/find with equality + basic operator filters (both the
// fluent forms `gt/gte/lt/lte/in/nin/ne/not/contains/starts_with/ends_with`
// and their Mongo `$` equivalents), $or/$and, sort, limit, skip, update,
// delete (hard or soft), count.
//
// Not supported (throws a clear error): joins, full-text search, geospatial
// queries, real-time subscriptions. Set MONGODB_URI to enable them.

import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import { randomUUID } from 'crypto';
import { createDatabaseLogger } from '../../../utils/tenantLog.js';
import {
  encryptFieldsForWrite,
  decryptFieldsForRead,
  assertNoEncryptedFieldInFilter,
} from '../../../utils/crypto.js';
import { applySchemaDefaults, validateSchema } from '../jason/index.js';

// Refuse to grow a collection file beyond this size (bytes).
const MAX_COLLECTION_BYTES = 10 * 1024 * 1024; // 10MB

function requiresMongo(operation) {
  return new Error(`${operation} requires MongoDB — set MONGODB_URI to enable it`);
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function sanitizeName(name, what) {
  if (!name) {
    throw new Error(`${what} is required for file database operations`);
  }
  const sanitized = name
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_')
    .replace(/\.\.+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');
  if (!sanitized) {
    throw new Error(`Invalid ${what}: "${name}"`);
  }
  return sanitized;
}

/**
 * Resolve the JSON file backing a collection for this site.
 * Layout: <SITES_PATH>/<domain>/data/<collection>.json
 */
function getCollectionFile(databaseConfig) {
  const { domain, siteId, id: databaseId, collection, config } = databaseConfig;

  const site = sanitizeName(domain || siteId, 'Site identifier');
  const rawCollection = collection || config?.collection || databaseId;
  const col = sanitizeName(rawCollection, 'Collection name');

  const sitesPath = resolve(process.env.SITES_PATH || './sites');
  const file = resolve(join(sitesPath, site, 'data', `${col}.json`));

  // Defense in depth: the file must stay inside the sites directory.
  if (!file.startsWith(sitesPath + sep)) {
    throw new Error(`Invalid data file path for collection "${rawCollection}"`);
  }

  return file;
}

// ---------------------------------------------------------------------------
// Read / write with per-file write serialization + atomic writes
// ---------------------------------------------------------------------------

// In-process promise queue per file so concurrent read-modify-write cycles
// never interleave.
const writeQueues = new Map();

function withFileLock(file, fn) {
  const prev = writeQueues.get(file) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  writeQueues.set(file, next);
  // Clean the queue entry once settled (best-effort, avoids unbounded growth)
  next.catch(() => {}).finally(() => {
    if (writeQueues.get(file) === next) writeQueues.delete(file);
  });
  return next;
}

async function readCollection(file) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (!raw.trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Data file is not valid JSON: ${file}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Data file must contain a JSON array of records: ${file}`);
  }
  return parsed;
}

async function writeCollection(file, records, databaseConfig) {
  const serialized = JSON.stringify(records, null, 2);

  if (Buffer.byteLength(serialized, 'utf8') > MAX_COLLECTION_BYTES) {
    throw new Error(
      `Collection "${databaseConfig.id}" would exceed 10MB — use MongoDB for datasets this large (set MONGODB_URI)`
    );
  }

  // Atomic write: temp file in the same directory, then rename.
  await fs.mkdir(join(file, '..'), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, serialized, 'utf8');
  try {
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.unlink(tmp).catch(() => {});
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Filter matching
// ---------------------------------------------------------------------------

// Operator aliases: fluent (QueryBuilder) names and Mongo `$` forms.
const OPERATORS = new Set([
  'gt', '$gt', 'gte', '$gte', 'lt', '$lt', 'lte', '$lte',
  'in', '$in', 'nin', '$nin', 'ne', 'not', '$ne',
  'contains', 'starts_with', 'ends_with',
  '$regex', '$options', '$exists', '$eq',
]);

const GEO_OPERATORS = ['nearBy', 'withinGeometry', 'withinCircle', 'withinBounds', '$near', '$geoWithin'];

/** Normalize values so comparisons work across Date objects and ISO strings. */
function comparable(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function compare(a, b) {
  a = comparable(a);
  b = comparable(b);
  if (a === b) return 0;
  if (a === undefined || a === null) return b === undefined || b === null ? 0 : -1;
  if (b === undefined || b === null) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function looseEquals(a, b) {
  a = comparable(a);
  b = comparable(b);
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/** Read a possibly-nested field ("a.b.c") from a record. */
function getFieldValue(record, field) {
  if (!field.includes('.')) return record[field];
  return field.split('.').reduce((v, key) => (v == null ? undefined : v[key]), record);
}

function isOperatorObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => OPERATORS.has(k));
}

function matchOperators(recordValue, operators) {
  for (const [op, expected] of Object.entries(operators)) {
    switch (op) {
      case 'gt': case '$gt':
        if (!(compare(recordValue, expected) > 0)) return false;
        break;
      case 'gte': case '$gte':
        if (!(compare(recordValue, expected) >= 0)) return false;
        break;
      case 'lt': case '$lt':
        if (!(compare(recordValue, expected) < 0)) return false;
        break;
      case 'lte': case '$lte':
        if (!(compare(recordValue, expected) <= 0)) return false;
        break;
      case 'in': case '$in':
        if (!Array.isArray(expected) || !expected.some((v) => looseEquals(recordValue, v))) return false;
        break;
      case 'nin': case '$nin':
        if (Array.isArray(expected) && expected.some((v) => looseEquals(recordValue, v))) return false;
        break;
      case 'ne': case 'not': case '$ne':
        if (looseEquals(recordValue, expected)) return false;
        break;
      case 'contains':
        if (typeof recordValue !== 'string' ||
            !recordValue.toLowerCase().includes(String(expected).toLowerCase())) return false;
        break;
      case 'starts_with':
        if (typeof recordValue !== 'string' ||
            !recordValue.toLowerCase().startsWith(String(expected).toLowerCase())) return false;
        break;
      case 'ends_with':
        if (typeof recordValue !== 'string' ||
            !recordValue.toLowerCase().endsWith(String(expected).toLowerCase())) return false;
        break;
      case '$regex': {
        if (typeof recordValue !== 'string') return false;
        try {
          const source = expected instanceof RegExp ? expected.source : String(expected);
          const flags = expected instanceof RegExp ? expected.flags : (operators.$options || '');
          if (!new RegExp(source, flags).test(recordValue)) return false;
        } catch {
          return false;
        }
        break;
      }
      case '$options':
        break; // consumed by $regex
      case '$exists': {
        const exists = recordValue !== undefined;
        if (exists !== !!expected) return false;
        break;
      }
      case '$eq':
        if (!looseEquals(recordValue, expected)) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

function matchFilters(record, filters) {
  for (const [key, value] of Object.entries(filters)) {
    // Logical operators
    if (key === '$or') {
      if (!Array.isArray(value) || !value.some((f) => matchFilters(record, f))) return false;
      continue;
    }
    if (key === '$and') {
      if (!Array.isArray(value) || !value.every((f) => matchFilters(record, f))) return false;
      continue;
    }
    if (key.startsWith('$')) {
      throw requiresMongo(`Query operator "${key}"`);
    }

    // Geospatial filters are MongoDB-only
    if (value && typeof value === 'object' && GEO_OPERATORS.some((g) => g in value)) {
      throw requiresMongo('Geospatial queries (nearBy/within*)');
    }

    // ID matching: accept both id and _id, string-compare
    if (key === '_id' || key === 'id') {
      if (String(record._id) !== String(value)) return false;
      continue;
    }

    const recordValue = getFieldValue(record, key);

    if (isOperatorObject(value)) {
      if (!matchOperators(recordValue, value)) return false;
    } else if (Array.isArray(recordValue) && !Array.isArray(value)) {
      // Mongo semantics: scalar filter matches array elements
      if (!recordValue.some((v) => looseEquals(v, value))) return false;
    } else if (!looseEquals(recordValue, value)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function normalizeSortDirection(v) {
  if (v === -1 || v === '-1') return -1;
  if (v === 1 || v === '1') return 1;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'desc' || s === 'descending') return -1;
    if (s === 'asc' || s === 'ascending') return 1;
  }
  return 1;
}

function applySort(records, sort) {
  const entries = Object.entries(sort).map(([field, dir]) => [field, normalizeSortDirection(dir)]);
  if (entries.length === 0) return records;
  return [...records].sort((a, b) => {
    for (const [field, dir] of entries) {
      const c = compare(getFieldValue(a, field), getFieldValue(b, field));
      if (c !== 0) return c * dir;
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Record helpers (match the jason adapter's conventions)
// ---------------------------------------------------------------------------

function transformDocument(doc) {
  if (!doc) return null;
  return { ...doc, id: doc._id };
}

function isDeleted(record) {
  return record.deletedAt !== undefined && record.deletedAt !== null;
}

function selectRecords(records, query, databaseConfig) {
  if (databaseConfig.joins && databaseConfig.joins.length > 0 && !query.disableJoins) {
    throw requiresMongo('Database joins');
  }
  if (query.search) {
    throw requiresMongo('Full-text search');
  }
  if (query.nearBy) {
    throw requiresMongo('Geospatial queries (nearBy)');
  }

  const filters = query.filters || query.query || {};
  assertNoEncryptedFieldInFilter(filters, databaseConfig.schema);

  return records.filter((record) => {
    if (!query.includeDeleted && isDeleted(record)) return false;
    return matchFilters(record, filters);
  });
}

// ---------------------------------------------------------------------------
// Adapter operations (same surface as core/databases/jason)
// ---------------------------------------------------------------------------

export async function fetchData(query, databaseConfig) {
  const logger = createDatabaseLogger(databaseConfig);
  try {
    const file = getCollectionFile(databaseConfig);
    const records = await readCollection(file);

    let results = selectRecords(records, query, databaseConfig);

    if (query.sort && Object.keys(query.sort).length > 0) {
      results = applySort(results, query.sort);
    }
    if (query.skip) {
      results = results.slice(parseInt(query.skip));
    }
    if (query.limit) {
      results = results.slice(0, parseInt(query.limit));
    }

    return results.map((doc) =>
      transformDocument(decryptFieldsForRead(doc, databaseConfig.schema))
    );
  } catch (error) {
    logger.database.error(databaseConfig.id, 'fetch', error);
    throw error;
  }
}

export async function countData(query, databaseConfig) {
  const logger = createDatabaseLogger(databaseConfig);
  try {
    const file = getCollectionFile(databaseConfig);
    const records = await readCollection(file);
    return selectRecords(records, query, databaseConfig).length;
  } catch (error) {
    logger.database.error(databaseConfig.id, 'count', error);
    throw error;
  }
}

export async function createData(data, databaseConfig) {
  const logger = createDatabaseLogger(databaseConfig);
  try {
    const file = getCollectionFile(databaseConfig);
    const inputData = data.data || data;

    // Auto-inject userId if the schema requires it and a user is known
    if (databaseConfig.userId && databaseConfig.schema?.userId?.required && !inputData.userId) {
      inputData.userId = databaseConfig.userId;
    }

    if (databaseConfig.schema) {
      applySchemaDefaults(inputData, databaseConfig.schema);
      validateSchema(inputData, databaseConfig.schema);
    }

    const now = new Date().toISOString();
    const document = {
      _id: randomUUID(),
      ...inputData,
      createdAt: now,
      updatedAt: now,
    };

    if (databaseConfig.userId) {
      document.created_by = databaseConfig.userId;
      document.updated_by = databaseConfig.userId;
    }

    const encryptedDocument = encryptFieldsForWrite(document, databaseConfig.schema);

    await withFileLock(file, async () => {
      const records = await readCollection(file);
      records.push(encryptedDocument);
      await writeCollection(file, records, databaseConfig);
    });

    return transformDocument(decryptFieldsForRead(encryptedDocument, databaseConfig.schema));
  } catch (error) {
    logger.database.error(databaseConfig.id, 'create', error);
    throw error;
  }
}

export async function updateData(data, databaseConfig) {
  const logger = createDatabaseLogger(databaseConfig);
  try {
    const file = getCollectionFile(databaseConfig);
    const { id, fullRecord, ...updateFields } = data;

    if (!id) {
      throw new Error('ID is required for update operation');
    }

    const inputData = updateFields.data || updateFields;

    if (databaseConfig.schema) {
      if (fullRecord) {
        validateSchema(fullRecord, databaseConfig.schema, false);
      } else {
        validateSchema(inputData, databaseConfig.schema, true);
      }
    }

    const encryptedInput = encryptFieldsForWrite(inputData, databaseConfig.schema);

    const updatedDoc = await withFileLock(file, async () => {
      const records = await readCollection(file);
      const index = records.findIndex((r) => String(r._id) === String(id));
      if (index === -1) {
        throw new Error('Document not found or access denied');
      }

      const updated = {
        ...records[index],
        ...encryptedInput,
        updatedAt: new Date().toISOString(),
      };
      if (databaseConfig.userId) {
        updated.updated_by = databaseConfig.userId;
      }

      records[index] = updated;
      await writeCollection(file, records, databaseConfig);
      return updated;
    });

    return transformDocument(decryptFieldsForRead(updatedDoc, databaseConfig.schema));
  } catch (error) {
    logger.database.error(databaseConfig.id, 'update', error);
    throw error;
  }
}

export async function deleteData(data, databaseConfig) {
  const logger = createDatabaseLogger(databaseConfig);
  try {
    const file = getCollectionFile(databaseConfig);
    const id = data.id || data;

    if (!id) {
      throw new Error('ID is required for delete operation');
    }

    return await withFileLock(file, async () => {
      const records = await readCollection(file);
      const index = records.findIndex((r) => String(r._id) === String(id));
      if (index === -1) {
        throw new Error('Document not found or access denied');
      }

      const existing = records[index];

      if (databaseConfig.softDelete === true) {
        const now = new Date().toISOString();
        records[index] = { ...existing, deletedAt: now, updatedAt: now };
        await writeCollection(file, records, databaseConfig);
        return { id: existing._id, deleted: true, deletedAt: now };
      }

      records.splice(index, 1);
      await writeCollection(file, records, databaseConfig);
      return { id: existing._id, deleted: true };
    });
  } catch (error) {
    logger.database.error(databaseConfig.id, 'delete', error);
    throw error;
  }
}

// Note: searchData is intentionally NOT exported — Database.search() detects
// its absence and falls back to a `contains` query, which this adapter serves.

export async function subscribe() {
  throw requiresMongo('Real-time subscriptions');
}

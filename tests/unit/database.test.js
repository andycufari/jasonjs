// tests/unit/database.test.js - Unit tests for enhanced database API

import Database, { database } from '../../core/db';
import { Record } from '../../core/db/adapters/Record.js';
import { QueryBuilder } from '../../core/db/adapters/QueryBuilder.js';

// Mock configuration for testing
const mockDatabases = {
  users: {
    id: 'users',
    type: 'mongodb',
    config: {
      connection: 'mongodb://localhost:27017',
      database: 'test_app',
      collection: 'users'
    }
  },
  posts: {
    id: 'posts',
    type: 'notion',
    config: {
      api_key: 'mock_key',
      database_id: 'mock_database_id'
    }
  }
};

describe('Enhanced Database API', () => {
  
  describe('Factory Functions', () => {
    test('database() factory creates instance with correct database selection', () => {
      const db = database('users', mockDatabases);
      expect(db).toBeInstanceOf(Database);
      expect(db.selectedDatabase?.id).toBe('users');
    });

    test('database() factory without databaseId creates unselected instance', () => {
      const db = database(null, mockDatabases);
      expect(db).toBeInstanceOf(Database);
      expect(db.selectedDatabase).toBeNull();
    });
  });

  describe('Database Class - Fluid API', () => {
    let db;

    beforeEach(() => {
      db = new Database(mockDatabases);
    });

    test('use() method selects database and returns chainable instance', () => {
      const result = db.use('users');
      expect(result).toBe(db); // Should return same instance
      expect(db.selectedDatabase?.id).toBe('users');
    });

    test('query() method returns QueryBuilder instance', () => {
      db.use('users');
      const queryBuilder = db.query({ status: 'active' });
      expect(queryBuilder).toBeInstanceOf(QueryBuilder);
      expect(queryBuilder.filters).toEqual({ status: 'active' });
    });

    test('_isComplexQuery() correctly identifies complex queries', () => {
      expect(db._isComplexQuery({ status: 'active' })).toBe(false);
      expect(db._isComplexQuery({ and: [{ status: 'active' }] })).toBe(true);
      expect(db._isComplexQuery({ filter: { status: 'active' } })).toBe(true);
      expect(db._isComplexQuery({ $and: [{ status: 'active' }] })).toBe(true);
    });
  });

  describe('Environment Variable Resolution', () => {
    let db;

    beforeEach(() => {
      db = new Database(mockDatabases);
      // Set test environment variables
      process.env.TEST_MONGODB_URI = 'mongodb://test:27017/test';
      process.env.TEST_API_KEY = 'test_api_key_123';
    });

    afterEach(() => {
      delete process.env.TEST_MONGODB_URI;
      delete process.env.TEST_API_KEY;
    });

    test('replaceParams() resolves [[env.VARIABLE]] patterns', () => {
      const testObj = {
        connection: '[[env.TEST_MONGODB_URI]]',
        api_key: '[[env.TEST_API_KEY]]',
        normal_field: 'normal_value'
      };

      const resolved = db.replaceParams(testObj);

      expect(resolved.connection).toBe('mongodb://test:27017/test');
      expect(resolved.api_key).toBe('test_api_key_123');
      expect(resolved.normal_field).toBe('normal_value');
    });

    test('replaceParams() handles nested objects', () => {
      const testObj = {
        config: {
          database: {
            uri: '[[env.TEST_MONGODB_URI]]'
          }
        }
      };

      const resolved = db.replaceParams(testObj);
      expect(resolved.config.database.uri).toBe('mongodb://test:27017/test');
    });

    test('replaceParams() preserves non-matching patterns', () => {
      const testObj = {
        connection: '[[env.NON_EXISTENT_VAR]]',
        template: '{{params.someParam}}'
      };

      const resolved = db.replaceParams(testObj);
      expect(resolved.connection).toBe('[[env.NON_EXISTENT_VAR]]');
      expect(resolved.template).toBe('{{params.someParam}}');
    });
  });

  describe('Backward Compatibility', () => {
    let db;

    beforeEach(() => {
      db = new Database(mockDatabases);
    });

    test('Traditional API methods still exist and work', () => {
      expect(typeof db.select).toBe('function');
      expect(typeof db.fetch).toBe('function');
      expect(typeof db.create).toBe('function');
      expect(typeof db.update).toBe('function');
      expect(typeof db.delete).toBe('function');
      expect(typeof db.performOperation).toBe('function');
    });

    test('select() method works as before', () => {
      db.select('users');
      expect(db.selectedDatabase?.id).toBe('users');
      expect(db.selectedDatabase?.type).toBe('mongodb');
    });

    test('Traditional fetch() method returns expected format', async () => {
      // Mock the performOperation method
      db.performOperation = jest.fn().mockResolvedValue({
        success: true,
        data: [{ id: '1', name: 'Test User' }]
      });

      db.select('users');
      const result = await db.fetch({ status: 'active' });

      expect(db.performOperation).toHaveBeenCalledWith('fetchData', { status: 'active' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: '1', name: 'Test User' }]);
    });
  });
});

describe('QueryBuilder', () => {
  let mockDatabase;
  let queryBuilder;

  beforeEach(() => {
    mockDatabase = {
      performOperation: jest.fn().mockResolvedValue({
        success: true,
        data: [
          { id: '1', name: 'John', age: 25, status: 'active' },
          { id: '2', name: 'Jane', age: 30, status: 'active' }
        ]
      })
    };
    queryBuilder = new QueryBuilder(mockDatabase, 'users');
  });

  describe('Chainable Filter Methods', () => {
    test('gt() adds greater than filter', () => {
      const result = queryBuilder.gt('age', 18);
      expect(result).toBe(queryBuilder); // Chainable
      expect(queryBuilder.filters.age).toEqual({ gt: 18 });
    });

    test('lt() adds less than filter', () => {
      queryBuilder.lt('age', 65);
      expect(queryBuilder.filters.age).toEqual({ lt: 65 });
    });

    test('contains() adds contains filter', () => {
      queryBuilder.contains('name', 'john');
      expect(queryBuilder.filters.name).toEqual({ contains: 'john' });
    });

    test('in() adds in array filter', () => {
      queryBuilder.in('status', ['active', 'pending']);
      expect(queryBuilder.filters.status).toEqual({ in: ['active', 'pending'] });
    });

    test('Multiple filters on same field merge correctly', () => {
      queryBuilder.gt('age', 18).lt('age', 65);
      expect(queryBuilder.filters.age).toEqual({ gt: 18, lt: 65 });
    });
  });

  describe('Chainable Option Methods', () => {
    test('orderBy() sets sort options', () => {
      queryBuilder.orderBy('name', 'desc');
      expect(queryBuilder.options.sort).toEqual({ name: 'desc' });
    });

    test('limit() sets limit option', () => {
      queryBuilder.limit(10);
      expect(queryBuilder.options.limit).toBe(10);
    });

    test('skip() sets skip option', () => {
      queryBuilder.skip(5);
      expect(queryBuilder.options.skip).toBe(5);
    });
  });

  describe('Query Execution', () => {
    test('execute() calls database with correct query config', async () => {
      queryBuilder.gt('age', 18).orderBy('name').limit(10);
      
      await queryBuilder.execute();

      expect(mockDatabase.performOperation).toHaveBeenCalledWith('fetchData', {
        filters: { age: { gt: 18 } },
        sort: { name: 'asc' },
        limit: 10
      });
    });

    test('first() returns first result only', async () => {
      const result = await queryBuilder.first();
      
      expect(mockDatabase.performOperation).toHaveBeenCalledWith('fetchData', {
        filters: {},
        limit: 1
      });
      expect(result).toBeInstanceOf(Record);
      expect(result.id).toBe('1');
    });

    test('count() returns number of results', async () => {
      const count = await queryBuilder.count();
      expect(count).toBe(2);
    });

    test('exists() returns true when results exist', async () => {
      const exists = await queryBuilder.exists();
      expect(exists).toBe(true);
    });

    test('QueryBuilder is thenable (can be awaited directly)', async () => {
      const results = await queryBuilder.gt('age', 18);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
    });
  });

  describe('Utility Methods', () => {
    test('clone() creates independent copy', () => {
      queryBuilder.gt('age', 18).limit(10);
      const cloned = queryBuilder.clone();
      
      cloned.lt('age', 65).limit(20);
      
      expect(queryBuilder.filters).toEqual({ age: { gt: 18 } });
      expect(queryBuilder.options.limit).toBe(10);
      expect(cloned.filters).toEqual({ age: { gt: 18, lt: 65 } });
      expect(cloned.options.limit).toBe(20);
    });

    test('toQuery() returns raw query configuration', () => {
      queryBuilder.gt('age', 18).orderBy('name').limit(10);
      const config = queryBuilder.toQuery();
      
      expect(config).toEqual({
        filters: { age: { gt: 18 } },
        sort: { name: 'asc' },
        limit: 10
      });
    });
  });
});

describe('Record', () => {
  let mockDatabase;
  let record;

  beforeEach(() => {
    mockDatabase = {
      update: jest.fn().mockResolvedValue({
        success: true,
        data: { id: '1', name: 'Updated Name', age: 26 }
      }),
      delete: jest.fn().mockResolvedValue({ success: true })
    };

    record = new Record(
      { id: '1', name: 'John', age: 25 },
      mockDatabase,
      'users'
    );
  });

  describe('Property Access', () => {
    test('Direct property access works', () => {
      expect(record.name).toBe('John');
      expect(record.age).toBe(25);
      expect(record.id).toBe('1');
    });

    test('Property modification marks record as modified', () => {
      expect(record.isModified()).toBe(false);
      record.name = 'Jane';
      expect(record.isModified()).toBe(true);
      expect(record.name).toBe('Jane');
    });

    test('Method properties are not affected by proxy', () => {
      expect(typeof record.save).toBe('function');
      expect(typeof record.getValues).toBe('function');
    });
  });

  describe('Change Tracking', () => {
    test('getChanges() returns only modified fields', () => {
      record.name = 'Jane';
      record.age = 26;
      
      const changes = record.getChanges();
      expect(changes).toEqual({ name: 'Jane', age: 26 });
    });

    test('reset() reverts to original state', () => {
      record.name = 'Jane';
      expect(record.isModified()).toBe(true);
      
      record.reset();
      expect(record.isModified()).toBe(false);
      expect(record.name).toBe('John');
    });
  });

  describe('Database Operations', () => {
    test('save() calls database update with changes only', async () => {
      record.name = 'Jane';
      record.age = 26;
      
      const result = await record.save();
      
      expect(mockDatabase.update).toHaveBeenCalledWith({
        id: '1',
        data: { name: 'Jane', age: 26 }
      });
      expect(result).toBe(record);
      expect(record.isModified()).toBe(false);
    });

    test('save() does nothing when no changes', async () => {
      const result = await record.save();
      
      expect(mockDatabase.update).not.toHaveBeenCalled();
      expect(result).toBe(record);
    });

    test('delete() calls database delete', async () => {
      const result = await record.delete();
      
      expect(mockDatabase.delete).toHaveBeenCalledWith({ id: '1' });
      expect(result).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    test('getValues() returns copy of all data', () => {
      const values = record.getValues();
      expect(values).toEqual({ id: '1', name: 'John', age: 25 });
      
      // Modifying returned values shouldn't affect record
      values.name = 'Modified';
      expect(record.name).toBe('John');
    });

    test('getJSON() returns JSON string representation', () => {
      const json = record.getJSON();
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ id: '1', name: 'John', age: 25 });
    });
  });
});
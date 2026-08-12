// tests/unit/client-database.test.js - Unit tests for client-side database API

import { DatabaseClient } from '../../core/client/db';
import { ClientQueryBuilder } from '../../core/client/QueryBuilder.js';
import { ClientRecord } from '../../core/client/Record.js';

// Mock fetch for testing
global.fetch = jest.fn();

describe('DatabaseClient', () => {
  let client;

  beforeEach(() => {
    client = new DatabaseClient('test-db');
    jest.clearAllMocks();
  });

  describe('Basic Operations', () => {
    test('constructor sets database ID', () => {
      expect(client.databaseId).toBe('test-db');
    });

    test('_fetch() makes correct API calls for GET requests', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData })
      });

      const result = await client._fetch('GET', { status: 'active' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/data/test-db?status=active',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      expect(result).toEqual(mockData);
    });

    test('_fetch() makes correct API calls for POST requests', async () => {
      const mockData = { id: '1', name: 'Created' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData })
      });

      const testData = { name: 'New Item' };
      const result = await client._fetch('POST', testData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/data/test-db',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        }
      );
      expect(result).toEqual(mockData);
    });

    test('_fetch() handles API errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Database error' })
      });

      await expect(client._fetch('GET')).rejects.toThrow('Database error');
    });
  });

  describe('Fluid API Methods', () => {
    test('add() creates record and returns ClientRecord', async () => {
      const mockData = { id: '1', name: 'Created' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData })
      });

      const result = await client.add({ name: 'New Item' });

      expect(result).toBeInstanceOf(ClientRecord);
      expect(result.name).toBe('Created');
      expect(result.id).toBe('1');
    });

    test('getById() returns ClientRecord for found item', async () => {
      const mockData = [{ id: '1', name: 'Found' }];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData })
      });

      const result = await client.getById('1');

      expect(result).toBeInstanceOf(ClientRecord);
      expect(result.id).toBe('1');
      expect(result.name).toBe('Found');
    });

    test('getById() returns null for not found item', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      const result = await client.getById('999');
      expect(result).toBeNull();
    });

    test('deleteById() returns success status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await client.deleteById('1');
      expect(result).toBe(true);
    });

    test('deleteById() handles errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.deleteById('1');
      expect(result).toBe(false);
    });

    test('query() returns ClientQueryBuilder instance', () => {
      const queryBuilder = client.query({ status: 'active' });
      
      expect(queryBuilder).toBeInstanceOf(ClientQueryBuilder);
      expect(queryBuilder.filters).toEqual({ status: 'active' });
      expect(queryBuilder.databaseClient).toBe(client);
    });

    test('fetchRecords() returns wrapped ClientRecord instances', async () => {
      const mockData = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockData })
      });

      const result = await client.fetchRecords({ status: 'active' });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(ClientRecord);
      expect(result[1]).toBeInstanceOf(ClientRecord);
    });
  });

  describe('Real-time Subscriptions', () => {
    let mockEventSource;

    beforeEach(() => {
      // Mock EventSource
      mockEventSource = {
        onmessage: null,
        onerror: null,
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
      
      global.EventSource = jest.fn().mockImplementation(() => mockEventSource);
    });

    test('subscribe() creates EventSource with correct URL', () => {
      const callback = jest.fn();
      const subscription = client.subscribe({ status: 'active' }, callback);

      expect(global.EventSource).toHaveBeenCalledWith(
        '/api/data/test-db/subscribe?filter_status=active'
      );
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    test('subscribe() handles incoming messages', () => {
      const callback = jest.fn();
      client.subscribe({ status: 'active' }, callback);

      // Simulate incoming message
      const testData = { type: 'create', data: { id: '1', name: 'New Item' } };
      mockEventSource.onmessage({ data: JSON.stringify(testData) });

      expect(callback).toHaveBeenCalledWith(testData);
    });

    test('subscribe() handles JSON parsing errors', () => {
      const callback = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      client.subscribe({ status: 'active' }, callback);

      // Simulate malformed message
      mockEventSource.onmessage({ data: 'invalid json' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing subscription data:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('subscribe() handles connection errors', () => {
      const callback = jest.fn();
      client.subscribe({ status: 'active' }, callback);

      // Simulate connection error
      mockEventSource.onerror(new Error('Connection failed'));

      expect(callback).toHaveBeenCalledWith({
        type: 'error',
        error: 'Subscription connection error'
      });
    });

    test('unsubscribe() closes EventSource', () => {
      const callback = jest.fn();
      const subscription = client.subscribe({ status: 'active' }, callback);

      subscription.unsubscribe();

      expect(mockEventSource.close).toHaveBeenCalled();
    });
  });
});

describe('ClientQueryBuilder', () => {
  let mockClient;
  let queryBuilder;

  beforeEach(() => {
    mockClient = {
      _fetch: jest.fn().mockResolvedValue([
        { id: '1', name: 'John', age: 25 },
        { id: '2', name: 'Jane', age: 30 }
      ])
    };
    queryBuilder = new ClientQueryBuilder(mockClient, { status: 'active' });
  });

  describe('Chainable Methods', () => {
    test('Filter methods are chainable and modify filters', () => {
      const result = queryBuilder
        .gt('age', 18)
        .lt('age', 65)
        .contains('name', 'john');

      expect(result).toBe(queryBuilder);
      expect(queryBuilder.filters).toEqual({
        status: 'active',
        age: { gt: 18, lt: 65 },
        name: { contains: 'john' }
      });
    });

    test('Option methods are chainable and modify options', () => {
      queryBuilder.orderBy('name', 'desc').limit(10).skip(5);

      expect(queryBuilder.options).toEqual({
        sort: { name: 'desc' },
        limit: 10,
        skip: 5
      });
    });
  });

  describe('Query Execution', () => {
    test('execute() calls client with correct parameters', async () => {
      queryBuilder.gt('age', 18).limit(10);
      
      await queryBuilder.execute();

      expect(mockClient._fetch).toHaveBeenCalledWith('GET', {
        filters: { status: 'active', age: { gt: 18 } },
        limit: 10
      });
    });

    test('execute() returns ClientRecord instances', async () => {
      const results = await queryBuilder.execute();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0]).toBeInstanceOf(ClientRecord);
      expect(results[0].name).toBe('John');
    });

    test('first() returns single ClientRecord', async () => {
      const result = await queryBuilder.first();

      expect(mockClient._fetch).toHaveBeenCalledWith('GET', {
        filters: { status: 'active' },
        limit: 1
      });
      expect(result).toBeInstanceOf(ClientRecord);
      expect(result.name).toBe('John');
    });

    test('first() restores original limit after execution', async () => {
      queryBuilder.limit(5);
      await queryBuilder.first();

      expect(queryBuilder.options.limit).toBe(5);
    });

    test('count() returns number of results', async () => {
      const count = await queryBuilder.count();
      expect(count).toBe(2);
    });

    test('exists() returns true when results exist', async () => {
      const exists = await queryBuilder.exists();
      expect(exists).toBe(true);
    });

    test('exists() returns false when no results', async () => {
      mockClient._fetch.mockResolvedValueOnce([]);
      const exists = await queryBuilder.exists();
      expect(exists).toBe(false);
    });

    test('QueryBuilder is thenable', async () => {
      const results = await queryBuilder;
      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toBeInstanceOf(ClientRecord);
    });
  });

  describe('Utility Methods', () => {
    test('clone() creates independent copy', () => {
      queryBuilder.gt('age', 18).limit(10);
      const cloned = queryBuilder.clone();
      
      cloned.lt('age', 65).limit(20);
      
      expect(queryBuilder.options.limit).toBe(10);
      expect(cloned.options.limit).toBe(20);
    });

    test('toQuery() returns configuration object', () => {
      queryBuilder.gt('age', 18).orderBy('name').limit(10);
      const config = queryBuilder.toQuery();
      
      expect(config).toEqual({
        filters: { status: 'active', age: { gt: 18 } },
        sort: { name: 'asc' },
        limit: 10
      });
    });
  });
});

describe('ClientRecord', () => {
  let mockClient;
  let record;

  beforeEach(() => {
    mockClient = {
      update: jest.fn().mockResolvedValue({ id: '1', name: 'Updated', age: 26 }),
      delete: jest.fn().mockResolvedValue(true),
      fetch: jest.fn().mockResolvedValue([{ id: '1', name: 'Reloaded', age: 25 }])
    };
    
    record = new ClientRecord(
      { id: '1', name: 'John', age: 25 },
      mockClient
    );
  });

  describe('Property Access and Modification', () => {
    test('Property access works through proxy', () => {
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

    test('getChanges() returns only modified fields', () => {
      record.name = 'Jane';
      record.age = 26;
      
      const changes = record.getChanges();
      expect(changes).toEqual({ name: 'Jane', age: 26 });
    });
  });

  describe('Database Operations', () => {
    test('save() calls client update with changes', async () => {
      record.name = 'Jane';
      record.age = 26;
      
      const result = await record.save();
      
      expect(mockClient.update).toHaveBeenCalledWith('1', { name: 'Jane', age: 26 });
      expect(result).toBe(record);
      expect(record.isModified()).toBe(false);
    });

    test('save() skips call when no changes', async () => {
      const result = await record.save();
      
      expect(mockClient.update).not.toHaveBeenCalled();
      expect(result).toBe(record);
    });

    test('delete() calls client delete', async () => {
      const result = await record.delete();
      
      expect(mockClient.delete).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });

    test('reload() refreshes data from client', async () => {
      record.name = 'Modified';
      
      const result = await record.reload();
      
      expect(mockClient.fetch).toHaveBeenCalledWith({ id: '1' });
      expect(result).toBe(record);
      expect(record.name).toBe('Reloaded');
      expect(record.isModified()).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    test('getValues() returns data copy', () => {
      const values = record.getValues();
      expect(values).toEqual({ id: '1', name: 'John', age: 25 });
      
      // Modifying returned object shouldn't affect record
      values.name = 'Modified';
      expect(record.name).toBe('John');
    });

    test('getJSON() returns JSON string', () => {
      const json = record.getJSON();
      const parsed = JSON.parse(json);
      expect(parsed).toEqual({ id: '1', name: 'John', age: 25 });
    });

    test('reset() reverts to original state', () => {
      record.name = 'Modified';
      expect(record.isModified()).toBe(true);
      
      record.reset();
      
      expect(record.name).toBe('John');
      expect(record.isModified()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('save() without ID throws error', async () => {
      const recordWithoutId = new ClientRecord({ name: 'No ID' }, mockClient);
      
      await expect(recordWithoutId.save()).rejects.toThrow('Cannot save record without an ID');
    });

    test('delete() without ID throws error', async () => {
      const recordWithoutId = new ClientRecord({ name: 'No ID' }, mockClient);
      
      await expect(recordWithoutId.delete()).rejects.toThrow('Cannot delete record without an ID');
    });

    test('reload() without ID throws error', async () => {
      const recordWithoutId = new ClientRecord({ name: 'No ID' }, mockClient);
      
      await expect(recordWithoutId.reload()).rejects.toThrow('Cannot reload record without an ID');
    });
  });
});
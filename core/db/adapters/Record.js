// core/databases/Record.js

export class Record {
  constructor(data, database, databaseId, schema = null) {
    this._data = data;
    this._database = database;
    this._databaseId = databaseId;
    this._schema = schema;
    this._original = { ...data };
    this._isModified = false;
    
    // Create a proxy to allow direct property access
    return new Proxy(this, {
      get(target, prop) {
        // Return method if it exists on the Record instance
        if (prop in target) {
          return target[prop];
        }
        // Return data property
        return target._data[prop];
      },
      set(target, prop, value) {
        // Set method properties directly on the Record instance
        if (prop.startsWith('_') || typeof target[prop] === 'function') {
          target[prop] = value;
        } else {
          // Set data properties and mark as modified
          target._data[prop] = value;
          target._isModified = true;
        }
        return true;
      }
    });
  }
  
  /**
   * Save changes to the database
   * @returns {Promise<Record>} Updated record
   */
  async save() {
    if (!this._isModified) {
      return this;
    }

    const changes = this.getChanges();
    if (Object.keys(changes).length === 0) {
      return this;
    }

    if (!this.id) {
      throw new Error('Cannot save record without an ID');
    }

    try {
      let result;

      // Check if we're using a client or server database
      if (this._database._updateRecord) {
        // Client database
        result = await this._database._updateRecord(this.id, changes);
        this._data = { ...this._data, ...result };
      } else {
        // Server database - validate complete record, then update only changed fields
        // Pass the complete record for validation, but mark it as an update operation
        const updateResult = await this._database.update(this.id, changes, this._data);

        if (updateResult.success && updateResult.data) {
          this._data = { ...this._data, ...updateResult.data };
        }
      }

      this._original = { ...this._data };
      this._isModified = false;
      return this;
    } catch (error) {
      throw new Error(`Failed to save record: ${error.message}`);
    }
  }
  
  /**
   * Delete this record from the database
   * @returns {Promise<boolean>} Success status
   */
  async delete() {
    if (!this.id) {
      throw new Error('Cannot delete record without an ID');
    }
    
    try {
      // Check if we're using a client or server database
      if (this._database._deleteRecord) {
        // Client database
        await this._database._deleteRecord(this.id);
        return true;
      } else {
        // Server database - use clean API
        const result = await this._database.delete(this.id);
        return result.success;
      }
    } catch (error) {
      throw new Error(`Failed to delete record: ${error.message}`);
    }
  }
  
  /**
   * Get all values as a plain object
   * @returns {Object} Copy of all data
   */
  getValues() {
    return { ...this._data };
  }
  
  /**
   * Get JSON string representation
   * @returns {string} JSON string
   */
  getJSON() {
    return JSON.stringify(this._data, null, 2);
  }
  
  /**
   * Get only the changed fields since last save
   * @returns {Object} Changed fields
   */
  getChanges() {
    const changes = {};
    Object.keys(this._data).forEach(key => {
      if (this._data[key] !== this._original[key]) {
        changes[key] = this._data[key];
      }
    });
    return changes;
  }
  
  /**
   * Check if the record has been modified
   * @returns {boolean} True if modified
   */
  isModified() {
    return this._isModified;
  }
  
  /**
   * Reset changes to original state
   */
  reset() {
    this._data = { ...this._original };
    this._isModified = false;
  }
  
  /**
   * Refresh record from database
   * @returns {Promise<Record>} Updated record
   */
  async reload() {
    if (!this.id) {
      throw new Error('Cannot reload record without an ID');
    }
    
    try {
      let newData = null;
      
      // Check if we're using a client or server database
      if (this._database._reloadRecord) {
        // Client database
        newData = await this._database._reloadRecord(this.id);
      } else {
        // Server database
        const result = await this._database.fetch({ id: this.id });
        if (result.success && result.data && result.data.length > 0) {
          newData = result.data[0];
        }
      }
      
      if (newData) {
        this._data = { ...newData };
        this._original = { ...this._data };
        this._isModified = false;
      }
      
      return this;
    } catch (error) {
      throw new Error(`Failed to reload record: ${error.message}`);
    }
  }
}

/**
 * Wrap database results in Record instances
 * @param {Array|Object} data - Raw database results
 * @param {Object} database - Database instance
 * @param {string} databaseId - Database identifier
 * @param {Object} schema - Optional schema
 * @returns {Array<Record>|Record|null} Wrapped records
 */
export function wrapInRecords(data, database, databaseId, schema = null) {
  if (!data) {
    return null;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => new Record(item, database, databaseId, schema));
  }
  
  return new Record(data, database, databaseId, schema);
}
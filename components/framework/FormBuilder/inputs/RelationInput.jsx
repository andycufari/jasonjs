// RelationInput.jsx - Database relationship input with dynamic loading
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { AlertCircle, Database, Loader2, RefreshCw } from 'lucide-react';
import SelectInput from './SelectInput';
import { useDatabase } from '@/core/client/db';

/**
 * Database relationship input component
 */
export default function RelationInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  onFocus,
  fieldSchema = {},
  error = null,
  touched = false,
  disabled = false,
  className = '',
  showLabel = true,
  ...props
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [lastFetch, setLastFetch] = useState(0);

  // Memoize fieldSchema values to prevent unnecessary re-renders
  const {
    label,
    placeholder,
    help,
    required = false,
    collection, // Target collection (for same database)
    database: configDatabase = null, // Target database (for cross-database relations)
    displayField = 'title', // Field to show in dropdown
    valueField = '_id', // Field to use as value
    multiple = false,
    searchable = true,
    connector = null, // Specific connector to use (notion, airtable, etc.)
    connectionString = null // For custom database connections
  } = fieldSchema;

  // Memoize frequently changing values
  const stableConfig = useMemo(() => ({
    limit: fieldSchema.limit || 50,
    filters: fieldSchema.filters || {},
    orderBy: fieldSchema.orderBy || null,
    cacheTtl: fieldSchema.cacheTtl || 300000 // 5 minutes cache
  }), [fieldSchema.limit, fieldSchema.orderBy, fieldSchema.cacheTtl, JSON.stringify(fieldSchema.filters || {})]);

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || fieldSchema.readOnly || loading;

  // Get database instance for the relation (same database)
  const db = collection && !configDatabase ? useDatabase(collection) : null;
  
  // For cross-database relations, we'll use a different approach
  const crossDb = configDatabase ? useDatabase(configDatabase) : null;

  // Load relation data
  const loadRelationData = useCallback(async (force = false) => {
    const { limit, filters, orderBy, cacheTtl } = stableConfig;
    
    // Check cache
    const now = Date.now();
    if (!force && lastFetch > 0 && (now - lastFetch < cacheTtl)) {
      return;
    }

    // Determine data source
    const targetCollection = collection;
    const targetDatabase = configDatabase;
    
    if (!targetCollection && !targetDatabase) {
      setLoadError('No collection or database specified for relation');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      let results = [];

      if (targetDatabase && crossDb) {
        // Cross-database relation
        if (connector === 'notion') {
          // Handle Notion database
          const query = crossDb.query(targetCollection, filters);
          if (orderBy) {
            query.sort({ [orderBy]: 1 });
          }
          results = await query.limit(limit).execute();
        } else if (connector === 'airtable') {
          // Handle Airtable base
          const query = crossDb.query(targetCollection, filters);
          results = await query.limit(limit).execute();
        } else {
          // Generic database connection
          const query = crossDb.query(targetCollection, filters);
          if (orderBy) {
            query.sort({ [orderBy]: 1 });
          }
          results = await query.limit(limit).execute();
        }
      } else if (db) {
        // Same database relation — use QueryBuilder fluent API
        try {
          let query = db.query(filters).limit(limit);

          // Add sorting if specified
          if (orderBy) {
            query = query.orderBy(orderBy, 'asc');
          } else if (displayField && displayField !== '_id') {
            query = query.orderBy(displayField, 'asc');
          }

          results = await query.execute();

          // Ensure results is an array
          if (!Array.isArray(results)) {
            console.warn('Query did not return an array, wrapping result');
            results = results ? [results] : [];
          }
        } catch (queryError) {
          console.error('Database query failed:', queryError);
          results = [];
        }
      } else {
        throw new Error(`Unable to connect to ${targetDatabase || targetCollection}`);
      }

      // Format options
      const formattedOptions = results.map(item => ({
        value: item[valueField],
        label: item[displayField] || `${targetCollection || targetDatabase} ${item[valueField]}`,
        data: item, // Store full record for advanced use cases
        source: targetDatabase ? `${targetDatabase}.${targetCollection}` : targetCollection
      }));

      setOptions(formattedOptions);
      setLastFetch(now);
    } catch (err) {
      console.error('Relation data load error:', err);
      setLoadError(err.message || 'Error al cargar opciones');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [collection, configDatabase, db, crossDb, displayField, valueField, connector, stableConfig]); // Include stable config

  // Load data on mount and when stable dependencies change
  useEffect(() => {
    loadRelationData();
  }, [loadRelationData]); // Now depends on the callback itself

  const handleRefresh = () => {
    loadRelationData(true);
  };

  const handleChange = (newValue) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleBlur = (e) => {
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = (e) => {
    // Load fresh data on focus if cache is stale
    const now = Date.now();
    if (now - lastFetch > stableConfig.cacheTtl) {
      loadRelationData();
    }

    if (onFocus) {
      onFocus(e);
    }
  };

  // Enhanced field schema for SelectInput
  const selectFieldSchema = {
    ...fieldSchema,
    options,
    multiple,
    searchable: searchable && options.length > 10, // Only enable search for large lists
    placeholder: loading ? 'Cargando opciones...' : placeholder || `Seleccionar ${label || collection}...`,
    emptyText: loadError ? 'Error al cargar opciones' : 'Sin opciones disponibles'
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Custom Label with Database Icon and Refresh */}
      {showLabel && label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={inputId} className="flex items-center gap-1">
            <Database className="h-4 w-4 text-blue-500" />
            {label}
            {required && (
              <span className="text-red-500 text-sm">*</span>
            )}
          </Label>
          
          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || isDisabled}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
            title="Actualizar opciones"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando {collection}...
        </div>
      )}

      {/* Load Error */}
      {loadError && (
        <div className="text-red-500 text-sm flex items-center gap-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {loadError}
        </div>
      )}

      {/* Select Input */}
      <SelectInput
        id={inputId}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        fieldSchema={selectFieldSchema}
        error={error}
        touched={touched}
        disabled={isDisabled}
        showLabel={false} // We handle label above
        {...props}
      />


      {/* Selected Item Details (for advanced use cases) */}
      {value && !multiple && fieldSchema.showDetails && (
        <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded">
          {(() => {
            const selectedOption = options.find(opt => opt.value === value);
            if (!selectedOption?.data) return null;
            
            const item = selectedOption.data;
            return (
              <div>
                <div className="font-medium">{item[displayField]}</div>
                {Object.entries(item)
                  .filter(([key, val]) => key !== displayField && key !== valueField && val)
                  .slice(0, 2)
                  .map(([key, val]) => (
                    <div key={key} className="text-gray-500">
                      {key}: {String(val).substring(0, 50)}
                    </div>
                  ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Help text */}
      {help && !showError && !loadError && (
        <div 
          id={`${inputId}-help`}
          className="text-gray-500 text-sm"
        >
          {help}
        </div>
      )}
    </div>
  );
}
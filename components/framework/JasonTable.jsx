'use client';

/**
 * JasonTable - Advanced data table component with CRUD operations
 *
 * Standalone Mode Usage:
 * {
 *   "component": "@framework/JasonTable",
 *   "attributes": {
 *     "database": "products",
 *     "viewLink": "/products/:slug"  // Opens in new tab with eye icon
 *   }
 * }
 *
 * Component Attributes:
 * - database: string        // Database collection name (enables standalone mode)
 * - viewLink: string        // View link pattern (e.g., "/products/:slug" or "/view/:id")
 * - editable: boolean       // Enable CRUD operations (default: false)
 * - pageSize: number        // Items per page (default: 25)
 * - compact: boolean        // Compact row height (default: false)
 * - showTimestamps: boolean // Show created_at/updated_at columns (default: false)
 * - columns: array          // Custom column definitions (overrides schema)
 * - relationFilters: array  // Relationship-based filter definitions
 * - serverSide: boolean     // Enable server-side pagination/filtering/sorting (recommended for >1000 records)
 * - initialSort: object     // Initial sort config { key: 'fieldName', direction: 'asc'|'desc' }
 *
 * Custom Columns Example:
 * {
 *   "columns": [
 *     { "key": "artist.name", "label": "Artist", "linkPattern": "/artist/:artist._id" },
 *     { "key": "created_by.name", "label": "User" },
 *     { "key": "created_by.email", "label": "Email" },
 *     { "key": "project.description", "label": "Project", "linkPattern": "/backoffice/project/:projectId" },
 *     { "key": "createdAt", "label": "Date", "type": "date" }
 *   ]
 * }
 *
 * Relation Filters Example:
 * {
 *   "relationFilters": [
 *     { "key": "artistId", "label": "Artist", "database": "artists", "displayField": "name" },
 *     { "key": "projectId", "label": "Project", "database": "projects", "displayField": "description" }
 *   ]
 * }
 *
 * Server-Side Pagination (for large datasets >1000 records):
 * {
 *   "component": "@framework/JasonTable",
 *   "attributes": {
 *     "database": "orders",
 *     "serverSide": true,        // Enables server-side pagination, filtering, sorting
 *     "pageSize": 50,
 *     "initialSort": { "key": "created_at", "direction": "desc" }
 *   }
 * }
 *
 * Schema Field Options:
 * - listing: false       // Hide field from table listing (default: true)
 * - listEdit: true       // Enable inline editing in table (default: false)
 * - hidden: true         // Hide field completely (default: false)
 * - maxWidth: 250        // Max column width in pixels (auto-calculated by type)
 *
 * Example Schema:
 * {
 *   slug: { type: 'text', label: 'URL Slug' },
 *   name: { type: 'text', label: 'Product Name' },
 *   description: { type: 'textarea', listing: false }, // Only in edit/view
 *   content: { type: 'richtext', listing: false },     // Hidden from listing
 *   price: { type: 'price', listEdit: true },          // Editable in table
 *   sku: { type: 'text', maxWidth: 150 },
 *   internalNotes: { type: 'textarea', hidden: true }  // Completely hidden
 * }
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  Eye,
  Download,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  ExternalLink
} from 'lucide-react';
import FormBuilder from './FormBuilder';

// Helper function to get nested value from object using dot notation
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

// Helper function to build link from pattern and item data
function buildLinkFromPattern(pattern, item) {
  if (!pattern || !item) return null;
  let link = pattern;
  // Replace all :param or :param.nested patterns with item values
  const matches = pattern.match(/:[\w.]+/g);
  if (matches) {
    matches.forEach(match => {
      const param = match.substring(1); // Remove the ':'
      const value = getNestedValue(item, param);
      if (value !== undefined && value !== null) {
        link = link.replace(match, encodeURIComponent(String(value)));
      }
    });
  }
  return link;
}

// Relationship Filter Component
function RelationFilter({ filter, value, onChange, options, loading }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {filter.label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(filter.key, e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      >
        <option value="">All {filter.label}s</option>
        {options.map((opt) => (
          <option key={opt.id || opt._id} value={opt.id || opt._id}>
            {opt[filter.displayField] || opt.name || opt.id || opt._id}
          </option>
        ))}
      </select>
    </div>
  );
}

// Inline Edit Cell Component
function InlineEditCell({ column, value, onChange, onSave, onCancel }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && column.type !== 'textarea') {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const fieldSchema = column.schema || {};
  const fieldType = column.type;

  // Select field (including multiple select)
  if (fieldType === 'select') {
    const rawOptions = fieldSchema.options || [];
    // Normalize options to { value, label } format
    const options = rawOptions.map(opt =>
      typeof opt === 'object' && opt !== null
        ? { value: opt.value ?? opt.label ?? String(opt), label: opt.label ?? opt.value ?? String(opt) }
        : { value: String(opt), label: String(opt) }
    );
    const isMultiple = fieldSchema.multiple === true;

    if (isMultiple) {
      const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

      return (
        <div className="flex flex-col gap-1 p-1 bg-white dark:bg-gray-800 border border-blue-500 rounded">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={selectedValues.includes(opt.value)}
                onChange={(e) => {
                  const newValues = e.target.checked
                    ? [...selectedValues, opt.value]
                    : selectedValues.filter(v => v !== opt.value);
                  onChange(newValues);
                }}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span>{opt.label}</span>
            </label>
          ))}
          <div className="flex gap-1 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onSave}
              className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-2 py-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    } else {
      const currentValue = value !== null && value !== undefined ? String(value) : '';

      return (
        <select
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
  }

  // Boolean/Checkbox field
  if (fieldType === 'boolean' || fieldType === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => {
          onChange(e.target.checked);
          setTimeout(onSave, 100); // Auto-save after a short delay
        }}
        autoFocus
        className="rounded border-gray-300 dark:border-gray-600"
      />
    );
  }

  // Number/Price field
  if (fieldType === 'number' || fieldType === 'price') {
    return (
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        onBlur={onSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  // Date field
  if (fieldType === 'date' || fieldType === 'datetime-local') {
    return (
      <input
        type={fieldType}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  // Text field (default)
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={handleKeyDown}
      autoFocus
      className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

// Simple Toast Notification Component
function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }[type] || 'bg-gray-500';

  const Icon = {
    success: CheckCircle,
    error: XCircle,
    info: AlertCircle
  }[type] || AlertCircle;

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 max-w-md animate-in slide-in-from-right`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Simple Confirm Dialog Component
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-gray-900 dark:text-gray-100">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// Virtual scrolling hook for performance
function useVirtualScrolling(items, containerHeight = 400, itemHeight = 48) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState(null);

  const visibleRange = useMemo(() => {
    if (!items.length) return { start: 0, end: 0 };

    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount + 5, items.length); // Buffer of 5 items

    return { start: Math.max(0, start - 2), end }; // Small buffer before visible area
  }, [scrollTop, items.length, itemHeight, containerHeight]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return {
    visibleRange,
    containerRef,
    setContainerRef,
    handleScroll,
    totalHeight: items.length * itemHeight,
    offsetY: visibleRange.start * itemHeight
  };
}

// Column type detection from schema
function getColumnType(fieldSchema) {
  if (typeof fieldSchema === 'string') return fieldSchema;

  let type = fieldSchema.type || 'text';

  // Normalize type names
  if (type === 'string') type = 'text';
  if (type === 'rich_text') type = 'richtext';

  return type;
}

// Helper to normalize a single malformed file object like {"0": {...}, id: null, url: null}
// Returns the first file object for display purposes
function normalizeFileValue(val) {
  if (!val || typeof val !== 'object') return val;

  // Check if this is a malformed structure with numeric keys (array spread into object)
  // Pattern: {"0": {...fileData...}, id: null, url: null, name: "unknown", ...}
  if ('0' in val && typeof val['0'] === 'object' && val['0']?.url) {
    // Extract the actual file from the "0" key
    return val['0'];
  }

  return val;
}

// Helper to extract ALL files from a malformed structure like {"0": {...}, "1": {...}, id: null}
// Used when saving data to preserve all files in multi-file fields
function extractAllFilesFromMalformed(val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return null;

  // Check if this looks like a spread array (has numeric keys starting from "0")
  if (!('0' in val) || typeof val['0'] !== 'object') return null;

  const files = [];
  let i = 0;
  while (val[String(i)] !== undefined) {
    const file = val[String(i)];
    if (file && typeof file === 'object' && file.url) {
      files.push(file);
    }
    i++;
  }
  return files.length > 0 ? files : null;
}

// Format cell value based on type
function formatCellValue(value, type, fieldSchema = {}) {
  if (value === null || value === undefined) return '';

  // Normalize malformed file objects first
  if (typeof value === 'object' && !Array.isArray(value)) {
    value = normalizeFileValue(value);
  }

  // Handle objects (like file objects, location objects) before type-specific formatting
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Skip early return for geopoint/location — let the switch handle them
    const isGeoType = type === 'geopoint' || type === 'location';
    if (!isGeoType) {
      // Location/Geopoint handling - check for address first
      if (value.address) {
        return value.address;
      }

      // File object handling
      if (value.name || value.filename) {
        return value.name || value.filename;
      }
      if (value.url) {
        return value.url.split('/').pop() || value.url;
      }

      // Geopoint with lat/lng but no address
      if (value.lat !== undefined && value.lng !== undefined) {
        return `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`;
      }

      // Generic object - convert to JSON string
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '[Object]';
      }
    }
  }

  switch (type) {
    case 'geopoint':
    case 'location':
      if (typeof value === 'object') {
        if (value.address) return value.address;
        if (value.type === 'Point' && Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
          return `${value.coordinates[1].toFixed(4)}, ${value.coordinates[0].toFixed(4)}`;
        }
        if (value.lat !== undefined && value.lng !== undefined) {
          return `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`;
        }
      }
      return String(value);

    case 'date':
      return new Date(value).toLocaleDateString();

    case 'datetime-local':
      // Show both date and time for datetime fields
      const date = new Date(value);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

    case 'boolean':
    case 'checkbox':
      return value ? '✓' : '✗';

    case 'price':
      const currency = fieldSchema.currency || '$';
      return `${currency}${Number(value).toFixed(2)}`;

    case 'number':
      return Number(value).toLocaleString();

    case 'select':
      // Resolve value to label if options are available
      if (fieldSchema.options && Array.isArray(fieldSchema.options)) {
        const opt = fieldSchema.options.find(o => (typeof o === 'object' ? o.value : o) === value);
        if (opt) return typeof opt === 'object' ? opt.label : opt;
      }
      return String(value);

    case 'richtext':
    case 'rich_text':
      // Strip HTML tags from rich text
      if (typeof value === 'string') {
        const stripped = value.replace(/<[^>]*>/g, '');
        return stripped.substring(0, 100) + (stripped.length > 100 ? '...' : '');
      }
      return String(value);

    case 'array':
      if (Array.isArray(value)) {
        // Check if array contains objects
        if (value.length > 0 && typeof value[0] === 'object') {
          // For file arrays
          if (value[0].name || value[0].filename || value[0].url) {
            return `${value.length} file${value.length !== 1 ? 's' : ''}`;
          }
          return `${value.length} items`;
        }
        return value.join(', ');
      }
      return String(value);

    case 'relation':
      // Relation values are IDs (string) or arrays of IDs
      // The actual resolution happens at render time with relationLookups
      // This fallback just shows the raw value
      if (Array.isArray(value)) {
        return value.length > 0 ? `${value.length} item${value.length !== 1 ? 's' : ''}` : '';
      }
      return String(value);

    case 'file':
    case 'files':
      if (typeof value === 'object' && (value.name || value.filename)) {
        return value.name || value.filename;
      }
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          return `${value.length} file${value.length !== 1 ? 's' : ''}`;
        }
        return `${value.length} file${value.length !== 1 ? 's' : ''}`;
      }
      return String(value);

    default:
      // Ensure we always return a string
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (e) {
          return '[Object]';
        }
      }
      return String(value);
  }
}

// Get display name for column
function getColumnDisplayName(fieldName, fieldSchema) {
  if (typeof fieldSchema === 'object' && fieldSchema.label) {
    return fieldSchema.label;
  }
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');
}

export default function JasonTable({
  data: propData,
  schema: propSchema,
  database,
  jcontext,
  editable = false,
  loading: propLoading = false,
  onSelectItem,
  onEditItem,
  onDoubleClick,
  onDeleteItem,
  onLoadData,
  actionButtons = [],
  pageSize = 25,
  enableVirtualScrolling = true,
  enableSearch = true,
  enableFilters = true,
  enableSorting = true,
  enableResizing = true,
  enableSelection = true,
  className = '',
  height = 550,
  onSelectionChange,
  selectedItems = [],
  showRowNumbers = false,
  compact = false,
  viewLink = null,  // e.g., "/products/:slug" or "/view/:id"
  showTimestamps = false,  // Show created_at/updated_at columns
  columns: customColumns = null,  // Custom column definitions (overrides schema)
  relationFilters = [],  // Relationship filter definitions
  serverSide = false,  // Enable server-side pagination/filtering/sorting (recommended for >1000 records)
  initialSort = null  // Initial sort configuration { key: 'fieldName', direction: 'asc'|'desc' }
}) {
  // Unwrap schema if it's in jcontext.databaseSchemas format
  const unwrappedSchema = propSchema?.schema || propSchema;

  // Normalize schema options format (convert { value, label } to simple strings for JasonTable)
  const normalizedSchema = useMemo(() => {
    if (!unwrappedSchema) {
      console.warn('[JasonTable] No schema provided. Pass schema prop or use database attribute for auto-fetch.');
      return null;
    }

    const normalized = {};
    Object.entries(unwrappedSchema).forEach(([key, fieldSchema]) => {
      if (typeof fieldSchema === 'object' && fieldSchema.type === 'select' && Array.isArray(fieldSchema.options)) {
        // Normalize options to always be { value, label } objects
        const normalizedOptions = fieldSchema.options.map(opt => {
          if (typeof opt === 'object' && opt !== null) {
            return { value: opt.value ?? opt.label ?? String(opt), label: opt.label ?? opt.value ?? String(opt) };
          }
          return { value: String(opt), label: String(opt) };
        });
        normalized[key] = { ...fieldSchema, options: normalizedOptions };
      } else {
        normalized[key] = fieldSchema;
      }
    });

    return normalized;
  }, [unwrappedSchema]);

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(initialSort || { key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [totalCount, setTotalCount] = useState(0);  // For server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState(new Set(selectedItems.map(item => item.id || item._id)));
  const [columnWidths, setColumnWidths] = useState({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Enhanced state for standalone mode
  const [fetchedSchema, setFetchedSchema] = useState(null);
  const [fetchedData, setFetchedData] = useState([]);
  const [isLoading, setIsLoading] = useState(!!database); // Start loading if in standalone mode
  const [error, setError] = useState(null);
  const [securityInfo, setSecurityInfo] = useState(null);

  // Toast and confirmation state
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState(null); // { itemId, columnKey }
  const [editingValue, setEditingValue] = useState(null);

  // Relation filter state
  const [relationFilterOptions, setRelationFilterOptions] = useState({});
  const [relationFiltersLoading, setRelationFiltersLoading] = useState(false);

  // Relation column data resolution (ID → display name lookup maps)
  const [relationLookups, setRelationLookups] = useState({}); // { fieldName: { id: displayName, ... } }
  const [relationLookupsLoading, setRelationLookupsLoading] = useState(false);

  // Theme detection - FORCE light mode by default, only go dark if explicitly set
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect theme on mount and watch for changes
  useEffect(() => {
    const updateTheme = () => {
      // Check if document has dark class
      const hasDarkClass = document.documentElement.classList.contains('dark');
      const htmlClasses = document.documentElement.className;

      console.log('[JasonTable] Theme detection:', {
        hasDarkClass,
        htmlClasses: htmlClasses || '(NO CLASSES - LIGHT MODE)',
        willSetDarkMode: hasDarkClass,
        currentState: isDarkMode
      });

      setIsDarkMode(hasDarkClass);
    };

    // Check immediately
    updateTheme();

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      console.log('[JasonTable] HTML class attribute changed, rechecking theme...');
      updateTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Refs
  const tableRef = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Determine data and schema sources
  // Priority: 1. Normalized schema from props, 2. Fetched schema (if database mode), 3. null
  const activeSchema = normalizedSchema || fetchedSchema;
  const activeData = propData || fetchedData;
  const activeLoading = (!!database && !propData) ? isLoading : propLoading;

  // Debug logging in development (after all variables are declared)
  useEffect(() => {
    console.log('[JasonTable] Data Flow:', {
      mode: database ? 'standalone' : 'controlled',
      propData: propData?.length || 0,
      fetchedData: fetchedData.length,
      activeData: activeData?.length || 0,
      activeDataFirstItem: activeData?.[0],
      hasPropSchema: !!propSchema,
      hasActiveSchema: !!activeSchema,
      isLoading,
      activeLoading
    });
  }, [
    propData?.length,
    fetchedData.length,
    activeData?.length,
    !!activeSchema,
    isLoading,
    activeLoading
  ]);

  // Debounce search term for server-side mode (300ms delay)
  useEffect(() => {
    if (!serverSide) {
      setDebouncedSearchTerm(searchTerm);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, serverSide]);

  // Fetch schema on mount
  useEffect(() => {
    if (!database) return;

    const fetchSchema = async () => {
      try {
        const schemaResponse = await fetch(`/api/data/${database}/schema`);
        if (!schemaResponse.ok) {
          throw new Error(`Failed to fetch schema: ${schemaResponse.statusText}`);
        }
        const schemaData = await schemaResponse.json();
        setFetchedSchema(schemaData.schema || {});
        setSecurityInfo(schemaData.security || {});
      } catch (err) {
        console.error('JasonTable schema fetch error:', err);
        setError(err.message);
      }
    };

    fetchSchema();
  }, [database]);

  // Fetch data - supports both client-side (all data) and server-side (paginated) modes
  useEffect(() => {
    if (!database) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Check if data is provided via jcontext (skip API call)
        if (!serverSide && jcontext?.fetch_data?.[database]) {
          const data = jcontext.fetch_data[database];
          setFetchedData(Array.isArray(data) ? data : []);
          setTotalCount(Array.isArray(data) ? data.length : 0);
          setIsLoading(false);
          return;
        }

        if (!serverSide && jcontext?.data?.[database]) {
          const data = jcontext.data[database];
          setFetchedData(Array.isArray(data) ? data : []);
          setTotalCount(Array.isArray(data) ? data.length : 0);
          setIsLoading(false);
          return;
        }

        // Build query params for API call
        const params = new URLSearchParams();

        if (serverSide) {
          // Server-side mode: send pagination, sort, and filter params
          params.set('limit', String(pageSize));
          params.set('skip', String((currentPage - 1) * pageSize));

          // Add sorting
          if (sortConfig.key) {
            params.set('sort', JSON.stringify({
              [sortConfig.key]: sortConfig.direction
            }));
          }

          // Add filters
          const apiFilters = {};
          Object.entries(filters).forEach(([key, value]) => {
            if (value) {
              apiFilters[key] = value;
            }
          });
          if (Object.keys(apiFilters).length > 0) {
            params.set('filters', JSON.stringify(apiFilters));
          }

          // Add search
          if (debouncedSearchTerm) {
            params.set('search', debouncedSearchTerm);
          }
        }

        const url = `/api/data/${database}${params.toString() ? `?${params.toString()}` : ''}`;
        const dataResponse = await fetch(url);

        if (!dataResponse.ok) {
          throw new Error(`Failed to fetch data: ${dataResponse.statusText}`);
        }

        const result = await dataResponse.json();
        const data = result.data || [];
        setFetchedData(Array.isArray(data) ? data : []);

        // Set total count (for server-side pagination)
        if (serverSide && result.total !== undefined) {
          setTotalCount(result.total);
        } else if (!serverSide) {
          setTotalCount(Array.isArray(data) ? data.length : 0);
        }
      } catch (err) {
        console.error('JasonTable data fetch error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [database, jcontext, serverSide, currentPage, pageSize, sortConfig, filters, debouncedSearchTerm]);

  // Fetch relation filter options (with limit to avoid loading huge datasets)
  useEffect(() => {
    if (!relationFilters || relationFilters.length === 0) return;

    const fetchRelationOptions = async () => {
      setRelationFiltersLoading(true);
      const optionsMap = {};

      try {
        await Promise.all(
          relationFilters.map(async (filter) => {
            if (!filter.database) return;
            try {
              // Fetch with limit to avoid loading huge datasets for dropdowns
              // Users can search within the dropdown for more options
              const limit = filter.limit || 100;
              const response = await fetch(`/api/data/${filter.database}?limit=${limit}`);
              if (response.ok) {
                const result = await response.json();
                optionsMap[filter.key] = result.data || [];
              }
            } catch (err) {
              console.error(`Failed to fetch options for ${filter.key}:`, err);
              optionsMap[filter.key] = [];
            }
          })
        );
        setRelationFilterOptions(optionsMap);
      } finally {
        setRelationFiltersLoading(false);
      }
    };

    fetchRelationOptions();
  }, [relationFilters]);

  // Fetch relation column data for display resolution (ID → display name)
  useEffect(() => {
    if (!activeSchema) return;

    // Find all relation fields in schema
    const relationFields = Object.entries(activeSchema).filter(([_, fieldSchema]) => {
      const type = typeof fieldSchema === 'string' ? fieldSchema : fieldSchema?.type;
      return type === 'relation' && (fieldSchema?.collection || fieldSchema?.database);
    });

    if (relationFields.length === 0) return;

    const fetchRelationData = async () => {
      setRelationLookupsLoading(true);
      const lookups = {};

      try {
        await Promise.all(
          relationFields.map(async ([fieldName, fieldSchema]) => {
            const collection = fieldSchema.collection;
            const displayField = fieldSchema.displayField || 'name';
            const valueField = fieldSchema.valueField || '_id';
            const limit = fieldSchema.limit || 200;

            if (!collection) return;

            try {
              const response = await fetch(`/api/data/${collection}?limit=${limit}`);
              if (response.ok) {
                const result = await response.json();
                const records = result.data || [];

                // Build lookup map: { id → displayName }
                const lookupMap = {};
                records.forEach(record => {
                  const id = record[valueField] || record._id || record.id;
                  const display = record[displayField] || record.name || record.title || id;
                  if (id) {
                    lookupMap[String(id)] = display;
                  }
                });
                lookups[fieldName] = lookupMap;
              }
            } catch (err) {
              console.error(`[JasonTable] Failed to fetch relation data for ${fieldName} (${collection}):`, err);
              lookups[fieldName] = {};
            }
          })
        );
        setRelationLookups(lookups);
      } finally {
        setRelationLookupsLoading(false);
      }
    };

    fetchRelationData();
  }, [activeSchema]);

  // Helper to normalize form data before saving (fixes malformed file structures)
  const normalizeFormData = useCallback((data, schema) => {
    if (!data || !schema) return data;

    const normalized = { ...data };

    Object.entries(schema).forEach(([fieldName, fieldSchema]) => {
      const fieldType = typeof fieldSchema === 'string' ? fieldSchema : fieldSchema?.type;
      const isFileField = ['file', 'files', 'image', 'video', 'audio'].includes(fieldType);
      const isMultiple = fieldType === 'files' || fieldSchema?.multiple === true;

      if (isFileField && normalized[fieldName]) {
        const value = normalized[fieldName];

        // Already a proper array - just filter out invalid items
        if (Array.isArray(value)) {
          const validFiles = value.filter(item => item && typeof item === 'object' && item.url);
          normalized[fieldName] = isMultiple ? validFiles : (validFiles[0] || null);
        }
        // Malformed object (array spread into object) - extract all files
        else if (typeof value === 'object') {
          const extractedFiles = extractAllFilesFromMalformed(value);
          if (extractedFiles) {
            normalized[fieldName] = isMultiple ? extractedFiles : extractedFiles[0];
          } else if (value.url) {
            // Single valid file object
            normalized[fieldName] = isMultiple ? [value] : value;
          }
        }
      }
    });

    return normalized;
  }, []);

  // CRUD Operations for standalone mode
  const handleCreateOrUpdate = useCallback(async (formData) => {
    if (!database) {
      onEditItem?.(formData);
      return;
    }

    try {
      setIsLoading(true);

      // Normalize form data before saving (fixes malformed file structures)
      const normalizedData = normalizeFormData(formData, activeSchema);

      const isUpdate = normalizedData.id || normalizedData._id;
      const method = isUpdate ? 'PUT' : 'POST';
      const url = `/api/data/${database}`;

      // For PUT requests, the API expects { id, data } in the body
      const requestBody = isUpdate
        ? { id: normalizedData.id || normalizedData._id, data: normalizedData }
        : normalizedData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Get detailed error message from API response
        let errorMessage = `Failed to ${isUpdate ? 'update' : 'create'} item`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Update local data
      if (isUpdate) {
        setFetchedData(prev =>
          prev.map(item =>
            (item.id || item._id) === (formData.id || formData._id)
              ? result.data
              : item
          )
        );
      } else {
        setFetchedData(prev => [...prev, result.data]);
      }

      // Close modal and notify
      setIsEditModalOpen(false);
      setEditingItem(null);
      setToast({
        message: isUpdate ? 'Item updated successfully' : 'Item created successfully',
        type: 'success'
      });
      onEditItem?.(result.data);
    } catch (err) {
      console.error('Create/Update error:', err);
      setToast({
        message: err.message || 'An error occurred',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [database, onEditItem, normalizeFormData, activeSchema]);

  const handleDeleteItem = useCallback(async (item) => {
    if (!database) {
      onDeleteItem?.(item);
      return;
    }

    // Use app.ui.confirm if available (check global app first, then jcontext)
    let confirmed = false;

    try {
      // Try global app object first (most common in user components)
      if (typeof window !== 'undefined' && window.app?.ui?.confirm) {
        confirmed = await window.app.ui.confirm('Are you sure you want to delete this item? This action cannot be undone.');
      }
      // Try jcontext.app as fallback
      else if (jcontext?.app?.ui?.confirm) {
        confirmed = await jcontext.app.ui.confirm('Are you sure you want to delete this item? This action cannot be undone.');
      }
      // Fallback to built-in confirm dialog
      else {
        confirmed = await new Promise((resolve) => {
          setConfirmDialog({
            message: 'Are you sure you want to delete this item? This action cannot be undone.',
            onConfirm: () => {
              setConfirmDialog(null);
              resolve(true);
            },
            onCancel: () => {
              setConfirmDialog(null);
              resolve(false);
            }
          });
        });
      }
    } catch (error) {
      console.error('[JasonTable] Confirm dialog error:', error);
      // If confirm fails, don't proceed with delete
      return;
    }

    if (!confirmed) return;

    try {
      setIsLoading(true);
      const itemId = item.id || item._id;

      // API expects { id } in the body for DELETE
      const response = await fetch(`/api/data/${database}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete item');
      }

      // Update local data
      setFetchedData(prev => prev.filter(i => (i.id || i._id) !== itemId));

      setToast({
        message: 'Item deleted successfully',
        type: 'success'
      });

      onDeleteItem?.(item);
    } catch (err) {
      console.error('Delete error:', err);
      setToast({
        message: err.message || 'Failed to delete item',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [database, onDeleteItem, jcontext]);

  const handleRefresh = useCallback(async () => {
    if (!database) {
      onLoadData?.();
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/data/${database}`);
      if (!response.ok) {
        throw new Error('Failed to refresh data');
      }
      const result = await response.json();
      setFetchedData(result.data || []);
    } catch (err) {
      console.error('Refresh error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [database, onLoadData]);

  // Generate columns from schema or use custom columns
  const columns = useMemo(() => {
    // If custom columns are provided, enrich them with schema info
    if (customColumns && Array.isArray(customColumns) && customColumns.length > 0) {
      return customColumns.map(col => {
        // Look up schema field for this column (skip nested/joined fields like "location.name")
        const schemaField = !col.key.includes('.') && activeSchema ? activeSchema[col.key] : null;
        const fieldConfig = typeof schemaField === 'object' ? schemaField : {};
        const schemaType = fieldConfig.type || null;

        return {
          key: col.key,
          title: col.label || col.title || fieldConfig.label || col.key.split('.').pop().replace(/_/g, ' '),
          type: col.type || schemaType || 'text',
          sortable: col.sortable !== false,
          filterable: col.filterable !== false,
          maxWidth: col.maxWidth || fieldConfig.maxWidth || 300,
          linkPattern: col.linkPattern || null,
          editable: col.editable || fieldConfig.listEdit === true,
          isNested: col.key.includes('.'),
          schema: col.schema || schemaField || {}
        };
      });
    }

    let generatedColumns = [];

    if (!activeSchema || Object.keys(activeSchema).length === 0) {
      // Fallback: generate columns from data
      if (activeData && activeData.length > 0) {
        generatedColumns = Object.keys(activeData[0])
          .filter(key => {
            // Always filter out ID fields
            if (['id', '_id'].includes(key)) return false;
            // Filter out timestamp fields unless showTimestamps is enabled
            if (['createdAt', 'updatedAt', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)) {
              return showTimestamps;
            }
            return true;
          })
          .map(key => ({
            key,
            title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            type: ['created_at', 'updated_at', 'createdAt', 'updatedAt'].includes(key) ? 'datetime-local' : 'text',
            sortable: true,
            filterable: !['created_at', 'updated_at', 'createdAt', 'updatedAt', 'created_by', 'updated_by'].includes(key),
            maxWidth: ['created_at', 'updated_at', 'createdAt', 'updatedAt'].includes(key) ? 180 : 300,
            editable: false, // Timestamp fields are read-only
            isTimestamp: ['created_at', 'updated_at', 'createdAt', 'updatedAt'].includes(key)
          }));
      }
    } else {
      generatedColumns = Object.entries(activeSchema)
        .filter(([key, fieldSchema]) => {
          // Filter out hidden fields
          if (typeof fieldSchema === 'object' && fieldSchema.hidden) return false;

          // Filter out fields with listing: false
          if (typeof fieldSchema === 'object' && fieldSchema.listing === false) return false;

          // Always filter out ID fields
          if (['id', '_id'].includes(key)) return false;

          // Filter out timestamp/tracking fields (they're not in schema, added by system)
          if (['createdAt', 'updatedAt', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)) return false;

          return true;
        })
        .map(([key, fieldSchema]) => {
          const type = getColumnType(fieldSchema);
          const fieldConfig = typeof fieldSchema === 'object' ? fieldSchema : {};

          // Determine max width based on field type
          let maxWidth = fieldConfig.maxWidth || 300;

          // Adjust max width based on field type
          if (type === 'textarea' || type === 'richtext' || type === 'rich_text') {
            maxWidth = fieldConfig.maxWidth || 250;
          } else if (type === 'text' || type === 'string' || type === 'email' || type === 'url') {
            maxWidth = fieldConfig.maxWidth || 300;
          } else if (type === 'number' || type === 'price') {
            maxWidth = fieldConfig.maxWidth || 150;
          } else if (type === 'date' || type === 'datetime-local') {
            maxWidth = fieldConfig.maxWidth || 180;
          } else if (type === 'boolean' || type === 'checkbox') {
            maxWidth = fieldConfig.maxWidth || 100;
          } else if (type === 'select') {
            maxWidth = fieldConfig.maxWidth || 180;
          } else if (type === 'geopoint' || type === 'location') {
            maxWidth = fieldConfig.maxWidth || 250;
          } else if (type === 'file' || type === 'files') {
            maxWidth = fieldConfig.maxWidth || 200;
          } else if (type === 'relation') {
            maxWidth = fieldConfig.maxWidth || 250;
          }

          return {
            key,
            title: getColumnDisplayName(key, fieldSchema),
            type,
            sortable: true,
            filterable: true,
            editable: fieldConfig.listEdit === true,
            maxWidth,
            schema: fieldSchema,
            isTimestamp: false
          };
        });
    }

    // Add timestamp columns if showTimestamps is enabled and data has these fields
    if (showTimestamps && activeData.length > 0) {
      const firstRecord = activeData[0];
      const timestampFields = [];

      // Check for created_at (snake_case - used by database.js)
      if (firstRecord.created_at !== undefined) {
        timestampFields.push({
          key: 'created_at',
          title: 'Created At',
          type: 'datetime-local',
          sortable: true,
          filterable: false,
          editable: false,
          maxWidth: 180,
          isTimestamp: true
        });
      }

      // Check for updated_at (snake_case - used by database.js)
      if (firstRecord.updated_at !== undefined) {
        timestampFields.push({
          key: 'updated_at',
          title: 'Updated At',
          type: 'datetime-local',
          sortable: true,
          filterable: false,
          editable: false,
          maxWidth: 180,
          isTimestamp: true
        });
      }

      // Check for createdAt (camelCase - legacy/other sources)
      if (firstRecord.createdAt !== undefined && !timestampFields.some(f => f.key === 'created_at')) {
        timestampFields.push({
          key: 'createdAt',
          title: 'Created At',
          type: 'datetime-local',
          sortable: true,
          filterable: false,
          editable: false,
          maxWidth: 180,
          isTimestamp: true
        });
      }

      // Check for updatedAt (camelCase - legacy/other sources)
      if (firstRecord.updatedAt !== undefined && !timestampFields.some(f => f.key === 'updated_at')) {
        timestampFields.push({
          key: 'updatedAt',
          title: 'Updated At',
          type: 'datetime-local',
          sortable: true,
          filterable: false,
          editable: false,
          maxWidth: 180,
          isTimestamp: true
        });
      }

      // Append timestamp columns at the end
      generatedColumns = [...generatedColumns, ...timestampFields];
    }

    return generatedColumns;
  }, [activeSchema, activeData, showTimestamps, customColumns]);

  // Filter and sort data (client-side only - skip in serverSide mode)
  const processedData = useMemo(() => {
    if (!activeData) return [];

    // In server-side mode, data is already filtered/sorted/paginated by API
    if (serverSide) {
      return activeData;
    }

    let filtered = [...activeData];

    // Apply search (supports nested fields)
    if (searchTerm && enableSearch) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        columns.some(col => {
          // Support nested field access for search
          const value = col.isNested || col.key.includes('.')
            ? getNestedValue(item, col.key)
            : item[col.key];
          return value && String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply filters (supports nested fields and relation filters)
    if (enableFilters) {
      Object.entries(filters).forEach(([key, filterValue]) => {
        if (filterValue) {
          filtered = filtered.filter(item => {
            // Support nested field access for filters
            const value = key.includes('.') ? getNestedValue(item, key) : item[key];
            if (typeof filterValue === 'string') {
              return String(value).toLowerCase().includes(filterValue.toLowerCase());
            }
            return value === filterValue;
          });
        }
      });
    }

    // Apply sorting (supports nested fields)
    if (sortConfig.key && enableSorting) {
      filtered.sort((a, b) => {
        // Support nested field access for sorting
        const aVal = sortConfig.key.includes('.')
          ? getNestedValue(a, sortConfig.key)
          : a[sortConfig.key];
        const bVal = sortConfig.key.includes('.')
          ? getNestedValue(b, sortConfig.key)
          : b[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [activeData, searchTerm, filters, sortConfig, columns, enableSearch, enableFilters, enableSorting, serverSide]);

  // Pagination - use totalCount for server-side mode
  const totalPages = serverSide
    ? Math.ceil(totalCount / pageSize)
    : Math.ceil(processedData.length / pageSize);

  const paginatedData = useMemo(() => {
    // In server-side mode, data is already paginated
    if (serverSide) return processedData;
    if (enableVirtualScrolling) return processedData;
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize, enableVirtualScrolling, serverSide]);

  // Virtual scrolling
  const { visibleRange, handleScroll, totalHeight, offsetY } = useVirtualScrolling(
    enableVirtualScrolling ? processedData : paginatedData,
    height,
    compact ? 40 : 48
  );

  const visibleData = enableVirtualScrolling
    ? processedData.slice(visibleRange.start, visibleRange.end)
    : paginatedData;

  // Reset to page 1 when filters/search change (server-side mode only)
  useEffect(() => {
    if (serverSide) {
      setCurrentPage(1);
    }
  }, [filters, debouncedSearchTerm, serverSide]);

  // Event handlers
  const handleSort = useCallback((key) => {
    if (!enableSorting) return;

    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, [enableSorting]);

  const handleRowSelect = useCallback((item, selected) => {
    if (!enableSelection) return;

    const id = item.id || item._id;
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });

    if (onSelectionChange) {
      const selectedItems = processedData.filter(item =>
        selectedRows.has(item.id || item._id) || (selected && (item.id || item._id) === id)
      );
      onSelectionChange(selectedItems);
    }
  }, [enableSelection, processedData, selectedRows, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    if (!enableSelection) return;

    const allSelected = selectedRows.size === processedData.length;
    if (allSelected) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = new Set(processedData.map(item => item.id || item._id));
      setSelectedRows(allIds);
      onSelectionChange?.(processedData);
    }
  }, [enableSelection, selectedRows.size, processedData, onSelectionChange]);

  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  }, []);

  // Generate view link for an item
  const getViewLink = useCallback((item) => {
    if (!viewLink) return null;

    let link = viewLink;
    // Replace all :param patterns with item values
    const matches = link.match(/:(\w+)/g);
    if (matches) {
      matches.forEach(match => {
        const param = match.substring(1); // Remove the ':'
        const value = item[param] || item.id || item._id;
        link = link.replace(match, encodeURIComponent(value));
      });
    }
    return link;
  }, [viewLink]);

  const handleViewItem = useCallback((item) => {
    const link = getViewLink(item);
    if (link) {
      window.open(link, '_blank');
    }
  }, [getViewLink]);

  // Column resizing
  const handleResizeStart = useCallback((e, columnKey) => {
    if (!enableResizing) return;

    e.preventDefault();
    setResizingColumn(columnKey);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey] || 150;

    const handleMouseMove = (e) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(80, resizeStartWidth.current + diff);
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [enableResizing, columnWidths]);

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown className="w-4 h-4 opacity-50" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />;
  };

  // Check if user can perform actions based on security info
  // In database mode (standalone mode with database attribute), use securityInfo from schema
  // In prop mode (data/schema passed directly), use editable prop
  const canCreate = database ? (securityInfo?.canCreate !== false) : editable;
  const canUpdate = database ? (securityInfo?.canUpdate !== false) : editable;
  const canDelete = database ? (securityInfo?.canDelete !== false) : editable;
  const hasViewLink = !!viewLink;

  // Handle inline cell editing (defined after canUpdate)
  const handleCellEdit = useCallback(async (item, columnKey, newValue) => {
    if (!database) return;

    try {
      setIsLoading(true);
      const itemId = item.id || item._id;

      // Create updated item data
      const updatedData = { ...item, [columnKey]: newValue };

      const response = await fetch(`/api/data/${database}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, data: updatedData })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update item');
      }

      const result = await response.json();

      // Update local data
      setFetchedData(prev =>
        prev.map(i => (i.id || i._id) === itemId ? result.data : i)
      );

      setEditingCell(null);
      setEditingValue(null);

      setToast({
        message: 'Field updated successfully',
        type: 'success'
      });
    } catch (err) {
      console.error('Inline edit error:', err);
      setToast({
        message: err.message || 'Failed to update field',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  // Start editing a cell
  const startCellEdit = useCallback((item, column) => {
    if (!column.editable || !canUpdate) return;

    const itemId = item.id || item._id;
    setEditingCell({ itemId, columnKey: column.key });
    setEditingValue(item[column.key]);
  }, [canUpdate]);

  // Cancel cell editing
  const cancelCellEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue(null);
  }, []);

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center h-32 border rounded-lg ${
        isDarkMode
          ? 'border-red-700 bg-red-900/20'
          : 'border-red-200 bg-red-50'
      }`}>
        <div className={`flex items-center gap-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // No columns state
  if (!columns.length && !activeLoading) {
    return (
      <div className={`flex items-center justify-center h-32 border rounded-lg ${
        isDarkMode
          ? 'border-gray-700 bg-gray-800'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>No data schema available</p>
      </div>
    );
  }

  return (
    <div
      className={`jason-table border rounded-lg ${className}`}
      style={{
        backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        borderColor: isDarkMode ? '#374151' : '#e5e7eb'
      }}
      data-theme={isDarkMode ? 'dark' : 'light'}
    >
      {/* Toolbar */}
      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {enableSearch && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-gray-100'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                />
              </div>
            )}

            {enableFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={activeLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${activeLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {processedData.length} items
              {selectedRows.size > 0 && `, ${selectedRows.size} selected`}
            </span>

            {actionButtons.map((button, index) => (
              <Button
                key={index}
                variant={button.variant || "outline"}
                size="sm"
                onClick={() => button.onClick(Array.from(selectedRows))}
                disabled={button.requiresSelection && selectedRows.size === 0}
                className="gap-2"
              >
                {button.icon}
                {button.label}
              </Button>
            ))}

            {canCreate && (
              <Button
                size="sm"
                onClick={() => handleEdit({})}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            )}
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && enableFilters && (
          <div className={`mt-4 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {/* Relation filters (dropdowns with data from related collections) */}
            {relationFilters && relationFilters.length > 0 && (
              <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4 pb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                {relationFilters.map(filter => (
                  <RelationFilter
                    key={filter.key}
                    filter={filter}
                    value={filters[filter.key]}
                    onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
                    options={relationFilterOptions[filter.key] || []}
                    loading={relationFiltersLoading}
                  />
                ))}
              </div>
            )}
            {/* Regular text filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {columns.filter(col => col.filterable).map(column => (
                <div key={column.key}>
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {column.title}
                  </label>
                  <input
                    type="text"
                    placeholder={`Filter ${column.title}`}
                    value={filters[column.key] || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, [column.key]: e.target.value }))}
                    className={`w-full px-3 py-1 text-sm border rounded ${
                      isDarkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-100'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="relative">
        {activeLoading && (
          <div className={`absolute inset-0 flex items-center justify-center z-10 ${
            isDarkMode ? 'bg-gray-900/80' : 'bg-white/80'
          }`}>
            <div className={`flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          </div>
        )}

        <div
          ref={tableRef}
          className={`overflow-auto ${enableVirtualScrolling ? '' : 'max-h-96'}`}
          style={{ height: enableVirtualScrolling ? height : 'auto' }}
          onScroll={enableVirtualScrolling ? handleScroll : undefined}
        >
          <table className="w-full">
            <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <tr>
                {enableSelection && (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === processedData.length && processedData.length > 0}
                      onChange={handleSelectAll}
                      className={`rounded ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                    />
                  </th>
                )}

                {showRowNumbers && (
                  <th className={`w-16 px-4 py-3 text-left text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    #
                  </th>
                )}

                {columns.map(column => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-sm font-medium select-none group relative ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                    style={{
                      width: columnWidths[column.key] || 'auto',
                      maxWidth: column.maxWidth || 300,
                      minWidth: 100
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`${column.sortable && enableSorting ? 'cursor-pointer' : ''} truncate`}
                        onClick={() => column.sortable && handleSort(column.key)}
                      >
                        {column.title}
                      </span>

                      {column.sortable && enableSorting && getSortIcon(column.key)}
                    </div>

                    {enableResizing && (
                      <div
                        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 opacity-0 group-hover:opacity-100"
                        onMouseDown={(e) => handleResizeStart(e, column.key)}
                      />
                    )}
                  </th>
                ))}

                {(canUpdate || canDelete || hasViewLink || onSelectItem || actionButtons.length > 0) && (
                  <th className={`w-20 px-4 py-3 text-right text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {enableVirtualScrolling && (
                <tr style={{ height: offsetY }}>
                  <td colSpan={columns.length + (enableSelection ? 1 : 0) + (showRowNumbers ? 1 : 0) + ((canUpdate || canDelete || hasViewLink || onSelectItem || actionButtons.length > 0) ? 1 : 0)} />
                </tr>
              )}

              {visibleData.map((item, index) => {
                const rowIndex = enableVirtualScrolling ? visibleRange.start + index : (currentPage - 1) * pageSize + index;
                const itemId = item.id || item._id;
                const isSelected = selectedRows.has(itemId);

                return (
                  <tr
                    key={itemId || rowIndex}
                    className={`
                      group transition-colors ${compact ? 'h-10' : 'h-12'}
                      ${
                        isDarkMode
                          ? `hover:bg-gray-800 ${isSelected ? 'bg-blue-900/20' : ''}`
                          : `hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`
                      }
                    `}
                    onDoubleClick={() => onDoubleClick?.(item)}
                  >
                    {enableSelection && (
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleRowSelect(item, e.target.checked)}
                          className={`rounded ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                        />
                      </td>
                    )}

                    {showRowNumbers && (
                      <td className={`px-4 py-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {rowIndex + 1}
                      </td>
                    )}

                    {columns.map(column => {
                      // Support nested field access (e.g., "artist.name")
                      const rawCellValue = column.isNested || column.key.includes('.')
                        ? getNestedValue(item, column.key)
                        : item[column.key];
                      // Normalize file values for display (fixes malformed structures)
                      const isFileType = ['file', 'files', 'image', 'video', 'audio'].includes(column.type);
                      const isRelationType = column.type === 'relation';
                      const cellValue = isFileType ? normalizeFileValue(rawCellValue) : rawCellValue;

                      // Resolve relation values using lookup maps
                      let formattedValue;
                      if (isRelationType && relationLookups[column.key]) {
                        const lookup = relationLookups[column.key];
                        if (Array.isArray(cellValue)) {
                          // Multiple relation — resolve each ID to display name
                          const names = cellValue
                            .map(id => lookup[String(id)] || String(id))
                            .filter(Boolean);
                          formattedValue = names.join(', ');
                        } else if (cellValue) {
                          // Single relation — resolve ID to display name
                          formattedValue = lookup[String(cellValue)] || String(cellValue);
                        } else {
                          formattedValue = '';
                        }
                      } else {
                        formattedValue = formatCellValue(cellValue, column.type, column.schema);
                      }

                      const isImageFile = isFileType &&
                                         typeof cellValue === 'object' &&
                                         cellValue?.url &&
                                         cellValue?.type?.startsWith('image/');

                      const isEditing = editingCell?.itemId === itemId && editingCell?.columnKey === column.key;

                      // For select fields with listEdit, show dropdown directly
                      const isInlineSelect = column.type === 'select' && column.editable && canUpdate;

                      // For boolean fields with listEdit, show checkbox directly
                      const isInlineBoolean = (column.type === 'boolean' || column.type === 'checkbox') && column.editable && canUpdate;

                      // Geopoint link to Google Maps
                      let geopointUrl = null;
                      if ((column.type === 'geopoint' || column.type === 'location') && cellValue && typeof cellValue === 'object') {
                        let lat, lng;
                        if (cellValue.type === 'Point' && Array.isArray(cellValue.coordinates) && cellValue.coordinates.length >= 2) {
                          lng = cellValue.coordinates[0];
                          lat = cellValue.coordinates[1];
                        } else if (cellValue.lat !== undefined && cellValue.lng !== undefined) {
                          lat = cellValue.lat;
                          lng = cellValue.lng;
                        }
                        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
                          geopointUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                        }
                      }

                      // Build link if linkPattern is defined
                      const columnLink = column.linkPattern ? buildLinkFromPattern(column.linkPattern, item) : null;

                      return (
                        <td
                          key={column.key}
                          className={`px-4 py-2 text-sm ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          } ${
                            column.editable && canUpdate && !isInlineSelect && !isInlineBoolean
                              ? `cursor-pointer ${isDarkMode ? 'hover:bg-blue-900/20' : 'hover:bg-blue-50'}`
                              : ''
                          }`}
                          style={{
                            width: columnWidths[column.key] || 'auto',
                            maxWidth: column.maxWidth || 300,
                            minWidth: 100
                          }}
                          onClick={() => !isEditing && !isInlineSelect && !isInlineBoolean && column.editable && startCellEdit(item, column)}
                          title={!isInlineSelect && !isInlineBoolean && column.editable && canUpdate ? 'Click to edit' : formattedValue}
                        >
                          {isInlineSelect ? (
                            // Inline select dropdown (always visible)
                            <select
                              value={cellValue || ''}
                              onChange={(e) => handleCellEdit(item, column.key, e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select...</option>
                              {(column.schema?.options || []).map((opt) => {
                                const optValue = typeof opt === 'object' && opt !== null ? opt.value : opt;
                                const optLabel = typeof opt === 'object' && opt !== null ? (opt.label ?? opt.value) : opt;
                                return (
                                  <option key={optValue} value={optValue}>
                                    {optLabel}
                                  </option>
                                );
                              })}
                            </select>
                          ) : isInlineBoolean ? (
                            // Inline boolean checkbox (always visible, toggles immediately)
                            <input
                              type="checkbox"
                              checked={!!cellValue}
                              onChange={(e) => handleCellEdit(item, column.key, e.target.checked)}
                              className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                            />
                          ) : isEditing ? (
                            <InlineEditCell
                              column={column}
                              value={editingValue}
                              onChange={setEditingValue}
                              onSave={() => handleCellEdit(item, column.key, editingValue)}
                              onCancel={cancelCellEdit}
                            />
                          ) : isImageFile ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={cellValue.url}
                                alt={cellValue.name || 'Image'}
                                className="w-10 h-10 object-cover rounded border border-gray-200"
                                loading="lazy"
                              />
                              <span className="truncate" title={formattedValue}>
                                {formattedValue}
                              </span>
                            </div>
                          ) : geopointUrl ? (
                            <a
                              href={geopointUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                              title={formattedValue}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">Abrir en mapa</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                            </a>
                          ) : columnLink && formattedValue ? (
                            // Render as a clickable link if linkPattern is defined
                            <Link
                              href={columnLink}
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                              title={`View: ${formattedValue}`}
                            >
                              <span className="truncate">{formattedValue}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="truncate overflow-hidden text-ellipsis" title={formattedValue || 'Click to edit'}>
                                {formattedValue || (column.editable && canUpdate ? <span className="text-gray-400 italic">Click to set</span> : '')}
                              </span>
                              {column.editable && canUpdate && formattedValue && (
                                <span className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 flex-shrink-0">✎</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {(canUpdate || canDelete || hasViewLink || onSelectItem || actionButtons.length > 0) && (
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasViewLink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewItem(item)}
                              className="h-8 w-8 p-0"
                              title="View in new tab"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}

                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              className="h-8 w-8 p-0"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}

                          {onSelectItem && !hasViewLink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelectItem(item)}
                              className="h-8 w-8 p-0"
                              title="Select"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {enableVirtualScrolling && (
                <tr style={{ height: totalHeight - offsetY - (visibleData.length * (compact ? 40 : 48)) }}>
                  <td colSpan={columns.length + (enableSelection ? 1 : 0) + (showRowNumbers ? 1 : 0) + ((canUpdate || canDelete || hasViewLink || onSelectItem || actionButtons.length > 0) ? 1 : 0)} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!enableVirtualScrolling && totalPages > 1 && (
        <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, serverSide ? totalCount : processedData.length)} of {serverSide ? totalCount : processedData.length} results
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className={`text-sm px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (canCreate || canUpdate) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-gray-900' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {editingItem?.id || editingItem?._id ? 'Edit Item' : 'Add New Item'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            <FormBuilder
              key={editingItem?.id || editingItem?._id || 'new'}
              schema={
                // Filter out timestamp fields from schema for editing
                activeSchema ? Object.fromEntries(
                  Object.entries(activeSchema).filter(([key]) =>
                    !['created_at', 'updated_at', 'createdAt', 'updatedAt', 'created_by', 'updated_by'].includes(key)
                  )
                ) : {}
              }
              initialData={editingItem || {}}
              onSubmit={handleCreateOrUpdate}
              onCancel={() => {
                setIsEditModalOpen(false);
                setEditingItem(null);
              }}
              config={{
                showCancel: true,
                submitText: (editingItem?.id || editingItem?._id) ? 'Update' : 'Create'
              }}
            />
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}
    </div>
  );
}

// Export both as default and named for flexibility
export { JasonTable };

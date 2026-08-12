// SelectInput.jsx - Enhanced select input with search functionality
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertCircle, ChevronDown, Search, X, List } from 'lucide-react';
import { formatSelectOptions } from '../utils/formatting';
import { useFormBuilderLanguage } from '../i18n/useFormBuilderLanguage';

/**
 * Enhanced select input with search and multi-select support
 */
export default function SelectInput({
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
  language = null, // Optional language override
  ...props
}) {
  // i18n hook
  const { t, isSpanish } = useFormBuilderLanguage(language);

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log(`SelectInput [${name}]:`, { value, options: fieldSchema.options, formattedOptions: formatSelectOptions(fieldSchema.options) });
  }
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const {
    label,
    placeholder = t('selectInput.placeholder'),
    help,
    required = false,
    options = [],
    multiple = false,
    searchable = false,
    clearable = true,
    showIcon = false,
    emptyText = t('selectInput.noOptions'),
    searchPlaceholder = t('selectInput.searchPlaceholder'),
    maxHeight = '200px'
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || fieldSchema.readOnly;
  
  // Memoize formatted options to prevent infinite re-renders
  const formattedOptions = useMemo(() => formatSelectOptions(options), [options]);

  // Handle multiple values
  const selectedValues = multiple ? (Array.isArray(value) ? value : []) : [value];
  const hasValue = multiple ? selectedValues.length > 0 : Boolean(value);

  // Filter options based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOptions(formattedOptions);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = formattedOptions.filter(option =>
        option.label.toLowerCase().includes(query) ||
        String(option.value).toLowerCase().includes(query)
      );
      setFilteredOptions(filtered);
    }
  }, [searchQuery, formattedOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchable]);

  const handleToggleDropdown = (e) => {
    // Prevent event bubbling that might cause re-renders
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!isDisabled) {
      setIsOpen(prev => !prev);
      setSearchQuery('');
    }
  };

  const handleSelectOption = (optionValue) => {
    if (multiple) {
      const newValue = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      
      if (onChange) {
        onChange(newValue);
      }
    } else {
      if (onChange) {
        onChange(optionValue);
      }
      setIsOpen(false);
    }
    setSearchQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange(multiple ? [] : '');
    }
  };

  const handleRemoveItem = (valueToRemove, e) => {
    e.stopPropagation();
    if (multiple) {
      const newValue = selectedValues.filter(v => v !== valueToRemove);
      if (onChange) {
        onChange(newValue);
      }
    }
  };

  const handleBlur = (e) => {
    // Don't trigger blur if clicking within the component
    if (containerRef.current && containerRef.current.contains(e.relatedTarget)) {
      return;
    }
    
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = (e) => {
    if (onFocus) {
      onFocus(e);
    }
  };

  // Get display text for selected values
  const getDisplayText = () => {
    if (!hasValue) return placeholder;

    if (multiple) {
      const count = selectedValues.length;
      const baseText = t('selectInput.selected');
      // For Spanish, handle plural correctly
      if (isSpanish) {
        return `${count} ${count > 1 ? 'seleccionados' : 'seleccionado'}`;
      }
      return `${count} ${baseText}`;
    }

    const selectedOption = formattedOptions.find(opt => {
      // Handle both string and exact matches
      return String(opt.value) === String(value);
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`SelectInput [${name}] Display:`, {
        value,
        hasValue,
        selectedOption,
        availableOptions: formattedOptions.map(opt => ({ value: opt.value, label: opt.label }))
      });
    }

    return selectedOption ? selectedOption.label : value;
  };

  // Get selected option labels for multiple selection
  const getSelectedLabels = () => {
    return selectedValues
      .map(val => {
        const option = formattedOptions.find(opt => opt.value === val);
        return option ? option.label : val;
      })
      .filter(Boolean);
  };

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      {/* Label */}
      {showLabel && label && (
        <Label htmlFor={inputId} className="flex items-center gap-1">
          {label}
          {required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </Label>
      )}

      {/* Select Container */}
      <div>
        {/* Selected Values Display (Multiple) */}
        {multiple && selectedValues.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {getSelectedLabels().map((label, index) => {
              const value = selectedValues[index];
              return (
                <span
                  key={`${value}-${index}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveItem(value, e)}
                    className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                    disabled={isDisabled}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Button wrapper - relative container for absolute positioned icons */}
        <div className="relative">
          {/* Main Select Button */}
          <button
            type="button"
            id={inputId}
            onClick={handleToggleDropdown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            disabled={isDisabled}
            className={`
              w-full px-3 py-2 text-left bg-white dark:bg-gray-800 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
              ${isDisabled ? 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'hover:border-gray-400 dark:hover:border-gray-500'}
              ${showError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}
              ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : ''}
              ${clearable && hasValue ? 'pr-16' : 'pr-10'}
              ${showIcon ? 'pl-10' : ''}
            `}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-invalid={showError}
            aria-describedby={
              showError ? `${inputId}-error` :
              help ? `${inputId}-help` : undefined
            }
          >
            <div className="flex items-center justify-between">
              <span className={`truncate ${!hasValue ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {getDisplayText()}
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Icon - Positioned absolutely at left */}
          {showIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
              <List className="h-4 w-4" />
            </div>
          )}

          {/* Clear Button - Positioned absolutely within the button wrapper */}
          {clearable && hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 z-10"
              disabled={isDisabled}
              title={t('selectInput.clearSelection')}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Dropdown */}
          {isOpen && (
            <div
              className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg dark:shadow-gray-950/50 overflow-hidden"
            >
              {/* Search Input */}
              {searchable && (
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>
              )}

              {/* Options List */}
              <div className="max-h-48 overflow-auto bg-white dark:bg-gray-900">
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm text-center">
                    {searchQuery ? t('selectInput.noResults') : emptyText}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <button
                        key={`${option.value}-${index}`}
                        type="button"
                        onClick={() => handleSelectOption(option.value)}
                        className={`
                          w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 focus:outline-none
                          ${isSelected ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}
                        `}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          {multiple && isSelected && (
                            <span className="text-blue-600 dark:text-blue-400">✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {showError && (
        <div 
          id={`${inputId}-error`}
          className="text-red-500 text-sm flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Help text */}
      {help && !showError && (
        <div
          id={`${inputId}-help`}
          className="text-gray-500 dark:text-gray-400 text-sm"
        >
          {help}
        </div>
      )}
    </div>
  );
}
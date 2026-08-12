'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { AlertCircle, Plus, X, GripVertical } from 'lucide-react';

/**
 * ArrayInput - Add/remove list of items
 *
 * Schema:
 * {
 *   type: 'array',
 *   label: 'Working Hours',
 *   items: { type: 'text', placeholder: '10:00-13:00' },
 *   maxItems: 10,
 *   minItems: 1
 * }
 */
export default function ArrayInput({
  id,
  name,
  value = [],
  onChange,
  onBlur,
  fieldSchema = {},
  error = null,
  touched = false,
  disabled = false,
  className = '',
}) {
  const {
    label,
    help,
    required = false,
    items: itemSchema = {},
    maxItems,
    minItems,
    placeholder: globalPlaceholder,
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;

  // Normalize value to array
  const arrayValue = Array.isArray(value) ? value : (value ? [value] : []);

  const canAdd = !maxItems || arrayValue.length < maxItems;
  const canRemove = !minItems || arrayValue.length > minItems;

  const handleAdd = () => {
    if (!canAdd || disabled) return;
    const defaultVal = itemSchema.default || '';
    onChange([...arrayValue, defaultVal]);
  };

  const handleRemove = (index) => {
    if (!canRemove || disabled) return;
    const next = arrayValue.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleChange = (index, newVal) => {
    const next = [...arrayValue];
    next[index] = itemSchema.type === 'number' ? (newVal === '' ? '' : Number(newVal)) : newVal;
    onChange(next);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canAdd) handleAdd();
    }
    // Backspace on empty item removes it
    if (e.key === 'Backspace' && !arrayValue[index] && arrayValue.length > 1 && canRemove) {
      e.preventDefault();
      handleRemove(index);
    }
  };

  const itemPlaceholder = itemSchema.placeholder || globalPlaceholder || '';
  const inputType = itemSchema.type === 'number' ? 'number' : 'text';

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={inputId} className="flex items-center gap-1">
          {label}
          {required && <span className="text-red-500 text-sm">*</span>}
        </Label>
      )}

      <div className="space-y-1.5">
        {arrayValue.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5 group">
            <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">{index + 1}</span>
            <input
              type={inputType}
              value={item ?? ''}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onBlur={onBlur}
              placeholder={itemPlaceholder}
              disabled={disabled}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {canRemove && !disabled && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {canAdd && !disabled && (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add item
        </button>
      )}

      {showError && (
        <div id={`${inputId}-error`} className="text-red-500 text-sm flex items-center gap-1" role="alert">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {help && !showError && (
        <div id={`${inputId}-help`} className="text-muted-foreground text-sm">{help}</div>
      )}
    </div>
  );
}

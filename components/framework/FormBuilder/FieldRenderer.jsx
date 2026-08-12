// FieldRenderer.jsx - Shared field rendering component for FormBuilder
'use client';

import React from 'react';
import {
  TextInput,
  LocationTextInput,
  TextareaInput,
  PhoneInput,
  LocationInput,
  SelectInput,
  RelationInput,
  CheckboxInput,
  DateInput,
  RichTextInput,
  TiptapRichTextInput,
  PriceInput,
  ScaleInput,
  ArrayInput
} from './inputs';

// Lazy load FileUpload component
const FileUpload = React.lazy(() => import('../FileUpload'));

/**
 * Renders a single form field based on its schema type
 */
export default function FieldRenderer({
  fieldName,
  fieldSchema,
  value,
  error,
  touched,
  disabled,
  language,
  autoFocus = false,
  onChange,
  onBlur,
  onLocationUpdate
}) {
  // Normalize fieldSchema if it's a string
  const schema = typeof fieldSchema === 'string'
    ? { type: fieldSchema, label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1), required: false }
    : fieldSchema;

  const commonProps = {
    id: fieldName,
    name: fieldName,
    value: value ?? '',
    onChange: (newValue) => onChange(fieldName, newValue),
    onBlur: () => onBlur(fieldName),
    fieldSchema: schema,
    error,
    touched,
    disabled,
    language,
    autoFocus
  };

  // Check for compact image/file variants
  const isCompactVariant = schema.variant === 'avatar' || schema.variant === 'square';

  switch (schema.type) {
    case 'rich_text':
      return <TiptapRichTextInput key={fieldName} {...commonProps} />;

    case 'textarea':
      return <TextareaInput key={fieldName} {...commonProps} />;

    case 'phone':
    case 'tel':
      return <PhoneInput key={fieldName} {...commonProps} />;

    case 'geopoint':
    case 'location':
      return <LocationInput key={fieldName} {...commonProps} />;

    case 'select':
      return <SelectInput key={fieldName} {...commonProps} />;

    case 'array':
      if (schema.accept) {
        // File upload array
        return (
          <React.Suspense key={fieldName} fallback={<div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />}>
            <div className="space-y-2">
              <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {schema.label || fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
                {schema.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FileUpload
                value={value}
                onChange={(files) => onChange(fieldName, files)}
                multiple={schema.multiple !== false}
                accept={Array.isArray(schema.accept) ? schema.accept : [schema.accept]}
                maxSize={schema.maxSize || 10 * 1024 * 1024}
                maxFiles={schema.maxItems || schema.maxFiles || 10}
                disabled={disabled}
                placeholder={schema.placeholder}
                showPreviews={schema.showPreviews !== false}
                className="w-full"
              />
              {schema.help && <p className="text-sm text-gray-500 dark:text-gray-400">{schema.help}</p>}
              {error && touched && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
          </React.Suspense>
        );
      }
      if (schema.options) {
        // Array with predefined options → multi-select
        return <SelectInput key={fieldName} {...commonProps} />;
      }
      // Generic array → add/remove list
      return <ArrayInput key={fieldName} {...commonProps} />;

    case 'relation':
      return <RelationInput key={fieldName} {...commonProps} />;

    case 'checkbox':
    case 'boolean':
      return <CheckboxInput key={fieldName} {...commonProps} />;

    case 'date':
    case 'datetime-local':
    case 'time':
      return <DateInput key={fieldName} {...commonProps} />;

    case 'file':
    case 'files':
    case 'image':
    case 'video':
    case 'audio':
      return (
        <React.Suspense key={fieldName} fallback={<div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />}>
          <div className={`space-y-2 ${isCompactVariant ? 'flex flex-col items-center' : ''}`}>
            <label
              htmlFor={fieldName}
              className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${isCompactVariant ? 'text-center' : ''}`}
            >
              {schema.label || fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
              {schema.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <FileUpload
              value={value}
              onChange={(files) => onChange(fieldName, files)}
              multiple={isCompactVariant ? false : (schema.type === 'files' || schema.multiple === true)}
              accept={schema.accept || (
                schema.type === 'image' ? ['image/*'] :
                schema.type === 'video' ? ['video/*'] :
                schema.type === 'audio' ? ['audio/*'] :
                ['image/*', 'video/*', 'audio/*', 'application/pdf']
              )}
              maxSize={schema.maxSize || (schema.type === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024)}
              maxFiles={isCompactVariant ? 1 : (schema.maxFiles || 10)}
              disabled={disabled}
              placeholder={schema.placeholder}
              showPreviews={schema.showPreviews !== false}
              variant={schema.variant || 'default'}
              size={schema.pickerSize || 'lg'}
              className={isCompactVariant ? '' : 'w-full'}
            />
            {schema.help && (
              <p className={`text-sm text-gray-500 dark:text-gray-400 ${isCompactVariant ? 'text-center' : ''}`}>
                {schema.help}
              </p>
            )}
            {error && touched && (
              <p className={`text-sm text-red-600 dark:text-red-400 ${isCompactVariant ? 'text-center' : ''}`}>
                {error}
              </p>
            )}
          </div>
        </React.Suspense>
      );

    case 'price':
      return <PriceInput key={fieldName} {...commonProps} />;

    case 'scale':
    case 'rating':
    case 'range':
      return <ScaleInput key={fieldName} {...commonProps} />;

    case 'number':
      return <TextInput key={fieldName} {...commonProps} type="number" />;

    case 'text':
    case 'string':
    case 'email':
    case 'url':
    case 'password':
    default:
      // Phone validation
      if (schema.validation === 'phone') {
        return <PhoneInput key={fieldName} {...commonProps} />;
      }

      // Address with location linking
      if (schema.location && schema.location_ref) {
        return (
          <LocationTextInput
            key={fieldName}
            {...commonProps}
            onLocationUpdate={onLocationUpdate}
            locationFieldName={schema.location_ref}
            language={schema.language || 'es'}
            format={schema.format || 'object'}
            countryCode={schema.countryCode}
          />
        );
      }

      // Auto-detect textarea for description/bio/notes fields
      if (fieldName === 'description' || fieldName === 'bio' || fieldName === 'notes' ||
          (schema.help && schema.help.length > 50)) {
        return <TextareaInput key={fieldName} {...commonProps} />;
      }

      return <TextInput key={fieldName} {...commonProps} />;
  }
}

FieldRenderer.displayName = 'FieldRenderer';

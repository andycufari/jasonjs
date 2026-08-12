// FormBuilder.jsx - Unified form builder with auto-step detection
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useApp } from '@/core/app';
import { useFormBuilderLanguage } from './FormBuilder/i18n/useFormBuilderLanguage';
import { validateField, validateForm } from './FormBuilder/utils/validation';
import FieldRenderer from './FormBuilder/FieldRenderer';
import StepIndicator from './FormBuilder/steps/StepIndicator';
import { ANIMATION_VARIANTS } from './FormBuilder/steps/StepContainer';

// Coerce form values to their proper types based on schema
function coerceFormData(data, schema) {
  if (!data || !schema) return data;

  const coerced = { ...data };

  for (const [field, value] of Object.entries(coerced)) {
    const fieldSchema = schema[field];
    if (!fieldSchema || value === undefined || value === null || value === '') continue;

    switch (fieldSchema.type) {
      case 'number':
        const num = parseFloat(value);
        coerced[field] = isNaN(num) ? value : num;
        break;
      case 'boolean':
        if (typeof value === 'string') {
          coerced[field] = value === 'true' || value === '1';
        }
        break;
    }
  }

  return coerced;
}

/**
 * FormBuilder - Unified form component with auto-step detection
 *
 * Automatically detects multi-step forms when schema fields have `step` property.
 * Falls back to single-page form when no steps are defined.
 */
export default function FormBuilder({
  schema,
  initialData = {},
  onSubmit,
  onCancel,
  onStepChange,
  config = {}
}) {
  // App object for database and UI operations
  const app = useApp();

  // i18n hook for translations
  const { t, language: detectedLanguage } = useFormBuilderLanguage(config.language);
  const language = config.language || detectedLanguage;

  // Generate stable timestamp reference once
  const nowTimestamp = useRef(null);
  if (nowTimestamp.current === null) {
    nowTimestamp.current = new Date().toISOString();
  }

  // Configuration with defaults
  const {
    // Step mode config
    animation = 'slideUp',
    showIndicator = true,
    indicatorVariant = 'dots',
    showStepCount = true,
    validateOnStep = true,
    showPressEnter = true,
    autoFocus = true,

    // Form config
    database = null,  // Auto-save to this database when onSubmit not provided
    fields = null,
    exclude = [],
    include = [],
    submitText,
    cancelText = t('formBuilder.cancel'),
    nextText = t('stepFormBuilder.next'),
    previousText = t('stepFormBuilder.previous'),
    showCancel = false,
    className = '',
    disabled = false,
    validateOnBlur = true,
    validateOnChange = false,
    resetOnSuccess = true,
    showRequiredIndicator = false,
    theme = {},

    // Auto-save config (persists form data to localStorage)
    autoSave = true,
    autoSaveKey = null, // Custom key, or auto-generated from pathname + schema hash
    autoSaveDebounce = 500 // Debounce delay in ms
  } = config;

  // Process schema strings to objects and auto-generate labels
  const processedSchema = useMemo(() => {
    if (!schema) return {};

    const processed = {};
    Object.entries(schema).forEach(([fieldName, fieldSchema]) => {
      if (typeof fieldSchema === 'string') {
        processed[fieldName] = {
          type: fieldSchema,
          label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' '),
          required: false
        };
      } else {
        // Auto-generate label from field name if not provided
        const autoLabel = fieldName
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        processed[fieldName] = {
          ...fieldSchema,
          label: fieldSchema.label || autoLabel
        };
      }
    });
    return processed;
  }, [schema]);

  // Detect if schema has steps
  const { steps, hasSteps } = useMemo(() => {
    if (!processedSchema || Object.keys(processedSchema).length === 0) {
      return { steps: [], hasSteps: false };
    }

    // Group fields by step number
    const stepGroups = {};
    let foundSteps = false;

    Object.entries(processedSchema).forEach(([fieldName, fieldSchema]) => {
      // Skip hidden fields and system fields
      if (fieldSchema.hidden) return;
      if (['id', '_id', 'createdAt', 'updatedAt', 'primary_key'].includes(fieldName)) return;

      const stepNumber = fieldSchema.step || 1;
      if (fieldSchema.step) foundSteps = true;

      if (!stepGroups[stepNumber]) {
        stepGroups[stepNumber] = {
          fields: [],
          title: fieldSchema.stepTitle || null,
          subtitle: fieldSchema.stepSubtitle || null,
          image: fieldSchema.stepImage || null
        };
      }
      stepGroups[stepNumber].fields.push(fieldName);
    });

    // Convert to array sorted by step number
    const sortedSteps = Object.entries(stepGroups)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([stepNumber, stepData], index) => ({
        ...stepData,
        index,
        stepNumber: parseInt(stepNumber)
      }));

    return {
      steps: sortedSteps,
      hasSteps: foundSteps && sortedSteps.length > 1
    };
  }, [processedSchema]);

  // Get fields to show (for non-step mode)
  const fieldsToShow = useMemo(() => {
    if (hasSteps) return []; // Steps mode handles its own fields

    let fieldsArray = Object.keys(processedSchema);

    if (include.length > 0) {
      fieldsArray = fieldsArray.filter(field => include.includes(field));
    }
    if (fields && fields.length > 0) {
      fieldsArray = fieldsArray.filter(field => fields.includes(field));
    }
    if (exclude.length > 0) {
      fieldsArray = fieldsArray.filter(field => !exclude.includes(field));
    }

    // Filter hidden and system fields
    fieldsArray = fieldsArray.filter(field => {
      const fieldSchema = processedSchema[field];
      if (fieldSchema.hidden) return false;
      if (!initialData.id && ['id', '_id', 'createdAt', 'updatedAt', 'primary_key'].includes(field)) return false;
      return true;
    });

    // Sort by order
    fieldsArray.sort((a, b) => {
      const orderA = processedSchema[a].order || 999;
      const orderB = processedSchema[b].order || 999;
      return orderA - orderB;
    });

    return fieldsArray;
  }, [processedSchema, fields, include, exclude, initialData.id, hasSteps]);

  // Process initial data
  const processedInitialData = useMemo(() => {
    const processed = { ...initialData };

    if (processedSchema) {
      Object.entries(processedSchema).forEach(([fieldName, fieldSchema]) => {
        // Determine if this is a media/file field
        const isMediaField = ['file', 'files', 'image', 'video', 'audio'].includes(fieldSchema.type);

        // Parse JSON strings for file/image fields (handles both object and array JSON)
        if (isMediaField && typeof processed[fieldName] === 'string') {
          const trimmed = processed[fieldName].trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              processed[fieldName] = JSON.parse(processed[fieldName]);
            } catch (error) {
              console.warn(`Failed to parse JSON for field ${fieldName}:`, error);
            }
          }
        }

        // Set defaults
        if (processed[fieldName] === undefined && fieldSchema.default !== undefined) {
          processed[fieldName] = fieldSchema.default === 'now'
            ? nowTimestamp.current
            : fieldSchema.default;
        }
      });
    }

    return processed;
  }, [initialData, processedSchema]);

  // Generate stable auto-save key
  const storageKey = useMemo(() => {
    if (!autoSave) return null;
    if (autoSaveKey) return `form_draft_${autoSaveKey}`;

    // Generate key from pathname + schema fields hash + record ID
    // Include record ID so editing different records doesn't share drafts
    const pathname = typeof window !== 'undefined' ? window.location.pathname : 'form';
    const schemaHash = Object.keys(schema || {}).sort().join('_').slice(0, 32);
    const recordId = initialData?.id || initialData?._id || 'new';
    return `form_draft_${pathname}_${schemaHash}_${recordId}`;
  }, [autoSave, autoSaveKey, schema, initialData?.id, initialData?._id]);

  // Load saved draft from localStorage
  const loadSavedDraft = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if draft is not too old (24 hours)
        if (parsed._savedAt && Date.now() - parsed._savedAt < 24 * 60 * 60 * 1000) {
          const { _savedAt, _currentStep, ...data } = parsed;
          return { data, currentStep: _currentStep || 0 };
        } else {
          // Clear expired draft
          window.localStorage.removeItem(storageKey);
        }
      }
    } catch (e) {
      console.warn('[FormBuilder] Failed to load draft:', e);
    }
    return null;
  }, [storageKey]);

  // Clear saved draft
  const clearSavedDraft = useCallback(() => {
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Initialize state with saved draft if available
  const savedDraft = useMemo(() => loadSavedDraft(), [loadSavedDraft]);

  // State
  const [currentStep, setCurrentStep] = useState(savedDraft?.currentStep || 0);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState(() => {
    // Merge: defaults < initialData < savedDraft
    if (savedDraft?.data && Object.keys(savedDraft.data).length > 0) {
      return { ...processedInitialData, ...savedDraft.data };
    }
    return processedInitialData;
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);

  // Ref for stable callbacks
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Auto-save to localStorage (debounced)
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (!autoSave || !storageKey || typeof window === 'undefined') return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const dataToSave = {
          ...formData,
          _savedAt: Date.now(),
          _currentStep: currentStep
        };
        window.localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      } catch (e) {
        console.warn('[FormBuilder] Failed to save draft:', e);
      }
    }, autoSaveDebounce);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, currentStep, autoSave, storageKey, autoSaveDebounce]);

  // Current step data (for step mode)
  const currentStepData = hasSteps ? (steps[currentStep] || { fields: [] }) : null;
  const currentFields = hasSteps ? (currentStepData?.fields || []) : fieldsToShow;
  const isLastStep = hasSteps ? currentStep === steps.length - 1 : true;
  const isFirstStep = currentStep === 0;

  // Dynamic submit text
  const finalSubmitText = submitText || (initialData.id ? t('formBuilder.update') : t('formBuilder.create'));

  // Field change handler
  const handleFieldChange = useCallback((fieldName, value) => {
    console.log('[FormBuilder] handleFieldChange:', fieldName, value);
    setFormData(prev => {
      const newData = { ...prev, [fieldName]: value };
      console.log('[FormBuilder] New formData:', newData);
      return newData;
    });
    setTouched(prev => ({ ...prev, [fieldName]: true }));

    if (validateOnChange) {
      const fieldSchema = processedSchema?.[fieldName];
      if (fieldSchema) {
        const error = validateField(fieldName, value, fieldSchema, language);
        setErrors(prev => ({ ...prev, [fieldName]: error }));
      }
    } else {
      setErrors(prev => prev[fieldName] ? { ...prev, [fieldName]: null } : prev);
    }
  }, [validateOnChange, processedSchema, language]);

  // Location update handler
  const handleLocationUpdate = useCallback((locationFieldName, coordinates) => {
    if (locationFieldName && processedSchema?.[locationFieldName]) {
      setFormData(prev => {
        const newData = { ...prev, [locationFieldName]: coordinates };
        if (coordinates?.address) {
          const addressField = Object.keys(processedSchema).find(
            key => processedSchema[key].location_ref === locationFieldName
          );
          if (addressField) {
            newData[addressField] = coordinates.address;
          }
        }
        return newData;
      });
      setTouched(prev => ({ ...prev, [locationFieldName]: true }));
      setErrors(prev => prev[locationFieldName] ? { ...prev, [locationFieldName]: null } : prev);
    }
  }, [processedSchema]);

  // Field blur handler
  const handleFieldBlur = useCallback((fieldName) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));

    if (validateOnBlur) {
      const fieldSchema = processedSchema?.[fieldName];
      if (fieldSchema) {
        const value = formDataRef.current[fieldName];
        const error = validateField(fieldName, value, fieldSchema, language);
        setErrors(prev => ({ ...prev, [fieldName]: error }));
      }
    }
  }, [validateOnBlur, processedSchema, language]);

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    if (!validateOnStep || !hasSteps) return true;

    let isValid = true;
    const newErrors = {};

    currentFields.forEach(fieldName => {
      const fieldSchema = processedSchema[fieldName];
      if (!fieldSchema) return;

      const value = formDataRef.current[fieldName];
      const error = validateField(fieldName, value, fieldSchema, language);

      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(prev => ({ ...prev, ...newErrors }));

    if (!isValid) {
      const newTouched = {};
      currentFields.forEach(field => { newTouched[field] = true; });
      setTouched(prev => ({ ...prev, ...newTouched }));
    }

    return isValid;
  }, [currentFields, processedSchema, language, validateOnStep, hasSteps]);

  // Navigation
  const goToNextStep = useCallback(() => {
    if (!validateCurrentStep()) return;
    if (currentStep < steps.length - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
      onStepChange?.(currentStep + 1, currentStep);
    }
  }, [currentStep, steps.length, validateCurrentStep, onStepChange]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
      onStepChange?.(currentStep - 1, currentStep);
    }
  }, [currentStep, onStepChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!showPressEnter || !hasSteps) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        if (target.tagName !== 'TEXTAREA' && !target.closest('[data-rich-text]')) {
          e.preventDefault();
          if (isLastStep) {
            handleSubmit(e);
          } else {
            goToNextStep();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goToNextStep, isLastStep, showPressEnter, hasSteps]);

  // Form submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Validate all fields
    const allFields = hasSteps
      ? steps.flatMap(step => step.fields || [])
      : fieldsToShow;

    const { isValid, errors: validationErrors } = validateForm(
      formData,
      processedSchema,
      allFields,
      language
    );

    setErrors(validationErrors);

    if (!isValid) {
      // In step mode, find first step with errors
      if (hasSteps) {
        for (let i = 0; i < steps.length; i++) {
          const stepFields = steps[i].fields || [];
          if (stepFields.some(field => validationErrors[field])) {
            setCurrentStep(i);
            break;
          }
        }
      }

      const allTouched = {};
      allFields.forEach(field => { allTouched[field] = true; });
      setTouched(allTouched);
      return;
    }

    setLoading(true);
    clearSavedDraft();

    // Coerce values to proper types (e.g., string "2023" → number 2023)
    const submissionData = coerceFormData(formData, processedSchema);

    try {
      let result;

      if (onSubmit) {
        // Custom onSubmit handler provided
        result = await onSubmit(submissionData);
      } else if (database) {
        // Auto-save to database when no onSubmit provided
        const db = app.db.use(database);
        const recordId = initialData.id || initialData._id;

        if (recordId) {
          // Update existing record
          result = await db.update(recordId, submissionData);
          app.ui.toast(t('formBuilder.updated'), { type: 'success' });
        } else {
          // Create new record
          result = await db.add(submissionData);
          app.ui.toast(t('formBuilder.created'), { type: 'success' });
        }
      } else {
        // Neither onSubmit nor database provided
        console.warn('[FormBuilder] No onSubmit or database configured - form submission has no effect');
        return;
      }

      const isSuccess = result === true || (result && typeof result === 'object' && result.success !== false);
      if (isSuccess) {
        if (resetOnSuccess && !initialData.id && !initialData._id) {
          setFormData({});
          setTouched({});
          setErrors({});
          if (hasSteps) setCurrentStep(0);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error?.message || String(error));
      app.ui.toast(error?.message || t('formBuilder.error'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Animation variants for step mode
  const animationVariants = ANIMATION_VARIANTS[animation] || ANIMATION_VARIANTS.slideUp;

  // Validation
  if (!schema) {
    return (
      <div className="p-4 border border-red-200 dark:border-red-800 rounded-md bg-red-50 dark:bg-red-900/30">
        <div className="text-red-800 dark:text-red-200 font-medium">{t('formBuilder.configError')}</div>
        <div className="text-red-600 dark:text-red-400 text-sm mt-1">{t('formBuilder.schemaRequired')}</div>
      </div>
    );
  }

  if (currentFields.length === 0 && !hasSteps) {
    return (
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
        <div className="text-gray-600 dark:text-gray-400 text-center">{t('formBuilder.noFields')}</div>
      </div>
    );
  }

  // Render fields
  const renderFields = (fieldList) => (
    <div className="space-y-4">
      {fieldList.map((fieldName, index) => (
        <FieldRenderer
          key={fieldName}
          fieldName={fieldName}
          fieldSchema={processedSchema[fieldName]}
          value={formData[fieldName]}
          error={errors[fieldName]}
          touched={touched[fieldName]}
          disabled={disabled || loading || processedSchema[fieldName]?.disabled}
          language={language}
          autoFocus={autoFocus && index === 0}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          onLocationUpdate={handleLocationUpdate}
        />
      ))}
    </div>
  );


  // ========== STEP MODE ==========
  if (hasSteps) {
    return (
      <div className={`form-builder step-mode ${className}`}>
        {/* Step indicator */}
        {showIndicator && steps.length > 1 && (
          <div className="mb-8">
            <StepIndicator
              currentStep={currentStep + 1}
              totalSteps={steps.length}
              variant={indicatorVariant}
              theme={theme}
            />
            {showStepCount && (
              <motion.p
                className="text-sm text-gray-500 dark:text-gray-400 text-center mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={currentStep}
              >
                {t('stepFormBuilder.stepOf', { current: currentStep + 1, total: steps.length })}
              </motion.p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={animationVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {/* Step title/subtitle */}
              {(currentStepData?.title || currentStepData?.subtitle) && (
                <div className="text-center mb-6">
                  {currentStepData.title && (
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                      {currentStepData.title}
                    </h2>
                  )}
                  {currentStepData.subtitle && (
                    <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mt-2">
                      {currentStepData.subtitle}
                    </p>
                  )}
                </div>
              )}

              {/* Fields */}
              {renderFields(currentFields)}

              {/* Navigation buttons */}
              <div className="mt-8 flex items-center justify-between gap-4">
                <div className="flex-1">
                  {!isFirstStep && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={goToPreviousStep}
                      disabled={disabled || loading}
                      className="group"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                      {previousText}
                    </Button>
                  )}
                </div>

                {showPressEnter && !isLastStep && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                    {t('stepFormBuilder.pressEnter')}
                  </span>
                )}

                <div className="flex-1 flex justify-end">
                  {isLastStep ? (
                    <Button
                      type="submit"
                      disabled={disabled || loading}
                      className="group min-w-[120px]"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {t('formBuilder.sending')}
                        </>
                      ) : (
                        <>
                          {finalSubmitText}
                          <Check className="w-4 h-4 ml-2 group-hover:scale-110 transition-transform" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={goToNextStep}
                      disabled={disabled || loading}
                      className="group min-w-[120px]"
                      size="lg"
                    >
                      {nextText}
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Cancel button */}
              {showCancel && onCancel && (
                <div className="mt-4 text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={onCancel}
                    disabled={disabled || loading}
                    className="text-gray-500"
                  >
                    {cancelText}
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </form>
      </div>
    );
  }

  // ========== REGULAR MODE ==========
  return (
    <form onSubmit={handleSubmit} className={`form-builder ${className}`}>
      {showRequiredIndicator && fieldsToShow.some(field => processedSchema[field].required) && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('formBuilder.requiredIndicator')}
        </div>
      )}

      {renderFields(fieldsToShow)}

      <div className="flex gap-3 pt-6">
        <Button
          type="submit"
          disabled={disabled || loading}
          className="flex-1"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('formBuilder.sending')}
            </>
          ) : (
            finalSubmitText
          )}
        </Button>

        {showCancel && onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={disabled || loading}
          >
            {cancelText}
          </Button>
        )}
      </div>
    </form>
  );
}

FormBuilder.displayName = 'FormBuilder';

// Export for backward compatibility
export { ANIMATION_VARIANTS };

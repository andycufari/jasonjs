"use client";
import React, { useState, useEffect } from 'react';
import { z } from 'zod';

// Lightweight local storage hook
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

// Helper function declaration (will be hoisted)
function createZodSchema(validation) {
    try {
        let schema = z.string();

        if (validation.required) {
            schema = schema.nonempty(validation.messages?.required || 'This field is required');
        }
        if (validation.min) {
            schema = schema.min(validation.min, validation.messages?.min);
        }
        if (validation.max) {
            schema = schema.max(validation.max, validation.messages?.max);
        }
        if (validation.email) {
            schema = schema.email(validation.messages?.email || 'Invalid email address');
        }
        if (validation.pattern) {
            schema = schema.regex(new RegExp(validation.pattern), validation.messages?.pattern);
        }

        return schema;
    } catch (error) {
        console.error('Error creating validation schema:', error);
        return z.string();
    }
}

// Configuration validation schema
const configSchema = z.object({
    steps: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        form: z.array(z.object({
            label: z.string(),
            placeholder: z.string().optional(),
            type: z.string(),
            required: z.boolean().optional(),
            validation: z.any().optional()
        }))
    })).min(1),
    form: z.object({
        database: z.string().optional(),
        method: z.string().optional(),
        action: z.string().optional()
    }).optional(),
    options: z.object({
        successMessage: z.string().optional(),
        submitButtonText: z.string().optional(),
        textColor: z.string().optional(),
        bgColor: z.string().optional(),
        onSuccess: z.object({
            redirect: z.string().optional()
        }).optional(),
        containerClassName: z.string().optional(),
        formClassName: z.string().optional(),
        submitButtonClassName: z.string().optional()
    }).optional()
}).passthrough();

const FormField = ({ field, control, errors, textColor }) => {
    const inputClassName = `w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${textColor}`;
    
    switch (field.type) {
        case 'text':
        case 'email':
        case 'password':
        case 'number':
            return (
                <Controller
                    name={field.label}
                    control={control}
                    rules={{ required: field.required }}
                    render={({ field: { onChange, onBlur, value, ref } }) => (
                        <input
                            type={field.type}
                            placeholder={field.placeholder}
                            onChange={onChange}
                            onBlur={onBlur}
                            value={value}
                            ref={ref}
                            className={inputClassName}
                            aria-invalid={errors[field.label] ? "true" : "false"}
                        />
                    )}
                />
            );
        case 'select':
            return (
                <Controller
                    name={field.label}
                    control={control}
                    rules={{ required: field.required }}
                    render={({ field: { onChange, value } }) => (
                        <Select
                            options={field.options}
                            isMulti={field.multiple}
                            onChange={onChange}
                            value={value}
                            className="w-full"
                            classNamePrefix="select"
                        />
                    )}
                />
            );
        case 'textarea':
            return (
                <Controller
                    name={field.label}
                    control={control}
                    rules={{ required: field.required }}
                    render={({ field: { onChange, onBlur, value, ref } }) => (
                        <textarea
                            placeholder={field.placeholder}
                            onChange={onChange}
                            onBlur={onBlur}
                            value={value}
                            ref={ref}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-invalid={errors[field.label] ? "true" : "false"}
                        />
                    )}
                />
            );
        default:
            return null;
    }
};

const Nav = ({ currentStep, totalSteps, goToStep }) => {
    return (
        <div className="flex justify-between items-center mt-6">
            {currentStep > 1 && (
                <motion.button
                    type="button"
                    onClick={() => goToStep(currentStep - 1)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Previous
                </motion.button>
            )}
            
            <div className="flex gap-2">
                {Array.from({ length: totalSteps }, (_, i) => (
                    <div
                        key={i + 1}
                        className={`w-2 h-2 rounded-full ${
                            currentStep === i + 1 ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                    />
                ))}
            </div>

            {currentStep < totalSteps && (
                <motion.button
                    type="button"
                    onClick={() => goToStep(currentStep + 1)}
                    className="px-4 py-2 text-sm font-medium text-gray-400 bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Next
                </motion.button>
            )}
        </div>
    );
};

const Step = ({ stepData, control, errors, textColor }) => (
    <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-4"
    >
        <h2 className={`text-2xl font-bold ${textColor}`}>{stepData.title}</h2>
        <p className={`${textColor} opacity-80`}>{stepData.description}</p>
        {stepData.form.map((field, index) => (
            <div key={index} className="space-y-2">
                <label htmlFor={field.label} className={`block text-sm font-medium ${textColor}`}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <FormField field={field} control={control} errors={errors} textColor={textColor} />
                {errors[field.label] && (
                    <p className="text-red-500 text-sm">{errors[field.label].message}</p>
                )}
            </div>
        ))}
    </motion.div>
);

const ConfigurationError = ({ error }) => (
    <div className="max-w-2xl mx-auto p-6 bg-red-50 border border-red-200 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Form Configuration Error</h2>
        <p className="text-red-600">{error}</p>
    </div>
);

const SuperForm = ({ config }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useLocalStorage('formData', {});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [configError, setConfigError] = useState(null);

    const textColor = config?.options?.textColor || 'text-gray-700';
    const bgColor = config?.options?.bgColor || 'bg-white';

    // Validate configuration
    useEffect(() => {
        try {
            if (!config) {
                throw new Error('Form configuration is required');
            }
            configSchema.parse(config);
            setConfigError(null);
        } catch (error) {
            setConfigError(error.message);
        }
    }, [config]);

    // Early return if configuration is invalid
    if (configError) {
        return <ConfigurationError error={configError} />;
    }

    // Initialize database connection only if database is configured
    const db = config?.form?.database ? useDatabase(config.form.database) : null;

    const validationSchema = z.object(
        (config?.steps || []).reduce((acc, step) => {
            step.form.forEach(field => {
                if (field.validation) {
                    acc[field.label] = createZodSchema(field.validation);
                } else if (field.required) {
                    acc[field.label] = z.string().nonempty(`${field.label} is required`);
                }
            });
            return acc;
        }, {})
    );

    const { control, handleSubmit, formState: { errors }, reset } = useForm({
        resolver: zodResolver(validationSchema),
        defaultValues: formData,
    });

    useEffect(() => {
        reset(formData);
    }, [formData, reset]);

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            let result;

            if (db) {
                // Use database utility if configured
                result = await db.create(data);
            } else if (config?.form?.action) {
                // Fallback to standard fetch if action URL is provided
                const response = await fetch(config.form.action, {
                    method: config?.form?.method || 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                if (!response.ok) {
                    throw new Error('Form submission failed');
                }

                result = await response.json();
            } else {
                throw new Error('No submission method configured');
            }

            setFormData({}); // Clear cached form data
            setSubmitStatus({
                type: 'success',
                message: config.options?.successMessage || 'Form submitted successfully!'
            });

            // Handle post-submission actions
            if (config.options?.onSuccess?.redirect) {
                window.location.href = config.options.onSuccess.redirect;
            }
        } catch (error) {
            console.error('Form submission error:', error);
            setSubmitStatus({
                type: 'error',
                message: error.message || 'An error occurred while submitting the form.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`max-w-2xl mx-auto p-6 rounded-lg shadow-md ${bgColor} ${config.options?.containerClassName || ''}`}>
            {submitStatus && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-4 p-4 rounded ${
                        submitStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                >
                    {submitStatus.message}
                </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className={config.options?.formClassName || ''}>
                <StepWizard
                    isHashEnabled
                    nav={<Nav />}
                    instance={(wizard) => setCurrentStep(wizard.currentStep - 1)}
                    transitions={config.options?.transitions || {}}
                >
                    {(config?.steps || []).map((step, index) => (
                        <Step
                            key={index}
                            stepData={step}
                            control={control}
                            errors={errors}
                            textColor={textColor}
                        />
                    ))}
                </StepWizard>

                {currentStep === (config?.steps?.length || 0) - 1 && (
                    <motion.button
                        type="submit"
                        disabled={isSubmitting}
                        className={`mt-4 w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                            config.options?.submitButtonClassName || ''
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {isSubmitting ? 'Submitting...' : (config.options?.submitButtonText || 'Submit')}
                    </motion.button>
                )}
            </form>
        </div>
    );
};

export default SuperForm;
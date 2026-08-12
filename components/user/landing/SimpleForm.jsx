"use client";
import React, { useState } from 'react';

const SimpleForm = ({ config }) => {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(config.action || '/api/submit', {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Form submission failed');
      }

      setSubmitStatus({
        type: 'success',
        message: config.successMessage || 'Form submitted successfully!'
      });
      
      if (config.redirectUrl) {
        window.location.href = config.redirectUrl;
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error.message || 'An error occurred while submitting the form.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      value: formData[field.name] || '',
      onChange: (e) => handleInputChange(field.name, e.target.value),
      className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
      required: field.required
    };

    switch (field.type) {
      case 'textarea':
        return <textarea {...commonProps} placeholder={field.placeholder} rows={4} />;
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">{field.placeholder || 'Select an option'}</option>
            {field.options?.map((option, idx) => (
              <option key={idx} value={option.value}>{option.label}</option>
            ))}
          </select>
        );
      default:
        return <input {...commonProps} type={field.type || 'text'} placeholder={field.placeholder} />;
    }
  };

  return (
    <div className={`max-w-md mx-auto p-6 bg-white rounded-lg shadow-md ${config.containerClass || ''}`}>
      {config.title && (
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{config.title}</h2>
      )}
      
      {submitStatus && (
        <div className={`mb-4 p-4 rounded ${
          submitStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {submitStatus.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className={config.formClass || ''}>
        {config.fields?.map((field, index) => (
          <div key={index} className="mb-4">
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
            config.submitButtonClass || ''
          }`}
        >
          {isSubmitting ? 'Submitting...' : (config.submitText || 'Submit')}
        </button>
      </form>
    </div>
  );
};

export default SimpleForm;
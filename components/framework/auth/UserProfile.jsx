'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { signOut } from 'next-auth/react';
import { useAuthState } from '@/components/framework/auth/AuthStateProvider';
import { useApp } from '@/core/hooks/useApp';
import { useAuthConfig } from '@/core/hooks/useAuthConfig';
import FileUpload from '@/components/framework/FileUpload';

export default function UserProfile({
  isModal = false,
  onClose = null,
  appearance = {},
  afterSignOutUrl = '/'
}) {
  const { user, isAuthenticated, isLoading } = useAuthState();
  const app = useApp();
  const [activeTab, setActiveTab] = useState('account');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Email change state
  const [emailChangeState, setEmailChangeState] = useState('idle');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');

  // Password reset state
  const [passwordResetState, setPasswordResetState] = useState('idle');

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Detect language from HTML lang attribute
  const [htmlLang, setHtmlLang] = useState('en');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const lang = document.documentElement.lang || 'en';
      setHtmlLang(lang);
    }
  }, []);

  // Load auth configuration
  const { authConfig, loading: configLoading } = useAuthConfig(htmlLang);

  // Extract texts for i18n
  const texts = authConfig?.texts || {};

  // Extract custom fields configuration
  const customFields = useMemo(() => {
    const authSettings = authConfig?.auth || {};
    // Support both registration.customFields (array) and signup.fields (object)
    const fieldsConfig = authSettings.registration?.customFields ||
                         authSettings.signup?.fields ||
                         {};

    // Convert object format to array if needed
    if (Array.isArray(fieldsConfig)) {
      return fieldsConfig;
    }

    // Convert object { fieldName: config } to array
    return Object.entries(fieldsConfig).map(([name, config]) => ({
      name,
      ...(typeof config === 'string' ? { type: config } : config)
    }));
  }, [authConfig?.auth]);

  // Initialize form data when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        image: user.image || null,
        customFields: user.customFields || {}
      });
    }
  }, [user]);

  if (isLoading || configLoading) {
    return (
      <div className={`${isModal ? 'p-6' : 'max-w-4xl mx-auto p-6'}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className={`${isModal ? 'p-6' : 'max-w-4xl mx-auto p-6'} text-center`}>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            {texts.authenticationRequired || 'Authentication Required'}
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            {texts.pleaseSignIn || 'Please sign in to view your profile.'}
          </p>
        </div>
      </div>
    );
  }

  const startEditing = () => {
    setFormData({
      name: user.name || '',
      username: user.username || '',
      image: user.image || null,
      customFields: user.customFields || {}
    });
    setIsEditing(true);
    setMessage({ type: '', text: '' });
  };

  const cancelEditing = () => {
    setFormData({
      name: user.name || '',
      username: user.username || '',
      image: user.image || null,
      customFields: user.customFields || {}
    });
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const handleImageChange = (file) => {
    // file is either a file object with url, or null
    setFormData(prev => ({
      ...prev,
      image: file?.url || null
    }));
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldName]: value
      }
    }));
  };

  const saveProfile = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // Prepare payload
      const payload = {
        name: formData.name,
        username: formData.username,
        image: formData.image
      };

      // Add custom fields (flattened, not nested)
      if (formData.customFields) {
        Object.keys(formData.customFields).forEach(key => {
          payload[key] = formData.customFields[key];
        });
      }

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: texts.profileUpdated || 'Profile updated successfully!' });
        setIsEditing(false);
        // Trigger session refresh
        window.location.reload();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || error.error || texts.profileUpdateFailed || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: texts.profileUpdateError || 'An error occurred while updating your profile' });
    } finally {
      setIsSaving(false);
    }
  };

  // Email change handlers
  const handleEmailChangeRequest = async () => {
    if (!newEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter your new email address' });
      return;
    }

    setEmailChangeState('sending');
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail })
      });

      const data = await response.json();

      if (response.ok) {
        setEmailChangeState('code_sent');
        setMessage({ type: 'success', text: texts.verificationCodeSent || 'Verification code sent to your new email address' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send verification code' });
        setEmailChangeState('idle');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
      setEmailChangeState('idle');
    }
  };

  const handleEmailChangeVerify = async () => {
    if (!emailCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter the verification code' });
      return;
    }

    setEmailChangeState('verifying');
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/auth/change-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: emailCode })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: texts.emailUpdated || 'Email updated successfully! Please sign in again.' });
        setTimeout(() => {
          handleSignOut();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Invalid verification code' });
        setEmailChangeState('code_sent');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
      setEmailChangeState('code_sent');
    }
  };

  // Password reset handler
  const handlePasswordReset = async () => {
    setPasswordResetState('sending');
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordResetState('sent');
        setMessage({ type: 'success', text: texts.resetLinkSent || 'Password reset instructions sent to your email' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send reset email' });
        setPasswordResetState('idle');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
      setPasswordResetState('idle');
    }
  };

  // Account deletion handler
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setMessage({ type: 'error', text: 'Please type DELETE to confirm' });
      return;
    }

    setIsDeleting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmation })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: texts.accountDeleted || 'Your account has been deleted.' });
        setTimeout(() => {
          signOut({ callbackUrl: '/', redirect: true });
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete account' });
        setIsDeleting(false);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
      setIsDeleting(false);
    }
  };

  const handleSignOut = async () => {
    if (app?.auth?.logout) {
      app.auth.logout({ method: 'user_profile' });
    }

    let callbackUrl = '/';
    if (typeof window !== 'undefined') {
      const afterSignOutUrlConfig = afterSignOutUrl || '/';
      if (afterSignOutUrlConfig.startsWith('http://') || afterSignOutUrlConfig.startsWith('https://')) {
        callbackUrl = afterSignOutUrlConfig;
      } else {
        callbackUrl = `${window.location.origin}${afterSignOutUrlConfig}`;
      }
    }

    await signOut({ callbackUrl, redirect: true });
  };

  // Determine which security features are available
  const hasPasswordAuth = authConfig?.auth?.password === true ||
                          authConfig?.providers?.credentials?.enabled === true ||
                          authConfig?.auth?.providers?.credentials === true;
  const has2FA = authConfig?.security?.twoFactorAuth?.enabled || authConfig?.twoFactorAuth?.enabled;

  // Render custom field input based on type
  const renderCustomField = (field) => {
    const value = formData.customFields?.[field.name] ?? user.customFields?.[field.name] ?? '';
    const fieldLabel = typeof field.label === 'object'
      ? (field.label[htmlLang] || field.label.en || field.name)
      : (field.label || field.name);

    const inputClasses = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed";

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {fieldLabel}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              disabled={!isEditing}
              rows={field.rows || 3}
              placeholder={typeof field.placeholder === 'object'
                ? (field.placeholder[htmlLang] || field.placeholder.en || '')
                : (field.placeholder || '')}
              className={inputClasses}
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {fieldLabel}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              disabled={!isEditing}
              className={inputClasses}
            >
              <option value="">
                {typeof field.placeholder === 'object'
                  ? (field.placeholder[htmlLang] || field.placeholder.en || 'Select...')
                  : (field.placeholder || 'Select...')}
              </option>
              {(field.options || []).map((opt, i) => (
                <option key={i} value={opt.value || opt}>
                  {typeof opt.label === 'object'
                    ? (opt.label[htmlLang] || opt.label.en || opt.value)
                    : (opt.label || opt)}
                </option>
              ))}
            </select>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className="flex items-center space-x-3">
            <input
              type="checkbox"
              id={`field-${field.name}`}
              checked={!!value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.checked)}
              disabled={!isEditing}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary disabled:opacity-50"
            />
            <label htmlFor={`field-${field.name}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {fieldLabel}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          </div>
        );

      case 'date':
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {fieldLabel}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              disabled={!isEditing}
              className={inputClasses}
            />
          </div>
        );

      default:
        // text, email, tel, etc.
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {fieldLabel}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={field.type || 'text'}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              disabled={!isEditing}
              placeholder={typeof field.placeholder === 'object'
                ? (field.placeholder[htmlLang] || field.placeholder.en || '')
                : (field.placeholder || '')}
              className={inputClasses}
            />
          </div>
        );
    }
  };

  const tabs = [
    {
      id: 'account',
      label: texts.account || 'Account',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    },
    {
      id: 'security',
      label: texts.security || 'Security',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
    },
    {
      id: 'danger',
      label: texts.dangerZone || 'Danger Zone',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    }
  ];

  return (
    <div className={`${isModal ? 'max-w-2xl' : 'max-w-3xl mx-auto'} p-4`}>
      {/* Close button for modal */}
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {texts.accountSettings || 'Account Settings'}
        </h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? tab.id === 'danger'
                    ? 'border-red-500 text-red-500'
                    : 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-4">
          {/* Combined Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            {/* Header with Edit button */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {texts.profileInformation || 'Profile Information'}
              </h2>
              {!isEditing && (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {texts.editProfile || 'Edit Profile'}
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {/* Profile Picture + Core Fields in row */}
                <div className="flex gap-5">
                  {/* Profile Picture */}
                  <div className="flex-shrink-0">
                    <FileUpload
                      value={formData.image ? { url: formData.image, type: 'image/*', name: 'Profile' } : null}
                      onChange={handleImageChange}
                      multiple={false}
                      accept={['image/*']}
                      variant="avatar"
                      size="md"
                      maxSize={5 * 1024 * 1024}
                    />
                  </div>

                  {/* Core Fields */}
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {texts.fullName || 'Full Name'}
                        </label>
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {texts.username || 'Username'}
                        </label>
                        <input
                          type="text"
                          value={formData.username || ''}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {texts.emailAddress || 'Email Address'}
                      </label>
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {customFields.map(field => renderCustomField(field))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    {texts.cancel || 'Cancel'}
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
                  >
                    {isSaving ? (texts.saving || 'Saving...') : (texts.saveChanges || 'Save Changes')}
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="flex gap-5">
                {/* Profile Picture */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    {user.image ? (
                      <img src={user.image} alt={user.name || 'Profile'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                        {(user.name || user.username || user.email || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        {texts.fullName || 'Full Name'}
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {user.name || (texts.notProvided || 'Not provided')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        {texts.username || 'Username'}
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {user.username || (texts.notProvided || 'Not provided')}
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        {texts.emailAddress || 'Email Address'}
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white truncate">{user.email}</p>
                    </div>

                    {/* Custom Fields Display - inline */}
                    {customFields.map(field => {
                      const value = user.customFields?.[field.name];
                      if (value === undefined || value === null || value === '') return null;

                      const fieldLabel = typeof field.label === 'object'
                        ? (field.label[htmlLang] || field.label.en || field.name)
                        : (field.label || field.name);

                      let displayValue = value;
                      if (field.type === 'checkbox') {
                        displayValue = value ? (texts.yes || 'Yes') : (texts.no || 'No');
                      } else if (field.type === 'select' && field.options) {
                        const opt = field.options.find(o => (o.value || o) === value);
                        if (opt) {
                          displayValue = typeof opt.label === 'object'
                            ? (opt.label[htmlLang] || opt.label.en || value)
                            : (opt.label || value);
                        }
                      }

                      return (
                        <div key={field.name}>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                            {fieldLabel}
                          </label>
                          <p className="text-sm text-gray-900 dark:text-white truncate">{displayValue}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          {/* Email Change Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              {texts.changeEmail || 'Change Email Address'}
            </h2>

            {emailChangeState === 'idle' && (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {texts.newEmail || 'New Email Address'}
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@email.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                </div>
                <button
                  onClick={handleEmailChangeRequest}
                  className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors whitespace-nowrap"
                >
                  {texts.sendCode || 'Send Code'}
                </button>
              </div>
            )}

            {emailChangeState === 'sending' && (
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{texts.sendingCode || 'Sending verification code...'}</span>
              </div>
            )}

            {emailChangeState === 'code_sent' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {texts.codeSentTo || 'A verification code was sent to'} <strong>{newEmail}</strong>
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {texts.verificationCode || 'Verification Code'}
                  </label>
                  <input
                    type="text"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-center text-xl tracking-widest"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleEmailChangeVerify}
                    disabled={emailCode.length !== 6}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {texts.verifyAndChange || 'Verify & Change Email'}
                  </button>
                  <button
                    onClick={() => {
                      setEmailChangeState('idle');
                      setEmailCode('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    {texts.cancel || 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Password Section */}
          {hasPasswordAuth && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {texts.password || 'Password'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {texts.changePassword || 'Change your password'}
                  </p>
                </div>

              {passwordResetState === 'idle' && (
                <button
                  onClick={handlePasswordReset}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                >
                  {texts.resetPassword || 'Reset Password'}
                </button>
              )}

              {passwordResetState === 'sending' && (
                <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 text-sm">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Sending...</span>
                </div>
              )}

              {passwordResetState === 'sent' && (
                <button
                  onClick={() => setPasswordResetState('idle')}
                  className="px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:underline"
                >
                  {texts.sentResend || 'Sent! Resend'}
                </button>
              )}
              </div>
            </div>
          )}

          {/* Two-Factor Authentication */}
          {has2FA && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {texts.twoFactorAuth || 'Two-Factor Authentication'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {texts.twoFactorAuthDesc || 'Add extra security'}
                  </p>
                </div>
                <button
                  disabled
                  className="px-3 py-1.5 text-sm font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed"
                >
                  {texts.comingSoon || 'Coming Soon'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-red-700 dark:text-red-300">
                    {texts.deleteAccount || 'Delete Account'}
                  </h2>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {texts.deleteAccountWarning || 'This action cannot be undone'}
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  {texts.deleteMyAccount || 'Delete Account'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                    className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmation('');
                    }}
                    disabled={isDeleting}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

UserProfile.displayName = 'UserProfile';

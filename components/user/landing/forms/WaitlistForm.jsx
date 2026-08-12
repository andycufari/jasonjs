'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, User, Building, Phone, ChevronRight, CheckCircle, Gift, Copy, Check } from 'lucide-react';

export default function WaitlistForm({
  // Form configuration
  fields = ['email'],
  submitText = "Join Waitlist",
  successMessage = "Welcome to the waitlist!",
  
  // Features
  enableReferrals = true,
  showProgress = true,
  collectCompany = false,
  
  // Database integration
  database = "waitlist",
  
  // Customization
  variant = "default", // default, minimal, card
  size = "md", // sm, md, lg
  
  // Theme integration
  jcontext
}) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Get theme colors - support both direct props and theme system
  const theme = jcontext?.theme || {};
  const primaryColor = theme.colors?.primary || theme.primaryColor || '#3B82F6';

  const fieldConfig = {
    email: { 
      icon: Mail, 
      placeholder: "Enter your email address", 
      type: "email",
      label: "Email Address",
      required: true
    },
    name: { 
      icon: User, 
      placeholder: "Your full name", 
      type: "text",
      label: "Full Name",
      required: false
    },
    company: { 
      icon: Building, 
      placeholder: "Company name", 
      type: "text",
      label: "Company",
      required: false
    },
    phone: { 
      icon: Phone, 
      placeholder: "Phone number", 
      type: "tel",
      label: "Phone Number",
      required: false
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const generateReferralCode = (email) => {
    // Simple referral code generation
    const hash = btoa(email).slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `REF${hash}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const submissionData = {
        ...formData,
        timestamp: new Date().toISOString(),
        source: 'waitlist_form',
        page: window.location.pathname,
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        status: 'active'
      };

      // Add UTM parameters if available
      const urlParams = new URLSearchParams(window.location.search);
      const utmParams = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
        if (urlParams.has(param)) {
          utmParams[param] = urlParams.get(param);
        }
      });
      if (Object.keys(utmParams).length > 0) {
        submissionData.utm = utmParams;
      }

      const response = await fetch(`/api/data/${database}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: submissionData }),
      });

      const result = await response.json();
      
      if (response.ok && result.data) {
        setIsSubmitted(true);
        
        // Generate referral code if enabled
        if (enableReferrals && formData.email) {
          setReferralCode(generateReferralCode(formData.email));
        }
        
        // Reset form
        setFormData({ email: '', name: '', company: '', phone: '' });
      } else {
        throw new Error(result.error || 'Failed to join waitlist');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyReferralLink = async () => {
    const referralLink = `${window.location.origin}${window.location.pathname}?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy referral link:', err);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-sm py-3 px-4 text-sm';
      case 'lg':
        return 'max-w-lg py-5 px-6 text-lg';
      default:
        return 'max-w-md py-4 px-5';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'minimal':
        return 'bg-transparent border-0 shadow-none';
      case 'card':
        return 'bg-white rounded-2xl shadow-xl border border-gray-100 p-8';
      default:
        return 'bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-6';
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`mx-auto ${getSizeClasses()} ${getVariantClasses()}`}
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckCircle className="w-8 h-8 text-white" />
          </motion.div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            {successMessage}
          </h3>
          
          <p className="text-gray-600 mb-6">
            You're now part of an exclusive group. We'll keep you updated on our progress.
          </p>

          {enableReferrals && referralCode && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center mb-3">
                <Gift className="w-5 h-5 mr-2" style={{ color: primaryColor }} />
                <span className="font-semibold text-gray-900">Share & Earn Rewards</span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Share your referral link and earn exclusive benefits for each friend who joins!
              </p>
              
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-200">
                  <code className="text-sm text-gray-800">{referralCode}</code>
                </div>
                <button
                  onClick={copyReferralLink}
                  className="px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-500">
            <p>Keep an eye on your inbox for updates!</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-auto ${getSizeClasses()} ${getVariantClasses()}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {showProgress && fields.length > 1 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Join the waitlist</span>
              <span>{fields.length} fields</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  backgroundColor: primaryColor,
                  width: `${(Object.values(formData).filter(Boolean).length / fields.length) * 100}%`
                }}
              />
            </div>
          </div>
        )}

        {fields.map((field) => {
          const config = fieldConfig[field];
          if (!config) return null;

          const Icon = config.icon;
          
          return (
            <div key={field} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {config.label}
                {config.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="relative">
                <Icon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={config.type}
                  value={formData[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={config.placeholder}
                  required={config.required}
                  disabled={isSubmitting}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all duration-200"
                  style={{ focusRingColor: primaryColor }}
                />
              </div>
            </div>
          );
        })}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <p className="text-red-600 text-sm">{error}</p>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !formData.email}
          className="w-full py-3 px-6 rounded-xl text-white font-semibold flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: primaryColor }}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {submitText}
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </button>

        <div className="text-center text-xs text-gray-500 mt-4">
          <p>By joining, you agree to receive updates about our launch.</p>
          <p>Unsubscribe anytime. No spam, ever.</p>
        </div>
      </form>
    </motion.div>
  );
}

WaitlistForm.displayName = 'WaitlistForm';
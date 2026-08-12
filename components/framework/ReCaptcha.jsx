'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * ReCaptcha Component - Reusable Google reCAPTCHA v2 integration
 * 
 * Features:
 * - Google reCAPTCHA v2 checkbox integration
 * - Theme support (light/dark)
 * - Size variants (normal/compact)
 * - Configurable site key via settings
 * - Error handling and validation
 * - Callback support for form integration
 * 
 * Usage:
 * <ReCaptcha
 *   siteKey="your-site-key"
 *   onVerify={(token) => console.log('Verified:', token)}
 *   onExpire={() => console.log('Expired')}
 *   onError={(error) => console.log('Error:', error)}
 *   theme="light" // or "dark"
 *   size="normal" // or "compact"
 * />
 */
export default function ReCaptcha({
  siteKey,
  onVerify = () => {},
  onExpire = () => {},
  onError = () => {},
  theme = 'light', // 'light' | 'dark'
  size = 'normal', // 'normal' | 'compact'
  tabindex = 0,
  className = '',
  disabled = false,
  reset = false, // Set to true to reset the captcha
  jcontext = null
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const captchaRef = useRef(null);
  const widgetId = useRef(null);

  // Get site key from jcontext or prop
  const effectiveSiteKey = siteKey || jcontext?.settings?.recaptcha?.siteKey;

  useEffect(() => {
    if (!effectiveSiteKey) {
      console.warn('ReCaptcha: No site key provided. Please set siteKey prop or configure in settings/recaptcha.json');
      return;
    }

    // Load Google reCAPTCHA script if not already loaded
    if (!window.grecaptcha) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsLoaded(true);
      };
      script.onerror = () => {
        onError('Failed to load reCAPTCHA script');
      };
      document.head.appendChild(script);
    } else {
      setIsLoaded(true);
    }

    return () => {
      // Cleanup widget when component unmounts
      if (widgetId.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetId.current);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [effectiveSiteKey, onError]);

  useEffect(() => {
    if (isLoaded && captchaRef.current && !isReady) {
      try {
        // Render the reCAPTCHA widget
        widgetId.current = window.grecaptcha.render(captchaRef.current, {
          sitekey: effectiveSiteKey,
          callback: (token) => {
            onVerify(token);
          },
          'expired-callback': () => {
            onExpire();
          },
          'error-callback': () => {
            onError('reCAPTCHA error occurred');
          },
          theme: theme,
          size: size,
          tabindex: tabindex
        });
        setIsReady(true);
      } catch (error) {
        onError(`Failed to render reCAPTCHA: ${error.message}`);
      }
    }
  }, [isLoaded, effectiveSiteKey, theme, size, tabindex, onVerify, onExpire, onError, isReady]);

  // Handle reset
  useEffect(() => {
    if (reset && isReady && widgetId.current !== null) {
      try {
        window.grecaptcha.reset(widgetId.current);
      } catch (error) {
        onError(`Failed to reset reCAPTCHA: ${error.message}`);
      }
    }
  }, [reset, isReady, onError]);

  // Handle disabled state
  useEffect(() => {
    if (isReady && captchaRef.current) {
      const iframe = captchaRef.current.querySelector('iframe');
      if (iframe) {
        iframe.style.opacity = disabled ? '0.5' : '1';
        iframe.style.pointerEvents = disabled ? 'none' : 'auto';
      }
    }
  }, [disabled, isReady]);

  if (!effectiveSiteKey) {
    return (
      <div className={`text-red-500 text-sm ${className}`}>
        reCAPTCHA configuration missing. Please configure your site key.
      </div>
    );
  }

  return (
    <div className={`recaptcha-container ${className}`}>
      {!isLoaded && (
        <div className="flex items-center space-x-2 text-gray-500 text-sm">
          <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
          <span>Loading reCAPTCHA...</span>
        </div>
      )}
      <div 
        ref={captchaRef}
        className={`${!isLoaded ? 'hidden' : ''} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      />
    </div>
  );
}

ReCaptcha.displayName = 'ReCaptcha';
ReCaptcha.isSystemComponent = true;

/**
 * Utility function to verify reCAPTCHA token on the server
 * Usage in API routes:
 * 
 * import { verifyRecaptcha } from '@/components/system/ReCaptcha';
 * 
 * const isValid = await verifyRecaptcha(token, secretKey);
 */
export async function verifyRecaptcha(token, secretKey) {
  if (!token || !secretKey) {
    return false;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}
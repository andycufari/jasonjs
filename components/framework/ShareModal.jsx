'use client';
import { useState, useEffect } from 'react';
import { useAuthConfig } from '@/core/hooks/useAuthConfig';
import Modal from './auth/Modal';
import { Share2, Copy, Check, X, Facebook, Twitter, Linkedin, Mail, MessageCircle } from 'lucide-react';

// Default translations
const defaultTranslations = {
  en: {
    share: 'Share',
    copyLink: 'Copy Link',
    copy: 'Copy',
    copied: 'Copied!',
    shareVia: 'Share via',
    moreOptions: 'More sharing options'
  },
  es: {
    share: 'Compartir',
    copyLink: 'Copiar enlace',
    copy: 'Copiar',
    copied: '¡Copiado!',
    shareVia: 'Compartir en',
    moreOptions: 'Más opciones'
  }
};

/**
 * Detect language from props, Next.js or browser
 */
function detectLanguage(propLanguage) {
  // Priority 1: Language passed as prop (from jcontext)
  if (propLanguage) {
    return propLanguage.split('-')[0]; // 'en-US' -> 'en'
  }

  if (typeof window === 'undefined') return 'en';

  // Priority 2: Try to get from Next.js locale
  const htmlLang = document.documentElement.lang;
  if (htmlLang) {
    return htmlLang.split('-')[0]; // 'en-US' -> 'en'
  }

  // Priority 3: Fallback to browser language
  const browserLang = navigator?.language?.split('-')[0];
  return browserLang || 'en';
}

/**
 * ShareModal - Beautiful share modal that works in any context
 *
 * Features:
 * - Uses Web Share API on mobile devices when available
 * - Beautiful themed modal on desktop
 * - Copy to clipboard functionality
 * - Social media sharing options
 * - Fully themable using auth config
 * - i18n support (English/Spanish by default)
 *
 * Usage as component:
 * <ShareModal
 *   url="https://example.com"
 *   title="Check this out!"
 *   text="Amazing content"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   options={{
 *     socialNetworks: ['x', 'facebook', 'whatsapp'],
 *     translations: { share: 'Compartir', copy: 'Copiar' }
 *   }}
 * />
 *
 * Usage as utility (via app object):
 * await app.ui.share({ url, title, text, options })
 */
export default function ShareModal({
  url = typeof window !== 'undefined' ? window.location.href : '',
  title = '',
  text = '',
  isOpen = false,
  onClose = () => {},
  options = {},
  language: propLanguage = null // Accept language from parent (e.g., jcontext)
}) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState('en');

  // Load auth configuration for theming
  const { authConfig, loading: configLoading } = useAuthConfig();

  // Extract theme configuration
  const theme = authConfig?.theme || {};
  const primaryColor = theme.colors?.primary || '#6366f1';
  const textColor = theme.colors?.text || '#1f2937';
  const textSecondaryColor = theme.colors?.textSecondary || '#6b7280';
  const surfaceColor = theme.colors?.surface || '#ffffff';
  const fontFamily = theme.typography?.fontFamily || "'Inter', system-ui, sans-serif";

  // Detect language and merge translations
  useEffect(() => {
    setMounted(true);
    const detectedLang = detectLanguage(propLanguage);
    setLanguage(detectedLang);
  }, [propLanguage]);

  // Get translations
  const baseTranslations = defaultTranslations[language] || defaultTranslations.en;
  const translations = {
    ...baseTranslations,
    ...(options.translations || {})
  };

  // Merge default options with provided options
  const config = {
    showSocialButtons: options.showSocialButtons !== false,
    socialNetworks: options.socialNetworks || ['x', 'facebook', 'instagram', 'whatsapp', 'email'],
    ...options
  };

  // Check if Web Share API is available (typically on mobile)
  const canUseWebShare = mounted && typeof navigator !== 'undefined' && navigator.share;

  // Handle native share (mobile)
  const handleNativeShare = async () => {
    if (!canUseWebShare) return;

    try {
      await navigator.share({
        title: title || document.title,
        text: text,
        url: url
      });
      onClose();
    } catch (error) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  // Social sharing handlers
  const socialHandlers = {
    x: () => {
      const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || title)}`;
      window.open(shareUrl, '_blank', 'width=550,height=420');
    },
    twitter: () => {
      const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || title)}`;
      window.open(shareUrl, '_blank', 'width=550,height=420');
    },
    facebook: () => {
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      window.open(shareUrl, '_blank', 'width=550,height=420');
    },
    linkedin: () => {
      const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      window.open(shareUrl, '_blank', 'width=550,height=420');
    },
    whatsapp: () => {
      const shareUrl = `https://wa.me/?text=${encodeURIComponent((text || title) + ' ' + url)}`;
      window.open(shareUrl, '_blank');
    },
    telegram: () => {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || title)}`;
      window.open(shareUrl, '_blank');
    },
    reddit: () => {
      const shareUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
      window.open(shareUrl, '_blank', 'width=550,height=420');
    },
    instagram: () => {
      // Instagram doesn't have a web share URL, so copy link and notify user
      navigator.clipboard.writeText(url);
      alert('Link copied! Open Instagram and paste the link in your story or post.');
    },
    tiktok: () => {
      // TikTok doesn't have a web share URL, so copy link and notify user
      navigator.clipboard.writeText(url);
      alert('Link copied! Open TikTok and paste the link in your video description.');
    },
    pinterest: () => {
      const shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text || title)}`;
      window.open(shareUrl, '_blank', 'width=550,height=420');
    },
    email: () => {
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent((text ? text + '\n\n' : '') + url)}`;
      window.location.href = mailtoUrl;
    },
    sms: () => {
      const smsUrl = `sms:?body=${encodeURIComponent((text || title) + ' ' + url)}`;
      window.location.href = smsUrl;
    },
    copy: () => {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const socialIcons = {
    x: Twitter,
    twitter: Twitter,
    facebook: Facebook,
    linkedin: Linkedin,
    whatsapp: MessageCircle,
    telegram: MessageCircle,
    reddit: MessageCircle,
    instagram: Share2,
    tiktok: Share2,
    pinterest: Share2,
    email: Mail,
    sms: MessageCircle,
    copy: Copy
  };

  const socialLabels = {
    x: 'X',
    twitter: 'Twitter',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    reddit: 'Reddit',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    pinterest: 'Pinterest',
    email: 'Email',
    sms: 'SMS',
    copy: 'Copy'
  };

  // If Web Share API is available and modal opens, trigger it immediately on mobile
  useEffect(() => {
    if (isOpen && canUseWebShare && window.innerWidth < 768) {
      handleNativeShare();
    }
  }, [isOpen]);

  if (!mounted) return null;

  // On mobile with Web Share API, don't show modal (native share will be triggered)
  if (canUseWebShare && window.innerWidth < 768) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ fontFamily }}>
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'rgba(0,0,0,0.1)' }}
        >
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Share2
                className="w-5 h-5"
                style={{ color: primaryColor }}
              />
            </div>
            <h2
              className="text-xl font-semibold"
              style={{ color: textColor }}
            >
              {title || translations.share}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: textSecondaryColor }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description Text */}
          {text && (
            <div className="space-y-2">
              <p
                className="text-sm"
                style={{ color: textSecondaryColor }}
              >
                {text}
              </p>
            </div>
          )}

          {/* Copy Link Button */}
          <div className="space-y-3">
            <label
              className="block text-sm font-medium"
              style={{ color: textColor }}
            >
              {translations.copyLink}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'rgba(0,0,0,0.2)',
                  color: textSecondaryColor,
                  backgroundColor: `${primaryColor}05`,
                  '--tw-ring-color': primaryColor
                }}
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center space-x-2"
                style={{
                  backgroundColor: copied ? '#10b981' : primaryColor,
                  '--tw-ring-color': primaryColor
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">{translations.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">{translations.copy}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Social Sharing Buttons */}
          {config.showSocialButtons && (
            <div className="space-y-3">
              <label
                className="block text-sm font-medium"
                style={{ color: textColor }}
              >
                {translations.shareVia}
              </label>
              <div className="grid grid-cols-5 gap-3">
                {config.socialNetworks.map((network) => {
                  const Icon = socialIcons[network];
                  const label = socialLabels[network];
                  if (!Icon) return null;

                  return (
                    <button
                      key={network}
                      onClick={socialHandlers[network]}
                      className="flex flex-col items-center space-y-2 p-3 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2"
                      style={{
                        '--tw-ring-color': primaryColor
                      }}
                      title={`Share on ${label}`}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}15` }}
                      >
                        <Icon
                          className="w-5 h-5"
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <span
                        className="text-xs"
                        style={{ color: textSecondaryColor }}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Native Share Button (mobile fallback) */}
          {canUseWebShare && (
            <button
              onClick={handleNativeShare}
              className="w-full py-3 px-4 rounded-lg font-medium transition-colors border-2 flex items-center justify-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{
                borderColor: primaryColor,
                color: primaryColor
              }}
            >
              <Share2 className="w-5 h-5" />
              <span>{translations.moreOptions}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

ShareModal.displayName = 'ShareModal';
ShareModal.isSystemComponent = true;

/**
 * Utility function to trigger share modal
 * Can be used via app.ui.share()
 */
export async function shareModal({ url, title, text, options = {} }) {
  // Check if Web Share API is available
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ url, title, text });
      return { success: true, method: 'native' };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      // Fall through to modal
    }
  }

  // Fallback: trigger modal via custom event
  return new Promise((resolve) => {
    const event = new CustomEvent('jasonjs:share', {
      detail: { url, title, text, options, resolve }
    });
    window.dispatchEvent(event);
  });
}
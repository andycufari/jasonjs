// components/system/auth/UserWidget.jsx
'use client';
import React, { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthState } from '@/components/framework/auth/AuthStateProvider';
import { useApp } from '@/core/hooks/useApp';
import { useAuthConfig } from '@/core/hooks/useAuthConfig';
import { useBillingConfig, useBillingTranslations } from '@/core/hooks/useBillingConfig';
import UserProfile from '@/components/framework/auth/UserProfile';
import Modal from './Modal';
import BillingModal from '@/components/framework/billing/BillingModal';
import {
  Building2, Settings, Home, User, Bell, Mail, Star, Heart,
  Bookmark, Shield, Key, Lock, CreditCard, ShoppingCart, Package,
  FileText, Folder, Image, Video, Music, Download, Upload, Share,
  Link as LinkIcon, ExternalLink, ChevronRight, Plus, Minus, Check,
  X, Search, Filter, Edit, Trash, Copy, Save, RefreshCw, LogOut
} from 'lucide-react';

// Map of commonly used Lucide icons for customLinks
const LUCIDE_ICONS = {
  Building2, Settings, Home, User, Bell, Mail, Star, Heart,
  Bookmark, Shield, Key, Lock, CreditCard, ShoppingCart, Package,
  FileText, Folder, Image, Video, Music, Download, Upload, Share,
  Link: LinkIcon, ExternalLink, ChevronRight, Plus, Minus, Check,
  X, Search, Filter, Edit, Trash, Copy, Save, RefreshCw, LogOut
};

// Helper to get Lucide icon by name
const getLucideIcon = (iconName) => {
  if (!iconName || typeof iconName !== 'string') return null;
  return LUCIDE_ICONS[iconName] || null;
};

export default function UserWidget({ options = {} }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModalOpen, setShowProfileModalOpen] = useState(false);
  const [showBillingModalOpen, setShowBillingModalOpen] = useState(false);
  const router = useRouter();

  // Extract isMobile from options
  const isMobile = options.isMobile || false;

  // Use our reactive auth state that updates immediately via Event Bus
  const { user, isAuthenticated, isLoading } = useAuthState();

  // Get app object for event bus
  const app = useApp();

  // Detect language from HTML lang attribute for auth config
  const [htmlLang, setHtmlLang] = React.useState('en');

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const lang = document.documentElement.lang || 'en';
      setHtmlLang(lang);
    }
  }, []);

  // Load auth configuration for theming with detected language
  const { authConfig, loading: configLoading } = useAuthConfig(htmlLang);

  // Load billing configuration for plan display (optional - may not be configured)
  const { subscription, currentPlan, isSubscribed, isConfigured, loading: billingLoading } = useBillingConfig();
  const { t: tBilling } = useBillingTranslations();

  // Track analytics only once when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('✅ UserWidget: User authenticated:', user.name);
      // Track analytics when user changes (but not on app instance changes)
      //app?.analytics?.track('user_widget_auth_detected', { userId: user.id });
    }
  }, [isAuthenticated, user?.id]); // Remove 'app' from dependencies to prevent re-tracking

  // Extract theme configuration
  const texts = authConfig?.texts || {};
  const authSettings = authConfig?.auth || {};

  // Helper to get label with priority: options > authConfig > fallback
  const getLabel = (optionKey, configKey, fallback) => {
    return options.labels?.[optionKey] || texts[configKey] || fallback;
  };

  // Merge default options with user provided options and auth config
  const config = {
    mode: options.mode || 'dropdown', // 'modal' | 'dropdown' - controls dropdown style
    profileMode: options.profileMode || 'modal', // 'modal' | 'redirect' - controls profile behavior (default modal)
    showBilling: options.showBilling !== false, // default true, set to false to hide billing
    afterSignOutUrl: options.afterSignOutUrl || authSettings.redirects?.afterSignOut || '/',
    showSignUp: options.showSignUp !== false, // default true
    profileUrl: options.profileUrl || '/auth/profile',
    signInUrl: options.signInUrl || authSettings.urls?.signIn || '/auth/login',
    signUpUrl: options.signUpUrl || authSettings.urls?.signUp || '/auth/signup',
    adminUrl: options.adminUrl || authSettings.urls?.admin || null,
    customLinks: options.customLinks || [], // Array of { label, href, icon? }
    dropdownClassName: options.dropdownClassName || '', // Custom CSS class for dropdown
    userNameClassName: options.userNameClassName || 'text-primary', // Text color for user name
    menuItemClassName: options.menuItemClassName || '', // Text color for menu items (e.g., 'text-white')
    // Separate text colors for mobile vs desktop
    mobileTextClassName: options.mobileTextClassName || options.menuItemClassName || 'text-gray-700 dark:text-gray-200',
    desktopTextClassName: options.desktopTextClassName || options.menuItemClassName || 'text-gray-700 dark:text-gray-200',
    // Avatar position: 'left' shows [pic] Name, 'right' shows Name [pic] (default for right navbar)
    avatarPosition: options.avatarPosition || 'right',
    // Avatar size
    avatarSize: options.avatarSize || 'md', // 'sm' | 'md' | 'lg'
    labels: {
      signIn: getLabel('signIn', 'signIn', 'Sign In'),
      signUp: getLabel('signUp', 'signUp', 'Sign Up'),
      profileSettings: getLabel('profileSettings', 'profileSettings', 'Profile Settings'),
      managePlan: getLabel('managePlan', 'managePlan', tBilling('managePlan')),
      adminDashboard: getLabel('adminDashboard', 'adminDashboard', 'Admin Dashboard'),
      signOut: getLabel('signOut', 'signOut', 'Sign Out')
    }
  };

  // Avatar size classes
  const avatarSizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  };
  const avatarClass = avatarSizeClasses[config.avatarSize] || avatarSizeClasses.md;

  // Loading state
  if (isLoading || configLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div
          className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"
        ></div>
        <span className="text-sm text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center space-x-3">
        <button
          onClick={async () => {
            try {
              await app.auth.requireLogin({ mode: 'login' });
            } catch (error) {
              // User cancelled authentication
              console.log('Authentication cancelled');
            }
          }}
          className="text-sm font-medium transition-colors hover:opacity-80 text-primary"
        >
          {config.labels.signIn}
        </button>
        {config.showSignUp && (
          <button
            onClick={async () => {
              try {
                await app.auth.requireLogin({ mode: 'signup' });
              } catch (error) {
                // User cancelled authentication
                console.log('Authentication cancelled');
              }
            }}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary transition-colors hover:bg-primary/90"
          >
            {config.labels.signUp}
          </button>
        )}
      </div>
    );
  }

  // Avatar component - shows profile picture or initials
  const Avatar = () => (
    <div
      className={`${avatarClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 overflow-hidden bg-primary text-primary-foreground`}
    >
      {user.image ? (
        <img
          src={user.image}
          alt={user.name || 'Profile'}
          className="w-full h-full object-cover"
        />
      ) : (
        (user.name || user.username || user.email || '?').charAt(0).toUpperCase()
      )}
    </div>
  );

  // User name component
  const UserName = () => (
    <span className={`${isMobile ? 'block' : 'hidden sm:block'} ${config.userNameClassName} truncate`}>
      {user.name || user.username || user.email?.split('@')[0]}
    </span>
  );

  // Authenticated user
  return (
    <>
      <div className={isMobile ? "w-full" : "relative"}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center ${isMobile ? 'justify-start w-full' : 'justify-center'} gap-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded-md p-2 transition-colors hover:opacity-80 text-foreground`}
        >
          {/* Avatar position: left = [pic] Name [arrow], right = Name [pic] [arrow] */}
          {config.avatarPosition === 'left' ? (
            <>
              <Avatar />
              <UserName />
            </>
          ) : (
            <>
              <UserName />
              <Avatar />
            </>
          )}

          {/* Dropdown Arrow */}
          <svg
            className={`w-4 h-4 transition-transform flex-shrink-0 ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <>
            {/* Backdrop - only for desktop */}
            {!isMobile && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              ></div>
            )}

            {/* Dropdown Content */}
            <div
              className={`
                ${isMobile
                  ? 'relative w-full mt-2'
                  : 'absolute right-0 mt-2 w-56 z-20 shadow-lg'
                }
                rounded-lg ring-1 ring-opacity-5 ring-border
                ${isMobile ? '' : 'bg-popover text-popover-foreground border border-border'}
                ${config.dropdownClassName}
              `}
            >
              {/* User Info - Compact for mobile, full for desktop */}
              {!isMobile && (
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    {/* Profile picture in dropdown header */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 overflow-hidden bg-primary text-primary-foreground">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || 'Profile'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm">
                          {(user.name || user.username || user.email || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">
                        {user.name || user.username}
                      </p>
                      <p className="text-xs truncate text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Menu Items - With inner scroll */}
              <div
                className={`
                  ${isMobile ? 'max-h-[40vh]' : 'max-h-[60vh]'}
                  overflow-y-auto py-1
                `}
              >

                {/* Profile Settings - Default to modal for better UX */}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    if (isMobile || config.profileMode === 'modal') {
                      setShowProfileModalOpen(true);
                    } else {
                      router.push(config.profileUrl);
                    }
                  }}
                  className={`block w-full text-left px-4 text-sm transition-all duration-200 active:scale-95 ${isMobile ? 'py-2.5' : 'py-3'} text-foreground hover:bg-primary/10`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {config.labels.profileSettings}
                  </span>
                </button>

                {/* Manage Plan - Only show if billing is configured AND showBilling is true */}
                {config.showBilling && isConfigured() && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowBillingModalOpen(true);
                    }}
                    className={`block w-full text-left px-4 text-sm transition-all duration-200 active:scale-95 ${isMobile ? 'py-2.5' : 'py-3'} text-foreground hover:bg-primary/10`}
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span className="flex-1">{config.labels.managePlan}</span>
                      {isSubscribed && currentPlan && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {currentPlan.name}
                        </span>
                      )}
                    </span>
                  </button>
                )}

                {/* Admin Dashboard */}
                { config.adminUrl && (user.role === 'admin' || user.role === 'owner') && (
                  <Link
                    href={config.adminUrl}
                    className={`block px-4 text-sm transition-all duration-200 active:scale-95 ${isMobile ? 'py-2.5' : 'py-3'} text-foreground hover:bg-primary/10`}
                    onClick={() => setShowDropdown(false)}
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {config.labels.adminDashboard}
                    </span>
                  </Link>
                )}

                {/* Custom Links */}
                {config.customLinks.map((link, index) => {
                  // Get Lucide icon if string is provided (e.g., 'Building2', 'Settings')
                  const LucideIcon = typeof link.icon === 'string' ? getLucideIcon(link.icon) : null;

                  return (
                    <Link
                      key={index}
                      href={link.href}
                      className={`block px-4 text-sm transition-all duration-200 active:scale-95 ${isMobile ? 'py-2.5' : 'py-3'} text-foreground hover:bg-primary/10`}
                      onClick={() => setShowDropdown(false)}
                    >
                      <span className="flex items-center gap-2">
                        {LucideIcon ? (
                          // Lucide icon by name (e.g., 'Building2', 'Settings', 'Home')
                          <LucideIcon className="w-4 h-4" />
                        ) : link.icon ? (
                          // React component or SVG path
                          typeof link.icon === 'string' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                            </svg>
                          ) : (
                            link.icon
                          )
                        ) : (
                          // Default icon
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {link.label}
                      </span>
                    </Link>
                  );
                })}

                <div className="border-t border-border my-1" />

                {/* Sign Out */}
                <button
                  onClick={async () => {
                    setShowDropdown(false);

                    // Build callback URL intelligently for multi-tenant platform
                    let callbackUrl = '/';
                    if (typeof window !== 'undefined') {
                      const afterSignOutUrl = config.afterSignOutUrl || '/';

                      // Check if afterSignOutUrl is already a full URL
                      if (afterSignOutUrl.startsWith('http://') || afterSignOutUrl.startsWith('https://')) {
                        callbackUrl = afterSignOutUrl;
                      } else {
                        // It's a relative path, construct with current domain
                        callbackUrl = `${window.location.origin}${afterSignOutUrl}`;
                      }
                    }

                    await signOut({
                      callbackUrl,
                      redirect: true
                    });
                  }}
                  className={`block w-full text-left px-4 text-sm transition-all duration-200 active:scale-95 ${isMobile ? 'py-2.5' : 'py-3'} text-destructive hover:bg-destructive/10`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {config.labels.signOut}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Profile Modal */}
      <Modal
        isOpen={showProfileModalOpen}
        onClose={() => setShowProfileModalOpen(false)}
      >
        <UserProfile
          isModal={true}
          onClose={() => setShowProfileModalOpen(false)}
          afterSignOutUrl={config.afterSignOutUrl}
        />
      </Modal>

      {/* Billing Modal - Only render if billing is configured AND showBilling is true */}
      {config.showBilling && isConfigured() && showBillingModalOpen && (
        <BillingModal
          isModal={true}
          onClose={() => setShowBillingModalOpen(false)}
        />
      )}
    </>
  );
}

UserWidget.displayName = 'UserWidget';
UserWidget.isSystemComponent = true;
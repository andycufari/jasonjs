/**
 * JasonJS Framework - Auth Components
 *
 * Recommended Components:
 * - UnifiedAuth: Complete auth flow with automatic user detection
 * - AuthModal: Modal wrapper for UnifiedAuth
 * - EmailCodeVerification: 6-digit code input with auto-submit
 * - useAuthLanguage: i18n hook for auth translations
 *
 * Deprecated Components (kept for backwards compatibility):
 * - LoginForm: Use UnifiedAuth instead
 * - SignupForm: Use UnifiedAuth instead
 * - CodeVerificationInput: Use EmailCodeVerification instead
 */

// Core auth provider and hook
export { ClientAuthProvider, useAuth } from './AuthProvider';

// Recommended: Modal wrapper for auth flows
export { default as AuthModal } from './AuthModal';

// Recommended: Unified auth component (handles login + signup automatically)
export { default as UnifiedAuth } from './UnifiedAuth';

// Recommended: Code verification with individual digit inputs
export { default as EmailCodeVerification } from './EmailCodeVerification';

// Recommended: Password reset form
export { default as ForgotPasswordForm } from './ForgotPasswordForm';

// Recommended: User profile/settings (includes email change, password reset, account deletion)
export { default as UserProfile } from './UserProfile';

// Deprecated: Use UnifiedAuth instead (renamed to _ComponentName)
export { default as LoginForm } from './_LoginForm';
export { default as SignupForm } from './_SignupForm';

// Deprecated: Use EmailCodeVerification instead
export { default as CodeVerificationInput } from './CodeVerificationInput';

// i18n utilities for auth translations
export { useAuthLanguage, translate } from './i18n';

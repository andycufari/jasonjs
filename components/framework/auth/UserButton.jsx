// components/framework/auth/UserButton.jsx
// Re-exports UserWidget for backward compatibility
// UserWidget is the canonical implementation with full features
'use client';

import UserWidget from './UserWidget';

/**
 * UserButton - Alias for UserWidget
 *
 * This component is kept for backward compatibility.
 * Use UserWidget directly for new implementations.
 *
 * @see UserWidget for full documentation and props
 */
export default function UserButton(props) {
  return <UserWidget {...props} />;
}

UserButton.displayName = 'UserButton';
UserButton.isSystemComponent = true;

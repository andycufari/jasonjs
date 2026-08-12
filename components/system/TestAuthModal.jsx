'use client';

import { useApp } from '@/core/hooks/useApp';

export default function TestAuthModal() {
  const app = useApp();

  const handleAddToFavorites = async () => {
    try {
      const user = await app.auth.requireLogin({
        message: 'Sign in to save this item to your favorites list'
      });

      if (user) {
        // User is now authenticated, continue with action
        app.ui.toast(`Welcome ${user.name}! Added to favorites!`, { type: 'success' });
      }
    } catch (error) {
      // User cancelled authentication
      app.ui.toast('Authentication cancelled', { type: 'info' });
    }
  };

  const handleSignupFirst = async () => {
    try {
      const user = await app.auth.requireLogin({
        mode: 'signup',
        message: 'Create an account to get started'
      });

      if (user) {
        app.ui.toast(`Welcome to the platform, ${user.name}!`, { type: 'success' });
      }
    } catch (error) {
      app.ui.toast('Signup cancelled', { type: 'info' });
    }
  };

  const handleManualModal = async () => {
    try {
      await app.auth.showModal({
        message: 'Manual authentication modal test'
      });
    } catch (error) {
      console.log('Manual modal cancelled');
    }
  };

  return (
    <div className="p-6 space-y-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Test Auth Modal
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Test the seamless authentication flow without redirects
      </p>

      <div className="space-y-3">
        <button
          onClick={handleAddToFavorites}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          ❤️ Add to Favorites (Login Mode)
        </button>

        <button
          onClick={handleSignupFirst}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          🚀 Get Started (Signup Mode)
        </button>

        <button
          onClick={handleManualModal}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          🎯 Manual Modal Test
        </button>
      </div>

      {app.auth.isAuthenticated && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✅ Authenticated as: <strong>{app.auth.user?.name}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

TestAuthModal.displayName = 'TestAuthModal';
TestAuthModal.isSystemComponent = true;
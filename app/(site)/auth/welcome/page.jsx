// app/(site)/auth/welcome/page.jsx
import Link from 'next/link';
import { authMiddleware } from '@/core/auth/middleware';

export default async function WelcomePage({ pageData, searchParams }) {
  // This page requires authentication
  const user = await authMiddleware({ ...pageData, auth: true });

  const authSettings = pageData.auth || {};
  const redirectUrl = authSettings.redirects?.afterSignUp || '/';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to the platform! 🎉
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Hi {user?.name || user?.username || 'there'}!
          </p>
          <p className="text-gray-500 mb-8">
            Your account has been created successfully.
          </p>
          
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h2>
            <div className="space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-gray-500">Username:</span>
                <span className="font-medium">{user?.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Role:</span>
                <span className="font-medium capitalize">{user?.role || 'user'}</span>
              </div>
              {user?.name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-medium">{user.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Link
              href={redirectUrl}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Continue to Application
            </Link>
            
            <Link
              href="/auth/profile"
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
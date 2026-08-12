'use client'

import { useSession, signOut } from 'next-auth/react';

export default function SessionStatus() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="p-4 bg-white/10 backdrop-blur-sm rounded-lg">
        <p className="text-gray-300">Loading session...</p>
      </div>
    );
  }

  if (status === 'authenticated' && session?.user) {
    return (
      <div className="p-6 bg-white/10 backdrop-blur-sm rounded-lg">
        <p className="text-lg mb-2">
          <span className="text-gray-300">Signed in as:</span>{' '}
          <span className="text-white font-semibold">
            {session.user.name || session.user.email || session.user.username}
          </span>
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white/10 backdrop-blur-sm rounded-lg">
      <p className="text-lg text-gray-300 mb-4">
        You are not signed in
      </p>
      <p className="text-sm text-gray-400">
        Sign in to access protected pages
      </p>
    </div>
  );
}

SessionStatus.displayName = 'SessionStatus';
SessionStatus.isSystemComponent = true;
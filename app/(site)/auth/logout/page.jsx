// app/(site)/auth/logout/page.jsx
'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const handleLogout = async () => {
      // Get current origin to stay on same domain
      const currentOrigin = window.location.origin

      await signOut({
        redirect: true,
        callbackUrl: currentOrigin + '/'
      })
    }

    handleLogout()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Logging out...</p>
    </div>
  )
}
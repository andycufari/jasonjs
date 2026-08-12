// studio/core/auth/session.js
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { WebappUsers } from './db';

const JWT_SECRET = process.env.WEBAPP_JWT_SECRET;
const COOKIE_NAME = 'webapp_auth_token';

export async function createSession(user, startupId) {
  const token = await new SignJWT({
    userId: user._id.toString(),
    startupId: startupId,
    email: user.email
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(new TextEncoder().encode(JWT_SECRET));

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  });

  return token;
}

export async function getUserSession(startupId) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME);
    
    if (!token) return null;

    // Verify JWT
    const verified = await jwtVerify(
      token.value,
      new TextEncoder().encode(JWT_SECRET)
    );

    // Only return if token belongs to this site
    if (verified.payload.startupId !== startupId) return null;

    return await WebappUsers.findUserById(verified.payload.userId, startupId);
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

export async function clearSession() {
  cookies().delete(COOKIE_NAME);
}

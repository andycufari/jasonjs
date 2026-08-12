// app/api/(site)/dev-mode/route.js
import { NextResponse } from 'next/server';
import { resolveSite } from '@/core/sites/resolve';
import { getClientIpFromRequest } from '@/core/utils/getClientIp.js';
import devModeCache from '@/core/utils/devModeCache.js';

/**
 * Dev Mode API (Per-IP Security)
 * GET: Check dev mode status for current IP
 * POST: Enable/disable dev mode for current IP
 * DELETE: Disable dev mode for current IP
 *
 * Query parameters:
 * - enable: Enable dev mode (POST ?enable=true)
 * - disable: Disable dev mode (POST ?disable=true)
 * - duration: Custom duration in minutes (default: 1440 = 24 hours)
 *
 * Security: Dev mode is per-IP to prevent random visitors from disabling cache
 * Works for all sites (no auth required!)
 */

export async function GET(request) {
  try {
    const { host: domain } = await resolveSite(request);
    if (!domain) {
      return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    }

    // Get client IP
    const clientIp = getClientIpFromRequest(request);

    const info = await devModeCache.getInfo(domain, clientIp);

    return NextResponse.json({
      success: true,
      domain,
      ipAddress: clientIp || 'unknown',
      devMode: info
    });
  } catch (error) {
    console.error('[DevModeAPI] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { host: domain } = await resolveSite(request);
    if (!domain) {
      return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    }

    // Get client IP
    const clientIp = getClientIpFromRequest(request);

    const url = new URL(request.url);
    const enable = url.searchParams.get('enable') === 'true';
    const disable = url.searchParams.get('disable') === 'true';
    const durationMinutes = parseInt(url.searchParams.get('duration') || '1440'); // Default 24h

    if (enable) {
      const duration = durationMinutes * 60 * 1000; // Convert to milliseconds
      await devModeCache.enable(domain, clientIp, duration);

      return NextResponse.json({
        success: true,
        message: `Dev mode enabled for ${durationMinutes} minutes`,
        domain,
        ipAddress: clientIp || 'unknown',
        devMode: await devModeCache.getInfo(domain, clientIp)
      });
    }

    if (disable) {
      await devModeCache.disable(domain, clientIp);

      return NextResponse.json({
        success: true,
        message: 'Dev mode disabled',
        domain,
        ipAddress: clientIp || 'unknown',
        devMode: await devModeCache.getInfo(domain, clientIp)
      });
    }

    return NextResponse.json({
      error: 'Missing enable or disable parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('[DevModeAPI] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { host: domain } = await resolveSite(request);
    if (!domain) {
      return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    }

    // Get client IP
    const clientIp = getClientIpFromRequest(request);

    await devModeCache.disable(domain, clientIp);

    return NextResponse.json({
      success: true,
      message: 'Dev mode disabled',
      domain,
      ipAddress: clientIp || 'unknown'
    });
  } catch (error) {
    console.error('[DevModeAPI] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

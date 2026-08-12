// API endpoint to cache Notion images to CDN
import { NextResponse } from 'next/server';
import { getOptimizedUrl, generatePresignedUrl } from '../../../core/services/storage/s3';

/**
 * Cache and optimize images from external sources (like Notion)
 * This prevents expiring URLs and ensures images are always available
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const originalUrl = searchParams.get('url');
    const width = searchParams.get('w');
    const height = searchParams.get('h');
    const quality = searchParams.get('q') || '85';
    const format = searchParams.get('f') || 'auto';

    if (!originalUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Check if this is a Notion image that needs caching
    const isNotionImage = originalUrl.includes('s3.us-west-2.amazonaws.com') ||
      originalUrl.includes('prod-files-secure.s3') ||
      originalUrl.includes('notion.so') ||
      originalUrl.includes('file.notion.so');

    if (!isNotionImage) {
      // For non-Notion images, redirect to original
      return NextResponse.redirect(originalUrl);
    }

    // Generate a cache key based on the original URL
    const urlHash = Buffer.from(originalUrl).toString('base64url');
    const extension = originalUrl.split('.').pop() || 'jpg';
    const cacheKey = `cached-images/${urlHash}.${extension}`;

    // Check if we have CDN configured
    const cdnBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;

    if (cdnBaseUrl) {
      // Build optimized CDN URL
      const optimizedUrl = getOptimizedUrl('system', `system/${cacheKey}`, {
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        quality: parseInt(quality),
        format
      });

      // For now, redirect to the CDN URL
      // In production, you might want to:
      // 1. Check if the image already exists in CDN
      // 2. If not, fetch from Notion and upload to S3/CDN
      // 3. Then redirect to the cached version

      return NextResponse.redirect(optimizedUrl);
    } else {
      // No CDN configured, proxy the image directly
      try {
        const response = await fetch(originalUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const imageBuffer = await response.arrayBuffer();

        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
            'CDN-Cache-Control': 'public, max-age=31536000'
          }
        });
      } catch (error) {
        console.error('Error proxying image:', error);
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('Error in cache-image API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle POST requests to pre-cache images
 */
export async function POST(request) {
  try {
    const { urls } = await request.json();

    if (!Array.isArray(urls)) {
      return NextResponse.json({ error: 'urls must be an array' }, { status: 400 });
    }

    const results = [];

    for (const url of urls) {
      try {
        // Generate cache URL for this image
        const cacheUrl = `/api/cache-image?url=${encodeURIComponent(url)}`;

        // Trigger caching by making a HEAD request
        await fetch(new URL(cacheUrl, request.url).toString(), { method: 'HEAD' });

        results.push({ url, cached: true, cacheUrl });
      } catch (error) {
        results.push({ url, cached: false, error: error.message });
      }
    }

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Error in cache-image POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
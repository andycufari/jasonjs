// app/api/proxy/image/route.js
import { NextResponse } from 'next/server';
import jasonConfig from '@/jason.config';
import {
  getNormalizedUrl,
  getFromCache,
  saveToCache,
  isValidImage,
} from '@/core/db/adapters/notion/imageCache';

// Export configuration
export const dynamic = 'force-dynamic';

// Cache settings
const CACHE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

// When a live fetch fails (e.g. an expired Notion presigned URL), fall back to
// any bytes we already cached for this file — the render-time warmer normally
// put them there. If we have nothing, return a real error status (NOT a 200
// with a placeholder pixel), so next/image treats it as a failure and retries
// on a later render instead of caching a permanent blank.
async function failureResponse(imageUrl, reason) {
  const stale = await getFromCache(imageUrl);
  if (stale.cacheHit) {
    return new NextResponse(stale.data, {
      headers: {
        'Content-Type': stale.contentType,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
        'X-Cache': 'STALE',
      },
    });
  }
  return new NextResponse(`Image unavailable: ${reason}`, {
    status: 502,
    headers: { 'Cache-Control': 'no-store', 'X-Image-Error': reason },
  });
}

// Properly clean and decode URLs
function sanitizeUrl(url) {
  if (!url) return '';
  
  // Replace HTML-encoded ampersands and other entities
  let cleanUrl = url.replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&#x2F;/g, '/');
  
  // Try to fix double encoding issues if present
  try {
    if (cleanUrl.includes('%25')) {
      cleanUrl = decodeURIComponent(cleanUrl);
    }
  } catch (e) {
    console.warn('Error decoding URL parameter:', e);
  }
  
  return cleanUrl;
}

export async function GET(request) {
  // Hoisted so the catch block can still attempt a cache fallback for it.
  let imageUrl;
  try {
    // Get image URL from query
    const url = new URL(request.url);
    imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }

    // Apply URL sanitization to fix encoding issues
    imageUrl = sanitizeUrl(imageUrl);
    
    // Check if this is an AWS signed URL that needs special handling
    const isAwsSignedUrl = imageUrl.includes('X-Amz-Signature') && 
                           (imageUrl.includes('amazonaws.com') || 
                            imageUrl.includes('prod-files-secure.s3'));

    // Basic security check for allowed domains
    const allowedDomains = [
      'prod-files-secure.s3',
      's3.us-west-2.amazonaws.com',
      's3.amazonaws.com',
      'storage.tally.so',
      'notion.so',
      'file.notion.so'
    ];
    
    const isDomainAllowed = allowedDomains.some(domain => imageUrl.includes(domain));
    if (!isDomainAllowed) {
      console.warn(`Blocked image from non-allowed domain: ${imageUrl}`);
      return new NextResponse('Invalid image source', { status: 403 });
    }
    
    // Get the normalized URL for logging
    const normalizedUrl = getNormalizedUrl(imageUrl);
    
    // Check if we have this image cached
    const cached = await getFromCache(imageUrl);
    if (cached.cacheHit) {
      console.log(`Cache HIT for: ${normalizedUrl.substring(0, 50)}...`);
      return new NextResponse(cached.data, {
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
          'X-Cache': 'HIT'
        }
      });
    }
    
    console.log(`Cache MISS for: ${normalizedUrl.substring(0, 50)}...`);

    // Parse the image URL to get host and path
    let parsedUrl;
    try {
      parsedUrl = new URL(imageUrl);
    } catch (error) {
      console.error('Invalid URL:', imageUrl);
      return new NextResponse('Invalid URL', { status: 400 });
    }

    // Set up request headers (especially important for private/signed URLs)
    const requestHeaders = {
      'User-Agent': jasonConfig.proxyUserAgent,
      'Accept': 'image/*,*/*',
      'Referer': url.origin,
      'Host': parsedUrl.host,
      'Origin': url.origin
    };

    // For AWS/Notion URLs, add specific headers
    if (isAwsSignedUrl) {
      // Add AWS specific headers
      requestHeaders['Accept-Encoding'] = 'gzip, deflate, br';
      requestHeaders['Connection'] = 'keep-alive';
      requestHeaders['Cache-Control'] = 'no-cache';
      requestHeaders['Pragma'] = 'no-cache';
      console.log('Handling secure AWS URL with credentials');
    }

    // For tally.so, add authorization if present in the original URL
    if (imageUrl.includes('storage.tally.so') && imageUrl.includes('accessToken=')) {
      const accessToken = parsedUrl.searchParams.get('accessToken');
      if (accessToken) {
        requestHeaders['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    // Fetch the image with retry logic
    let imageResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      try {
        // Add retry delay if not the first attempt
        if (retryCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          console.log(`Retry ${retryCount} for: ${normalizedUrl.substring(0, 50)}...`);
        }
        
        const fetchOptions = {
          headers: requestHeaders,
          redirect: 'follow',
          cache: 'no-store',
          method: 'GET',
          credentials: 'include', // For cross-origin requests that require credentials
        };
        
        imageResponse = await fetch(imageUrl, fetchOptions);
        
        if (imageResponse.ok) {
          console.log(`Successfully fetched image: ${normalizedUrl.substring(0, 50)}... (${imageResponse.status})`);
          break;
        }
        
        // If status is 403 or 404, log the full error details and try one more time
        if (imageResponse.status === 403 || imageResponse.status === 404) {
          console.error(`Error ${imageResponse.status} fetching image:`, normalizedUrl.substring(0, 100));
          
          // For 403 errors with AWS URLs, try once more with modified headers
          if (imageResponse.status === 403 && isAwsSignedUrl && retryCount === 0) {
            // Try with different headers
            requestHeaders['Cache-Control'] = 'no-cache';
            requestHeaders['Pragma'] = 'no-cache';
            retryCount++;
            continue;
          }
          
          break;
        }
        
        retryCount++;
      } catch (fetchError) {
        console.error(`Fetch retry ${retryCount}/${maxRetries} failed:`, fetchError);
        retryCount++;
        
        if (retryCount > maxRetries) {
          throw fetchError;
        }
      }
    }

    if (!imageResponse || !imageResponse.ok) {
      console.error(`Failed to fetch image: ${imageResponse?.status} ${imageResponse?.statusText} from URL: ${normalizedUrl.substring(0, 100)}`);
      return failureResponse(imageUrl, `upstream ${imageResponse?.status || 'error'}`);
    }

    // Get content type, defaulting to JPEG if not provided
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Get the image data
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    // Validate that this is actually an image
    if (!isValidImage(imageBuffer, contentType)) {
      console.error('Invalid image data received from URL:', normalizedUrl.substring(0, 100));
      return failureResponse(imageUrl, 'invalid image data');
    }
    
    // Cache the image
    await saveToCache(imageUrl, imageBuffer, contentType);

    // Return the image with caching headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
        'X-Cache': 'MISS'
      }
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    // imageUrl may be undefined if we threw before parsing it; guard the fallback.
    try {
      return await failureResponse(imageUrl, 'server error');
    } catch {
      return new NextResponse('Image unavailable', {
        status: 502,
        headers: { 'Cache-Control': 'no-store', 'X-Image-Error': 'server error' },
      });
    }
  }
}
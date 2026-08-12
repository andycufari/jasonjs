import { NextResponse } from 'next/server';
import { existsSync, mkdirSync } from 'fs';
import { mkdir, writeFile, readFile, stat } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Export configuration
export const dynamic = 'force-dynamic';

// Cache settings
const CACHE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
const CACHE_DIR = path.join(process.cwd(), '.audio-cache');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    console.log('Created audio cache directory:', CACHE_DIR);
  } catch (error) {
    console.error('Failed to create cache directory:', error);
  }
}

// Function to normalize URL for caching
// This removes AWS signature parameters that change over time
function getNormalizedUrl(url) {
  try {
    const parsedUrl = new URL(url);
    
    // For AWS S3 URLs, remove signature-related parameters
    if (
      url.includes('amazonaws.com') || 
      url.includes('prod-files-secure.s3') ||
      url.includes('notion.so')
    ) {
      // AWS signature params to remove
      const signatureParams = [
        'X-Amz-Signature',
        'X-Amz-Date',
        'X-Amz-SignedHeaders',
        'X-Amz-Expires',
        'X-Amz-Algorithm',
        'X-Amz-Credential',
        'X-Amz-Security-Token'
      ];
      
      // Remove signature params from the URL
      signatureParams.forEach(param => {
        parsedUrl.searchParams.delete(param);
      });
      
      // If the URL has an Amz prefix but without params, it's likely still pointing to the same resource
      return parsedUrl.origin + parsedUrl.pathname;
    }
    
    // For other URLs, keep as is
    return url;
  } catch (e) {
    console.warn('Error normalizing URL:', e);
    return url; // Return original URL if parsing fails
  }
}

// Function to generate a cache key from URL
function getCacheKey(url) {
  // Use the normalized URL to create a consistent cache key
  const normalizedUrl = getNormalizedUrl(url);
  return crypto.createHash('md5').update(normalizedUrl).digest('hex');
}

// Function to get cache path for a URL
function getCachePath(url) {
  const cacheKey = getCacheKey(url);
  return path.join(CACHE_DIR, cacheKey);
}

// Function to check if URL is cached and get cached data
async function getFromCache(url) {
  try {
    const cachePath = getCachePath(url);
    
    // Check if file exists
    const fileStats = await stat(cachePath);
    
    // Check if metadata file exists
    const metadataPath = `${cachePath}.meta`;
    let contentType = 'audio/mpeg'; // Default
    
    try {
      const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
      contentType = metadata.contentType;
    } catch (e) {
      // If metadata doesn't exist, use default
      console.warn('No metadata found for cached audio:', getNormalizedUrl(url));
    }
    
    // Read the file
    const data = await readFile(cachePath);
    
    return {
      data,
      contentType,
      cacheHit: true
    };
  } catch (error) {
    // File doesn't exist or can't be read
    return { cacheHit: false };
  }
}

// Function to save data to cache
async function saveToCache(url, data, contentType) {
  try {
    const cachePath = getCachePath(url);
    const normalizedUrl = getNormalizedUrl(url);
    
    // Save the file
    await writeFile(cachePath, data);
    
    // Save metadata
    const metadataPath = `${cachePath}.meta`;
    const metadata = {
      url: normalizedUrl, // Store the normalized URL
      contentType,
      cachedAt: new Date().toISOString()
    };
    
    await writeFile(metadataPath, JSON.stringify(metadata));
    return true;
  } catch (error) {
    console.error('Failed to cache audio:', error);
    return false;
  }
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

// Function to detect audio format based on magic numbers/headers
function detectAudioFormat(data) {
  if (data.length < 12) return 'audio/mpeg'; // Default if too small to detect

  // Check for MP3 (ID3v2)
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
    return 'audio/mpeg';
  }
  
  // Check for MP3 (without ID3, starts with sync word)
  if ((data[0] === 0xFF && (data[1] & 0xE0) === 0xE0)) {
    return 'audio/mpeg';
  }
  
  // Check for WAV (RIFF header)
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45) {
    return 'audio/wav';
  }
  
  // Check for OGG
  if (data[0] === 0x4F && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) {
    return 'audio/ogg';
  }

  // Check for M4A/AAC (ftyp header)
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    return 'audio/mp4';
  }

  // Default to MP3 if we can't identify
  return 'audio/mpeg';
}

export async function GET(request) {
  try {
    // Get audio URL from query
    const url = new URL(request.url);
    let audioUrl = url.searchParams.get('url');
    
    if (!audioUrl) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }

    // Apply URL sanitization to fix encoding issues
    audioUrl = sanitizeUrl(audioUrl);
    
    // Check if this is an AWS signed URL that needs special handling
    const isAwsSignedUrl = audioUrl.includes('X-Amz-Signature') && 
                           (audioUrl.includes('amazonaws.com') || 
                            audioUrl.includes('prod-files-secure.s3'));

    // Basic security check for allowed domains
    const allowedDomains = [
      'prod-files-secure.s3',
      's3.us-west-2.amazonaws.com',
      's3.amazonaws.com',
      'storage.tally.so',
      'notion.so',
      'file.notion.so'
    ];
    
    const isDomainAllowed = allowedDomains.some(domain => audioUrl.includes(domain));
    if (!isDomainAllowed) {
      console.warn(`Blocked audio from non-allowed domain: ${audioUrl}`);
      return new NextResponse('Invalid audio source', { status: 403 });
    }
    
    // Get the normalized URL for logging
    const normalizedUrl = getNormalizedUrl(audioUrl);
    
    // Extract range header if present (for streaming audio)
    const rangeHeader = request.headers.get('range');
    
    // Check if we have this audio cached
    const cached = await getFromCache(audioUrl);
    if (cached.cacheHit) {
      console.log(`Cache HIT for audio: ${normalizedUrl.substring(0, 50)}...`);
      
      // If range is requested, handle partial content
      if (rangeHeader) {
        // Parse the range header
        const matches = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
        if (!matches) {
          console.warn('Invalid range header:', rangeHeader);
          return new NextResponse(cached.data, {
            headers: {
              'Content-Type': cached.contentType,
              'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
              'X-Cache': 'HIT',
              'Accept-Ranges': 'bytes'
            }
          });
        }
        
        // Parse start and end bytes
        const start = parseInt(matches[1], 10);
        const end = matches[2] ? parseInt(matches[2], 10) : cached.data.length - 1;
        
        // Get the requested chunk
        const chunk = cached.data.slice(start, end + 1);
        
        console.log(`Serving range ${start}-${end}/${cached.data.length} for ${normalizedUrl.substring(0, 50)}...`);
        
        // Return partial content
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Type': cached.contentType,
            'Content-Range': `bytes ${start}-${end}/${cached.data.length}`,
            'Content-Length': chunk.length.toString(),
            'Accept-Ranges': 'bytes',
            'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
            'X-Cache': 'HIT'
          }
        });
      }
      
      // Return full content
      return new NextResponse(cached.data, {
        headers: {
          'Content-Type': cached.contentType,
          'Content-Length': cached.data.length.toString(),
          'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
          'X-Cache': 'HIT',
          'Accept-Ranges': 'bytes'
        }
      });
    }
    
    console.log(`Cache MISS for audio: ${normalizedUrl.substring(0, 50)}...`);
    
    // Build headers for fetch
    const fetchHeaders = {
      // Add standard headers for AWS signed URLs when needed
      ...(isAwsSignedUrl ? {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 Studio Audio Proxy'
      } : {})
    };
    
    // Forward range header if present
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }
    
    // Use native fetch to get the audio file
    const response = await fetch(audioUrl, { headers: fetchHeaders });
    
    // Handle error response
    if (!response.ok && response.status !== 206) {
      console.error(`Failed to fetch audio (${response.status}): ${normalizedUrl}`);
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Detect audio format if the content type is generic
    const detectedFormat = detectAudioFormat(buffer);
    const finalContentType = contentType.includes('octet-stream') ? detectedFormat : contentType;
    
    // Save to cache for future requests (only if it's a full response)
    if (response.status !== 206) {
      await saveToCache(audioUrl, buffer, finalContentType);
    }
    
    // Forward the appropriate status and headers
    const headers = {
      'Content-Type': finalContentType,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      'Accept-Ranges': 'bytes',
      'X-Cache': 'MISS'
    };
    
    // If it's a partial response, forward the Content-Range header
    if (response.status === 206) {
      headers['Content-Range'] = response.headers.get('Content-Range');
      
      return new NextResponse(buffer, {
        status: 206,
        headers
      });
    }
    
    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Audio proxy error:', error);
    return new NextResponse('Error fetching audio', { status: 500 });
  }
} 
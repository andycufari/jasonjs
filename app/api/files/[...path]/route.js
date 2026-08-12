// app/api/files/[...path]/route.js
// Secure file serving API with CORS and privacy controls

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { resolveSite } from '@/core/sites/resolve';
import { getFileSystem } from '@/core/sites/files.js';
import s3Service from '@/core/services/storage/s3';

/**
 * SECURE FILE SERVING API
 *
 * Features:
 * - Privacy controls based on database security configuration
 * - CORS handling for cross-origin requests
 * - Proxy serving to avoid exposing S3 URLs
 * - Performance with caching and CDN
 * - Tenant isolation and access control
 * - File metadata and optimization
 */

// CORS headers for file serving
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Cache headers for different file types
const getCacheHeaders = (fileType, isPublic = true) => {
  const headers = {
    ...CORS_HEADERS
  };

  if (isPublic) {
    // Public files - aggressive caching
    if (fileType?.startsWith('image/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'; // 1 year
    } else if (fileType?.startsWith('video/') || fileType?.startsWith('audio/')) {
      headers['Cache-Control'] = 'public, max-age=2592000'; // 30 days
    } else {
      headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours
    }
  } else {
    // Private files - limited caching
    headers['Cache-Control'] = 'private, max-age=3600'; // 1 hour
  }

  return headers;
};

// Validate file access based on security configuration
async function validateFileAccess(fileRecord, session, host) {
  if (!fileRecord) return { allowed: false, reason: 'File not found' };

  // Get database configuration for the file's collection
  const fileSystem = getFileSystem();

  let site = null;
  let databaseConfig = null;

  try {
    if (fileSystem.hasAdapter()) {
      site = await fileSystem.getSite(host);
      if (!site) {
        return { allowed: false, reason: 'Site not found' };
      }

      // Find the database configuration that contains this file
      // This would need to be enhanced based on your specific schema
      // For now, assume files are stored with database reference
      if (fileRecord.databaseId) {
        // Get database config from the site's database configurations
        const databases = await fileSystem.getAllDatabases(host);
        databaseConfig = databases?.[fileRecord.databaseId];
      }
    }
  } catch (error) {
    console.error('Error validating file access:', error);
    return { allowed: false, reason: 'Database error' };
  }

  // Check security configuration
  if (databaseConfig?.security?.files) {
    const fileSecurity = databaseConfig.security.files;

    // Check if files are public by default
    if (fileSecurity.public === true) {
      return { allowed: true, reason: 'Public access' };
    }

    // Check authentication requirement
    if (fileSecurity.requireAuth === true && !session?.user) {
      return { allowed: false, reason: 'Authentication required' };
    }

    // Check role-based access
    if (fileSecurity.allowedRoles && session?.user) {
      const userRoles = session.user.roles || [];
      const hasAccess = fileSecurity.allowedRoles.some(role =>
        userRoles.includes(role)
      );

      if (!hasAccess) {
        return { allowed: false, reason: 'Insufficient permissions' };
      }
    }

    // Check owner access
    if (fileSecurity.ownerOnly === true && session?.user) {
      const userId = session.user.id;

      // Check if user owns the file or the record containing the file
      if (fileRecord.ownerId === userId ||
          fileRecord.createdBy === userId ||
          fileRecord.userId === userId) {
        return { allowed: true, reason: 'Owner access' };
      }

      return { allowed: false, reason: 'Owner access required' };
    }
  }

  // Default to allowing access if no specific security rules
  return { allowed: true, reason: 'Default access' };
}

// Extract file path and validate format
function parseFilePath(pathArray) {
  if (!pathArray || pathArray.length === 0) {
    return { error: 'File path is required' };
  }

  // Join all path segments
  const fullPath = pathArray.join('/');

  // Basic security: prevent directory traversal
  if (fullPath.includes('..') || fullPath.includes('//')) {
    return { error: 'Invalid file path' };
  }

  return {
    path: fullPath,
    filename: pathArray[pathArray.length - 1],
    directory: pathArray.slice(0, -1).join('/')
  };
}

// Get file from the registered adapter (remote storage)
async function getFileData(path, host) {
  try {
    const fileSystem = getFileSystem();
    const adapter = fileSystem.getAdapter();

    if (adapter) {
      if (typeof adapter.getFileData !== 'function') {
        return { error: 'File serving not supported by adapter' };
      }

      // Adapter resolves the file record by path/S3 key for this domain
      const fileData = await adapter.getFileData(host, path);

      if (!fileData || !fileData.record) {
        return { error: 'File not found in database' };
      }

      return {
        record: fileData.record,
        s3Url: fileData.s3Url ?? fileData.record.assetMetadata?.s3Url,
        content: fileData.content ?? fileData.record.content,
        metadata: fileData.metadata ?? fileData.record.assetMetadata ?? {}
      };
    } else {
      // Local file system mode
      return { error: 'Local file serving not implemented' };
    }
  } catch (error) {
    console.error('Error getting file data:', error);
    return { error: 'Database error' };
  }
}

// Stream file from S3 with range support
async function streamFromS3(s3Url, request, headers) {
  try {
    const range = request.headers.get('range');

    // If range request, we need to handle it specially
    if (range) {
      // For simplicity, redirect to S3 and let it handle ranges
      // In production, you might want to proxy the range request
      return NextResponse.redirect(s3Url, {
        status: 302,
        headers: {
          ...headers,
          'Accept-Ranges': 'bytes'
        }
      });
    }

    // For regular requests, we can redirect or proxy
    const proxyResponse = await fetch(s3Url);

    if (!proxyResponse.ok) {
      throw new Error(`S3 fetch failed: ${proxyResponse.status}`);
    }

    const body = await proxyResponse.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': proxyResponse.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': proxyResponse.headers.get('content-length') || body.byteLength.toString(),
        'Last-Modified': proxyResponse.headers.get('last-modified'),
        'ETag': proxyResponse.headers.get('etag'),
        'Accept-Ranges': 'bytes'
      }
    });
  } catch (error) {
    console.error('Error streaming from S3:', error);
    throw error;
  }
}

// Main GET handler
export async function GET(request, { params }) {
  try {
    // Parse parameters
    const { path: pathArray } = await params;
    const { host } = await resolveSite();

    if (!host) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Parse and validate file path
    const { path, filename, directory, error: pathError } = parseFilePath(pathArray);
    if (pathError) {
      return NextResponse.json(
        { error: pathError },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log(`[Files] Serving file: domain=${host}, path=${path}`);

    // Get file data
    const { record, s3Url, content, metadata, error: fileError } = await getFileData(path, host);
    if (fileError) {
      return NextResponse.json(
        { error: fileError },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Get user session for access control
    const session = await getServerSession(await authOptions());

    // Validate access permissions
    const { allowed, reason } = await validateFileAccess(record, session, host);
    if (!allowed) {
      console.log(`[Files] Access denied: ${reason}`);
      return NextResponse.json(
        { error: 'Access denied', reason },
        {
          status: session ? 403 : 401,
          headers: CORS_HEADERS
        }
      );
    }

    console.log(`[Files] Access granted: ${reason}`);

    // Determine file type and caching
    const fileType = metadata.mimeType ||
                    metadata.contentType ||
                    record.assetMetadata?.mimeType ||
                    'application/octet-stream';

    const isPublic = reason === 'Public access';
    const cacheHeaders = getCacheHeaders(fileType, isPublic);

    // Serve from S3 if available
    if (s3Url) {
      console.log(`[Files] Streaming from S3: ${s3Url}`);
      return await streamFromS3(s3Url, request, cacheHeaders);
    }

    // Serve from database content
    if (content) {
      console.log(`[Files] Serving from database: ${filename}`);

      let responseBody = content;

      // Handle base64 encoded content
      if (metadata.encoding === 'base64') {
        responseBody = Buffer.from(content, 'base64');
      }

      return new NextResponse(responseBody, {
        status: 200,
        headers: {
          ...cacheHeaders,
          'Content-Type': fileType,
          'Content-Disposition': `inline; filename="${filename}"`,
          'X-File-Source': 'database'
        }
      });
    }

    // No content available
    return NextResponse.json(
      { error: 'File content not available' },
      { status: 404, headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('[Files] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Handle HEAD requests for efficient caching checks
export async function HEAD(request, params) {
  const response = await GET(request, params);

  // Return headers only, no body
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers
  });
}

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  });
}
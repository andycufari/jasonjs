// app/api/upload/route.js
// Server-side S3 Upload API with tenant isolation

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSite } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * SECURE SERVER-SIDE UPLOAD API
 *
 * Handles file uploads server-side to avoid CORS issues
 * All uploads are automatically tenant-isolated using siteId
 */

// S3 Configuration
const S3_CONFIG = {
  bucket: process.env.S3_BUCKET_NAME || 'cm64-ss-public',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  baseUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL || process.env.PUBLIC_URL || `https://${process.env.S3_BUCKET_NAME || 'cm64-ss-public'}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`
};

// Initialize S3 client
let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    // Check if credentials are properly configured
    if (!S3_CONFIG.accessKeyId || !S3_CONFIG.secretAccessKey) {
      console.error('AWS credentials not configured. Please set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables.');
      throw new Error('AWS credentials not configured');
    }

    s3Client = new S3Client({
      region: S3_CONFIG.region,
      credentials: {
        accessKeyId: S3_CONFIG.accessKeyId,
        secretAccessKey: S3_CONFIG.secretAccessKey,
      },
    });

    console.log('S3 client initialized with credentials');
  }
  return s3Client;
}

// Add CORS headers
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request) {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

export async function POST(request) {
  try {
    // 1. Resolve the site from the request
    const { host } = await resolveSite(request);

    // 2. Parse FormData to get the file
    const formData = await request.formData();
    const file = formData.get('file');
    const fileName = formData.get('fileName') || file?.name;
    const fileType = formData.get('fileType') || file?.type;
    const path = formData.get('path') || 'uploads';

    if (!file) {
      return addCorsHeaders(NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      ));
    }

    // 3. Determine siteId from host or session
    let finalSiteId;

    // Check for authenticated session first
    const session = await getServerSession(await authOptions());

    if (session?.user && (session.user.startupId || session.user.siteId)) {
      // Use session siteId if available
      finalSiteId = session.user.startupId || session.user.siteId;
    } else {
      // For public uploads, get site info from host
      const site = await getSite(host);
      if (site && site.id) {
        finalSiteId = site.id;
      } else {
        // Fallback to host-based ID for sites without database entries
        finalSiteId = `public-${host.replace(/[^a-zA-Z0-9]/g, '-')}`;
      }
    }

    if (!finalSiteId) {
      return addCorsHeaders(NextResponse.json(
        { error: 'Unable to determine site ID' },
        { status: 400 }
      ));
    }

    // 4. Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 5. Generate S3 key with tenant isolation
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${finalSiteId}/${path}/${timestamp}_${randomId}_${sanitizedFileName}`;

    // 6. Upload to S3
    const client = getS3Client();

    // Sanitize metadata values to ensure they only contain US-ASCII characters
    // S3 metadata headers don't support special characters or unicode
    const sanitizeMetadata = (value) => {
      if (!value) return '';
      // Replace non-ASCII characters with underscores and encode the result
      return value
        .replace(/[^\x00-\x7F]/g, '_') // Replace non-ASCII with underscore
        .replace(/[^\w\s\-\.]/g, '_')   // Replace special chars except word chars, spaces, hyphens, dots
        .trim();
    };

    const uploadCommand = new PutObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
      Body: buffer,
      ContentType: fileType,
      Metadata: {
        'upload-source': 'jasonjs-framework',
        'upload-time': new Date().toISOString(),
        'original-name': sanitizeMetadata(fileName), // Sanitized filename
        'site-id': finalSiteId
      }
      // Note: ACL removed as bucket doesn't support ACLs
      // Files will be public based on bucket policy instead
    });

    await client.send(uploadCommand);

    // 7. Generate public URL
    const publicUrl = `${S3_CONFIG.baseUrl}/${key}`;

    // 8. Log upload for security monitoring
    console.log(`File uploaded successfully for site ${finalSiteId}: ${fileName} -> ${key}`);

    return addCorsHeaders(NextResponse.json({
      success: true,
      data: {
        key,
        publicUrl,
        fileName,
        fileType,
        fileSize: buffer.length,
        uploadedAt: new Date().toISOString()
      }
    }));

  } catch (error) {
    console.error('Upload failed:', error);

    return addCorsHeaders(NextResponse.json(
      {
        error: error.message || 'Failed to upload file',
        success: false
      },
      { status: 500 }
    ));
  }
}

// Handle file deletion
export async function DELETE(request) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(await authOptions());

    if (!session?.user) {
      return addCorsHeaders(NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ));
    }

    // 2. Extract siteId for tenant validation
    const siteId = session.user.startupId || session.user.siteId;

    if (!siteId) {
      return addCorsHeaders(NextResponse.json(
        { error: 'Site ID not found in session' },
        { status: 400 }
      ));
    }

    // 3. Parse request body
    const body = await request.json();
    const { key } = body;

    if (!key) {
      return addCorsHeaders(NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      ));
    }

    // 4. Validate that key belongs to the tenant
    if (!key.startsWith(`${siteId}/`)) {
      return addCorsHeaders(NextResponse.json(
        { error: 'Access denied: File does not belong to your site' },
        { status: 403 }
      ));
    }

    // 5. Delete from S3
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = getS3Client();

    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key
    });

    await client.send(deleteCommand);

    console.log(`File deleted for site ${siteId}: ${key}`);

    return addCorsHeaders(NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    }));

  } catch (error) {
    console.error('File deletion failed:', error);

    return addCorsHeaders(NextResponse.json(
      {
        error: error.message || 'Failed to delete file',
        success: false
      },
      { status: 500 }
    ));
  }
}

// Get file info
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return addCorsHeaders(NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      ));
    }

    // Generate public URL
    const publicUrl = `${S3_CONFIG.baseUrl}/${key}`;

    return addCorsHeaders(NextResponse.json({
      success: true,
      url: publicUrl,
      key
    }));

  } catch (error) {
    console.error('Get file URL failed:', error);

    return addCorsHeaders(NextResponse.json(
      {
        error: error.message || 'Failed to get file URL',
        success: false
      },
      { status: 500 }
    ));
  }
}
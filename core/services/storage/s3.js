// core/services/storage/s3.js
// S3 Upload Service with tenant isolation

/**
 * S3 STORAGE SERVICE
 * 
 * Provides secure S3 uploads with automatic tenant isolation
 * All uploads are automatically prefixed with siteId for security
 */

// ===== S3 CLIENT CONFIGURATION =====

const S3_CONFIG = {
  bucket: process.env.S3_BUCKET_NAME || 'cm64-ss-public',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  baseUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL || process.env.PUBLIC_URL
};

// ===== SERVER-SIDE S3 OPERATIONS =====

/**
 * Generate pre-signed URL for secure client-side upload
 * @param {string} siteId - Tenant identifier (auto-injected)
 * @param {string} fileName - Original file name
 * @param {string} fileType - MIME type
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Pre-signed URL data
 */
export async function generatePresignedUrl(siteId, fileName, fileType, options = {}) {
  const { 
    path = 'uploads',
    expiresIn = 300, // 5 minutes
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf']
  } = options;
  
  // Validate file type
  const isAllowed = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return fileType.startsWith(type.slice(0, -1));
    }
    return fileType === type;
  });
  
  if (!isAllowed) {
    throw new Error(`File type ${fileType} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  // Generate secure, tenant-isolated key
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substr(2, 9);
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // CRITICAL: Always prefix with siteId for tenant isolation
  const key = `${siteId}/${path}/${timestamp}_${randomId}_${sanitizedFileName}`;
  
  // AWS SDK v3 implementation would go here
  // For now, return the structure for client-side upload
  const presignedUrl = await generateS3PresignedUrl({
    bucket: S3_CONFIG.bucket,
    key,
    contentType: fileType,
    contentLength: maxSize,
    expiresIn
  });
  
  return {
    uploadUrl: presignedUrl,
    key,
    publicUrl: `${S3_CONFIG.baseUrl}/${key}`,
    expiresAt: Date.now() + (expiresIn * 1000),
    maxSize
  };
}

/**
 * Delete file from S3 with tenant validation
 * @param {string} siteId - Tenant identifier
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} Success status
 */
export async function deleteFile(siteId, key) {
  // CRITICAL: Validate that key belongs to the tenant
  if (!key.startsWith(`${siteId}/`)) {
    throw new Error('Access denied: File does not belong to your tenant');
  }
  
  // AWS SDK v3 delete implementation would go here
  return await deleteS3Object(S3_CONFIG.bucket, key);
}

/**
 * Generate optimized asset URL with CDN support
 * @param {string} siteId - Tenant identifier  
 * @param {string} key - S3 object key
 * @param {Object} options - Optimization options
 * @returns {string} Optimized asset URL
 */
export function getOptimizedUrl(siteId, key, options = {}) {
  // CRITICAL: Validate that key belongs to the tenant
  if (!key.startsWith(`${siteId}/`)) {
    throw new Error('Access denied: File does not belong to your tenant');
  }
  
  const { 
    width, 
    height, 
    quality = 85, 
    format = 'auto',
    resize = 'cover'
  } = options;
  
  let url = `${S3_CONFIG.baseUrl}/${key}`;
  
  // Add optimization parameters if asset optimization is enabled
  if (process.env.ASSET_OPTIMIZATION_ENABLED === 'true') {
    const params = new URLSearchParams();
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    if (quality !== 85) params.set('q', quality.toString());
    if (format !== 'auto') params.set('f', format);
    if (resize !== 'cover') params.set('fit', resize);
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  return url;
}

// ===== AWS SDK HELPERS =====

// Initialize S3 client with proper configuration
let s3Client = null;

async function getS3Client() {
  if (!s3Client) {
    try {
      // Dynamic import to avoid issues if AWS SDK is not installed
      const { S3Client } = await import('@aws-sdk/client-s3');

      s3Client = new S3Client({
        region: S3_CONFIG.region,
        credentials: {
          accessKeyId: S3_CONFIG.accessKeyId,
          secretAccessKey: S3_CONFIG.secretAccessKey,
        },
        // Add additional configuration for better performance
        maxAttempts: 3,
        retryMode: 'adaptive',
      });

      console.log('S3 client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize S3 client:', error);
      throw new Error('S3 configuration error. Please check your environment variables.');
    }
  }
  return s3Client;
}

/**
 * Generate pre-signed URL using AWS SDK v3
 */
async function generateS3PresignedUrl({ bucket, key, contentType, contentLength, expiresIn }) {
  try {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = await getS3Client();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      // Add metadata for better file management
      Metadata: {
        'upload-source': 'jasonjs-framework',
        'upload-time': new Date().toISOString()
      }
      // Note: ACL removed as modern S3 buckets often don't support ACLs
      // Files will be public based on bucket policy instead
    });

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn,
      // Add additional signing options for CORS
      signableHeaders: new Set(['host', 'content-type', 'content-length']),
      unhoistableHeaders: new Set(['x-amz-*'])
    });

    console.log(`Generated pre-signed URL for: ${key}`);
    return presignedUrl;

  } catch (error) {
    console.error('Failed to generate pre-signed URL:', error);

    // Fallback for development/testing
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using mock pre-signed URL for development');
      return `https://mock-s3-url.com/${key}?expires=${Date.now() + (expiresIn * 1000)}`;
    }

    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }
}

/**
 * Delete S3 object using AWS SDK v3
 */
async function deleteS3Object(bucket, key) {
  try {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const client = await getS3Client();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });

    await client.send(command);
    console.log(`Successfully deleted S3 object: ${bucket}/${key}`);
    return true;

  } catch (error) {
    console.error('Failed to delete S3 object:', error);

    // Don't throw error for delete operations - just log and return false
    return false;
  }
}

/**
 * Check if S3 object exists
 */
async function checkS3ObjectExists(bucket, key) {
  try {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

    const client = await getS3Client();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    });

    await client.send(command);
    return true;

  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    console.error('Error checking S3 object existence:', error);
    return false;
  }
}

/**
 * Copy S3 object to new location
 */
async function copyS3Object(sourceBucket, sourceKey, destBucket, destKey) {
  try {
    const { CopyObjectCommand } = await import('@aws-sdk/client-s3');

    const client = await getS3Client();

    const command = new CopyObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      CopySource: `${sourceBucket}/${sourceKey}`,
      MetadataDirective: 'COPY'
    });

    await client.send(command);
    console.log(`Successfully copied S3 object: ${sourceBucket}/${sourceKey} -> ${destBucket}/${destKey}`);
    return true;

  } catch (error) {
    console.error('Failed to copy S3 object:', error);
    return false;
  }
}

// ===== TENANT-AWARE UTILITIES =====

/**
 * Extract siteId from S3 key for validation
 * @param {string} key - S3 object key
 * @returns {string|null} Extracted siteId
 */
export function extractSiteIdFromKey(key) {
  const parts = key.split('/');
  return parts.length > 0 ? parts[0] : null;
}

/**
 * Validate that user has access to specific S3 object
 * @param {string} userSiteId - User's site ID
 * @param {string} key - S3 object key
 * @returns {boolean} Access allowed
 */
export function validateAccess(userSiteId, key) {
  return key.startsWith(`${userSiteId}/`);
}

/**
 * List files for a specific tenant
 * @param {string} siteId - Tenant identifier
 * @param {Object} options - List options
 * @returns {Promise<Array>} List of files
 */
export async function listTenantFiles(siteId, options = {}) {
  const { prefix = '', maxKeys = 1000, continuationToken } = options;

  // CRITICAL: Always prefix with siteId
  const s3Prefix = `${siteId}/${prefix}`.replace(/\/+/g, '/');

  try {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const client = await getS3Client();

    const command = new ListObjectsV2Command({
      Bucket: S3_CONFIG.bucket,
      Prefix: s3Prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken
    });

    const response = await client.send(command);

    const files = (response.Contents || []).map(object => ({
      key: object.Key,
      size: object.Size,
      lastModified: object.LastModified,
      etag: object.ETag,
      url: `${S3_CONFIG.baseUrl}/${object.Key}`
    }));

    return {
      files,
      nextContinuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated || false
    };

  } catch (error) {
    console.error('Failed to list tenant files:', error);

    // Return empty result on error
    return {
      files: [],
      nextContinuationToken: null,
      isTruncated: false
    };
  }
}

export default {
  generatePresignedUrl,
  deleteFile,
  getOptimizedUrl,
  extractSiteIdFromKey,
  validateAccess,
  listTenantFiles,
  checkS3ObjectExists,
  copyS3Object
};
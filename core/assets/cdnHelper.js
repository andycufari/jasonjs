// core/assets/cdnHelper.js
// CDN URL helper utilities for uploaded assets

/**
 * Convert S3 URL to CDN URL if CDN is configured
 * @param {string} s3Url - Original S3 URL
 * @param {string} s3Key - S3 key (optional, will extract from URL if not provided)
 * @returns {string} CDN URL or original S3 URL if CDN not configured
 */
export function getCDNUrl(s3Url, s3Key = null) {
  const cdnBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;

  if (!cdnBaseUrl || !s3Url) {
    return s3Url;
  }

  // If s3Key is provided, use it directly
  if (s3Key) {
    return `${cdnBaseUrl}/${s3Key}`;
  }

  // Extract key from S3 URL
  try {
    const url = new URL(s3Url);
    const key = url.pathname.substring(1); // Remove leading slash
    return `${cdnBaseUrl}/${key}`;
  } catch (error) {
    console.warn('Could not parse S3 URL for CDN conversion:', s3Url);
    return s3Url;
  }
}

/**
 * Get optimized CDN URL with transformation parameters
 * @param {string} s3Url - Original S3 URL
 * @param {Object} options - Optimization options
 * @param {number} options.width - Target width
 * @param {number} options.height - Target height
 * @param {number} options.quality - Quality (1-100)
 * @param {string} options.format - Target format (webp, jpg, png, etc.)
 * @param {string} options.fit - Resize mode (cover, contain, fill, etc.)
 * @param {string} s3Key - S3 key (optional)
 * @returns {string} Optimized CDN URL
 */
export function getOptimizedCDNUrl(s3Url, options = {}, s3Key = null) {
  const baseUrl = getCDNUrl(s3Url, s3Key);
  const cdnBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;

  // If no CDN configured, return original URL
  if (!cdnBaseUrl) {
    return baseUrl;
  }

  // Build optimization parameters
  const params = new URLSearchParams();

  if (options.width) params.set('w', options.width.toString());
  if (options.height) params.set('h', options.height.toString());
  if (options.quality) params.set('q', options.quality.toString());
  if (options.format) params.set('f', options.format);
  if (options.fit) params.set('fit', options.fit);

  const queryString = params.toString();

  if (queryString) {
    return `${baseUrl}?${queryString}`;
  }

  return baseUrl;
}

/**
 * Process asset metadata to include CDN URLs
 * Useful for asset processing
 * @param {Object} asset - Asset object from database
 * @returns {Object} Asset object with CDN URLs added
 */
export function processAssetWithCDN(asset) {
  if (!asset || !asset.assetMetadata?.s3Url) {
    return asset;
  }

  const cdnUrl = getCDNUrl(asset.assetMetadata.s3Url, asset.assetMetadata.s3Key);

  return {
    ...asset,
    assetMetadata: {
      ...asset.assetMetadata,
      cdnUrl,
      originalS3Url: asset.assetMetadata.s3Url
    }
  };
}

/**
 * Batch process multiple assets with CDN URLs
 * @param {Array} assets - Array of asset objects
 * @returns {Array} Assets with CDN URLs added
 */
export function processAssetsWithCDN(assets) {
  if (!Array.isArray(assets)) {
    return assets;
  }

  return assets.map(processAssetWithCDN);
}

/**
 * Generate responsive image sizes for CDN
 * @param {string} s3Url - Original S3 URL
 * @param {Array} sizes - Array of widths [400, 800, 1200, 1600]
 * @param {Object} options - Base optimization options
 * @param {string} s3Key - S3 key (optional)
 * @returns {Object} Object with responsive URLs
 */
export function getResponsiveImageUrls(s3Url, sizes = [400, 800, 1200, 1600], options = {}, s3Key = null) {
  const cdnBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;

  if (!cdnBaseUrl) {
    // Return original URL for all sizes if no CDN
    const fallbackUrls = {};
    sizes.forEach(size => {
      fallbackUrls[size] = s3Url;
    });
    return {
      original: s3Url,
      responsive: fallbackUrls,
      srcSet: sizes.map(size => `${s3Url} ${size}w`).join(', ')
    };
  }

  const responsive = {};
  const srcSetParts = [];

  sizes.forEach(width => {
    const url = getOptimizedCDNUrl(s3Url, { ...options, width }, s3Key);
    responsive[width] = url;
    srcSetParts.push(`${url} ${width}w`);
  });

  return {
    original: getCDNUrl(s3Url, s3Key),
    responsive,
    srcSet: srcSetParts.join(', ')
  };
}

/**
 * Get thumbnail URL for any file type
 * @param {string} s3Url - Original S3 URL
 * @param {Object} options - Thumbnail options
 * @param {number} options.size - Thumbnail size (default: 150)
 * @param {string} options.format - Format (default: 'webp')
 * @param {number} options.quality - Quality (default: 80)
 * @param {string} s3Key - S3 key (optional)
 * @returns {string} Thumbnail URL
 */
export function getThumbnailUrl(s3Url, options = {}, s3Key = null) {
  const {
    size = 150,
    format = 'webp',
    quality = 80
  } = options;

  return getOptimizedCDNUrl(s3Url, {
    width: size,
    height: size,
    format,
    quality,
    fit: 'cover'
  }, s3Key);
}

/**
 * Check if CDN is configured
 * @returns {boolean} True if CDN is configured
 */
export function isCDNConfigured() {
  return !!process.env.NEXT_PUBLIC_ASSET_BASE_URL;
}

/**
 * Get CDN base URL
 * @returns {string|null} CDN base URL or null if not configured
 */
export function getCDNBaseUrl() {
  return process.env.NEXT_PUBLIC_ASSET_BASE_URL || null;
}

/**
 * Convert asset file object to use CDN URLs
 * For use with the new file upload system
 * @param {Object} fileObj - File object with url property
 * @returns {Object} File object with CDN URL
 */
export function convertFileObjectToCDN(fileObj) {
  if (!fileObj || !fileObj.url) {
    return fileObj;
  }

  const cdnUrl = getCDNUrl(fileObj.url, fileObj.key);

  return {
    ...fileObj,
    url: cdnUrl,
    originalUrl: fileObj.url
  };
}

/**
 * Convert array of file objects to use CDN URLs
 * @param {Array} fileObjects - Array of file objects
 * @returns {Array} Array of file objects with CDN URLs
 */
export function convertFileObjectsToCDN(fileObjects) {
  if (!Array.isArray(fileObjects)) {
    return fileObjects;
  }

  return fileObjects.map(convertFileObjectToCDN);
}

export default {
  getCDNUrl,
  getOptimizedCDNUrl,
  processAssetWithCDN,
  processAssetsWithCDN,
  getResponsiveImageUrls,
  getThumbnailUrl,
  isCDNConfigured,
  getCDNBaseUrl,
  convertFileObjectToCDN,
  convertFileObjectsToCDN
};
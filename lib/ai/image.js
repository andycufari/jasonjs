/**
 * AI Image Generation
 * Handles image generation and editing using OpenAI and Google Gemini APIs
 */

import OpenAI, { toFile } from 'openai';
import { GoogleGenAI } from '@google/genai';
import { getProviderForModel, resolveApiKey } from './providers.js';
import { trackCost, logUsage } from './security.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getCDNUrl } from '@/core/assets/cdnHelper.js';
import fs from 'fs';
// Polyfill File global for Node 18 (required by OpenAI SDK for file uploads)
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File extends Blob {
    constructor(chunks, name, opts = {}) {
      super(chunks, opts);
      this.name = name;
      this.lastModified = opts.lastModified || Date.now();
    }
  };
}

// OpenAI client cache (per API key)
const openaiClients = new Map();

// Google client cache (per API key)
const googleClients = new Map();

// S3 client cache
let s3Client = null;

// S3 Configuration
const S3_CONFIG = {
  bucket: process.env.S3_BUCKET_NAME || 'cm64-ss-public',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  baseUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL || process.env.PUBLIC_URL || `https://${process.env.S3_BUCKET_NAME || 'cm64-ss-public'}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`
};

/**
 * Resolve an image (URL or file path) to a File object for the OpenAI API
 * @param {string} source - URL (http/https) or local file path
 * @returns {Promise<File>} File object compatible with OpenAI API
 */
async function resolveImageToFile(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${source} (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const ext = contentType.split('/')[1]?.split(';')[0] || 'png';
    return await toFile(Buffer.from(buffer), `image.${ext}`, { type: contentType });
  }
  // Local file path
  if (fs.existsSync(source)) {
    return await toFile(fs.createReadStream(source), null, { type: 'image/png' });
  }
  throw new Error(`Image not found: ${source}`);
}

/**
 * Resolve an image source to base64 data + mimeType for the Google API
 * @param {string|Object} source - URL, file path, or FileUpload object
 * @returns {Promise<{data: string, mimeType: string}>} Base64 data and mime type
 */
async function resolveImageToBase64(source) {
  const url = typeof source === 'string' ? source : source?.url;
  if (!url) throw new Error('Invalid image source for Google API');

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${url} (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/png';
    return {
      data: Buffer.from(buffer).toString('base64'),
      mimeType
    };
  }

  // Local file path
  if (fs.existsSync(url)) {
    const buffer = await fs.promises.readFile(url);
    return {
      data: buffer.toString('base64'),
      mimeType: 'image/png'
    };
  }

  throw new Error(`Image not found: ${url}`);
}

/**
 * Get S3 client (lazy initialization)
 */
function getS3Client() {
  if (!s3Client) {
    if (!S3_CONFIG.accessKeyId || !S3_CONFIG.secretAccessKey) {
      throw new Error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
    }

    s3Client = new S3Client({
      region: S3_CONFIG.region,
      credentials: {
        accessKeyId: S3_CONFIG.accessKeyId,
        secretAccessKey: S3_CONFIG.secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Upload base64 image to S3
 * @param {string} base64Data - Base64 encoded image
 * @param {string} domain - Domain for tenant isolation
 * @param {string} format - Image format (png, jpeg, webp)
 * @param {string} provider - Provider that generated the image ('openai' | 'google')
 * @returns {Promise<Object>} Upload result with S3 key and CDN URL
 */
async function uploadImageToS3(base64Data, domain, format = 'png', provider = 'openai') {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate S3 key with tenant isolation
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const fileName = `ai-generated-${timestamp}_${randomId}.${format}`;
    const key = `${domain}/ai-images/${fileName}`;

    // Upload to S3
    const client = getS3Client();
    const uploadCommand = new PutObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
      Body: buffer,
      ContentType: `image/${format}`,
      Metadata: {
        'upload-source': 'ai-image-generation',
        'upload-time': new Date().toISOString(),
        'domain': domain,
        'generated-by': provider
      }
    });

    await client.send(uploadCommand);

    // Generate S3 URL
    const s3Url = `${S3_CONFIG.baseUrl}/${key}`;

    // Get CDN URL if configured
    const cdnUrl = getCDNUrl(s3Url, key);

    return {
      key,
      s3Url,
      url: cdnUrl, // Use CDN URL if available, otherwise S3 URL
      size: buffer.length
    };
  } catch (error) {
    console.error('Failed to upload image to S3:', error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Get OpenAI client for a tenant
 * 🔒 Requires a tenant-supplied API key — no host process fallback.
 * @param {string} apiKey - API key resolved from the tenant's config
 */
function getOpenAIClient(apiKey = null) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured for this site. Set it in settings/.env.');
  }
  const key = apiKey;

  if (openaiClients.has(key)) {
    return openaiClients.get(key);
  }

  const client = new OpenAI({ apiKey: key });

  openaiClients.set(key, client);
  return client;
}

/**
 * Get Google GenAI client for a tenant
 * 🔒 Requires a tenant-supplied API key — no host process fallback.
 * @param {string} apiKey - API key resolved from the tenant's config
 */
function getGoogleClient(apiKey = null) {
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not configured for this site. Set it in settings/.env.');
  }
  const key = apiKey;

  if (googleClients.has(key)) {
    return googleClients.get(key);
  }

  const client = new GoogleGenAI({ apiKey: key });
  googleClients.set(key, client);
  return client;
}

// --- Size conversion helpers for Google ---

/**
 * Convert pixel size string to Google imageSize format
 * @param {string} pixelSize - e.g., '1024x1024'
 * @returns {string} Google size: '512', '1K', '2K', '4K'
 */
function pixelSizeToGoogleSize(pixelSize) {
  if (!pixelSize) return undefined;
  const map = {
    '512x512': '512',
    '1024x1024': '1K',
    '1024x1536': '1K',
    '1536x1024': '1K',
    '2048x2048': '2K',
    '4096x4096': '4K'
  };
  return map[pixelSize] || undefined;
}

/**
 * Convert pixel size string to aspect ratio for Google
 * @param {string} pixelSize - e.g., '1024x1536'
 * @returns {string} Aspect ratio: '1:1', '3:4', '4:3', '9:16', '16:9'
 */
function pixelSizeToAspectRatio(pixelSize) {
  if (!pixelSize) return undefined;
  const map = {
    '1024x1024': '1:1',
    '1024x1536': '2:3',
    '1536x1024': '3:2',
    '1024x1792': '9:16',
    '1792x1024': '16:9'
  };
  return map[pixelSize] || undefined;
}

/**
 * Google image size cost lookup
 */
const GOOGLE_SIZE_COSTS = {
  '512': 0.03,
  '1K': 0.05,
  '2K': 0.134,
  '4K': 0.24
};

// --- Main generate/edit entry points with provider routing ---

/**
 * Generate image - routes to correct provider based on model
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options
 * @param {string} domain - Domain name (for tracking)
 * @param {string} userId - User ID (optional, for tracking)
 * @param {string} apiKey - Legacy API key param (optional, from config)
 * @param {Object} domainConfig - Full domain AI config (optional, for multi-provider key resolution)
 * @returns {Promise<Object>} Generation result
 */
export async function generateImage(prompt, options = {}, domain = null, userId = null, apiKey = null, domainConfig = null) {
  const model = options.model || 'gpt-image-1';
  const provider = getProviderForModel(model);

  // Resolve the correct API key for the provider
  const resolvedKey = domainConfig
    ? resolveApiKey(domainConfig.config, provider)
    : (apiKey || null);

  if (provider === 'google') {
    return generateImageGoogle(prompt, options, domain, userId, resolvedKey);
  }

  return generateImageOpenAI(prompt, options, domain, userId, resolvedKey);
}

/**
 * Edit image - routes to correct provider based on model
 * @param {string} prompt - Edit instruction prompt
 * @param {Array} images - Array of image files or URLs
 * @param {Object} options - Edit options
 * @param {string} domain - Domain name
 * @param {string} userId - User ID
 * @param {string} apiKey - Legacy API key param (optional)
 * @param {Object} domainConfig - Full domain AI config (optional)
 * @returns {Promise<Object>} Edit result
 */
export async function editImage(prompt, images, options = {}, domain = null, userId = null, apiKey = null, domainConfig = null) {
  const model = options.model || 'gpt-image-1';
  const provider = getProviderForModel(model);

  const resolvedKey = domainConfig
    ? resolveApiKey(domainConfig.config, provider)
    : (apiKey || null);

  if (provider === 'google') {
    return editImageGoogle(prompt, images, options, domain, userId, resolvedKey);
  }

  return editImageOpenAI(prompt, images, options, domain, userId, resolvedKey);
}

// --- OpenAI implementation (existing logic, extracted) ---

/**
 * Generate image using OpenAI API
 */
async function generateImageOpenAI(prompt, options = {}, domain = null, userId = null, apiKey = null) {
  const startTime = Date.now();
  const client = getOpenAIClient(apiKey);

  try {
    const requestParams = {
      model: options.model || 'gpt-image-1',
      prompt
    };

    if (options.size) {
      requestParams.size = options.size;
    }

    if (options.quality) {
      requestParams.quality = options.quality;
    }

    if (options.style) {
      requestParams.style = options.style;
    }

    const response = await client.images.generate(requestParams);

    const uploadStartTime = Date.now();

    const images = await Promise.all(
      response.data.map(async (img, index) => {
        try {
          const uploadResult = await uploadImageToS3(
            img.b64_json,
            domain || 'default',
            options.format || 'png',
            'openai'
          );

          return {
            url: uploadResult.url,
            s3Key: uploadResult.key,
            size: uploadResult.size,
            revisedPrompt: img.revised_prompt
          };
        } catch (uploadError) {
          console.error(`Failed to upload image ${index + 1}:`, uploadError);
          return {
            base64: img.b64_json,
            url: null,
            error: uploadError.message,
            revisedPrompt: img.revised_prompt
          };
        }
      })
    );

    const uploadDuration = Date.now() - uploadStartTime;

    const cost = calculateImageCost(options.size, options.quality, images.length, 'openai');
    trackCost(domain, options.model, cost, 0);

    const duration = Date.now() - startTime;
    logUsage({
      domain,
      userId,
      type: 'image',
      model: options.model,
      inputTokens: prompt.length,
      outputTokens: images.length,
      cost,
      duration,
      success: true
    });

    const result = {
      success: true,
      images,
      model: response.model || options.model,
      cost,
      duration,
      count: images.length,
      uploadDuration
    };

    console.log(`[OpenAI] Image generated and uploaded (${duration}ms total, ${uploadDuration}ms upload)`);

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;

    logUsage({
      domain,
      userId,
      type: 'image',
      model: options.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message
    });

    console.error('AI image generation error (OpenAI):', error);

    return {
      success: false,
      error: error.message || 'Image generation failed',
      duration
    };
  }
}

/**
 * Edit images using OpenAI API
 */
async function editImageOpenAI(prompt, images, options = {}, domain = null, userId = null, apiKey = null) {
  const startTime = Date.now();
  const client = getOpenAIClient(apiKey);

  try {
    const imageFiles = await Promise.all(
      images.map(async (img) => {
        if (typeof img === 'string') {
          return await resolveImageToFile(img);
        }
        if (img && typeof img === 'object' && img.url && typeof img.type === 'string' && img.type.startsWith('image/')) {
          return await resolveImageToFile(img.url);
        }
        if (img instanceof File || img instanceof Blob) {
          return img;
        }
        throw new Error('Invalid image format. Use a URL, file path, File object, or FileUpload object.');
      })
    );

    const requestParams = {
      model: options.model || 'gpt-image-1',
      image: imageFiles,
      prompt,
      size: options.size || '1024x1024'
    };

    if (options.format && options.format !== 'png') {
      requestParams.output_format = options.format;
    }

    if (options.compression && (options.format === 'jpeg' || options.format === 'webp')) {
      requestParams.output_compression = options.compression;
    }

    if (options.background) {
      requestParams.background = options.background;
    }

    const response = await client.images.edit(requestParams);

    const editedImages = response.data.map(img => ({
      base64: img.b64_json,
      url: img.url,
      revisedPrompt: img.revised_prompt
    }));

    const cost = calculateImageCost(options.size, options.quality, editedImages.length, 'openai');
    trackCost(domain, options.model, cost, 0);

    const duration = Date.now() - startTime;
    logUsage({
      domain,
      userId,
      type: 'image-edit',
      model: options.model,
      inputTokens: prompt.length + images.length,
      outputTokens: editedImages.length,
      cost,
      duration,
      success: true
    });

    return {
      success: true,
      images: editedImages,
      model: response.model || options.model,
      cost,
      duration,
      count: editedImages.length
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logUsage({
      domain,
      userId,
      type: 'image-edit',
      model: options.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message
    });

    console.error('AI image edit error (OpenAI):', error);

    return {
      success: false,
      error: error.message || 'Image edit failed',
      duration
    };
  }
}

// --- Google Gemini implementation ---

/**
 * Generate image using Google Gemini API
 */
async function generateImageGoogle(prompt, options = {}, domain = null, userId = null, apiKey = null) {
  const startTime = Date.now();
  const client = getGoogleClient(apiKey);
  const model = options.model || 'gemini-3.1-flash-image-preview';

  try {
    // Build image config from options
    const imageConfig = {};
    if (options.aspectRatio) {
      imageConfig.aspectRatio = options.aspectRatio;
    } else if (options.size) {
      const ar = pixelSizeToAspectRatio(options.size);
      if (ar) imageConfig.aspectRatio = ar;
    }
    if (options.imageSize) {
      imageConfig.outputImageSize = options.imageSize;
    } else if (options.size) {
      const gs = pixelSizeToGoogleSize(options.size);
      if (gs) imageConfig.outputImageSize = gs;
    }

    const requestConfig = {
      responseModalities: ['TEXT', 'IMAGE'],
    };
    if (Object.keys(imageConfig).length > 0) {
      requestConfig.imageGenerationConfig = imageConfig;
    }

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: requestConfig,
    });

    // Extract image parts from response
    const imageParts = (response.candidates?.[0]?.content?.parts || [])
      .filter(p => p.inlineData?.data);

    if (imageParts.length === 0) {
      throw new Error('Google Gemini did not return any images. The model may have refused the prompt.');
    }

    const uploadStartTime = Date.now();

    const images = await Promise.all(
      imageParts.map(async (part, index) => {
        const base64Data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        const format = mimeType.split('/')[1]?.split(';')[0] || 'png';

        try {
          const uploadResult = await uploadImageToS3(
            base64Data,
            domain || 'default',
            format,
            'google'
          );

          return {
            url: uploadResult.url,
            s3Key: uploadResult.key,
            size: uploadResult.size,
            revisedPrompt: null
          };
        } catch (uploadError) {
          console.error(`Failed to upload Google image ${index + 1}:`, uploadError);
          return {
            base64: base64Data,
            url: null,
            error: uploadError.message,
            revisedPrompt: null
          };
        }
      })
    );

    const uploadDuration = Date.now() - uploadStartTime;

    const googleSize = options.imageSize || pixelSizeToGoogleSize(options.size) || '1K';
    const cost = calculateImageCost(options.size, options.quality, images.length, 'google', googleSize);
    trackCost(domain, model, cost, 0);

    const duration = Date.now() - startTime;
    logUsage({
      domain,
      userId,
      type: 'image',
      model,
      inputTokens: prompt.length,
      outputTokens: images.length,
      cost,
      duration,
      success: true
    });

    const result = {
      success: true,
      images,
      model,
      cost,
      duration,
      count: images.length,
      uploadDuration
    };

    console.log(`[Google] Image generated and uploaded (${duration}ms total, ${uploadDuration}ms upload)`);

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;

    logUsage({
      domain,
      userId,
      type: 'image',
      model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message
    });

    console.error('AI image generation error (Google):', error);

    return {
      success: false,
      error: error.message || 'Image generation failed',
      duration
    };
  }
}

/**
 * Edit image using Google Gemini API
 * Uses multimodal input: text prompt + inline image data
 */
async function editImageGoogle(prompt, images, options = {}, domain = null, userId = null, apiKey = null) {
  const startTime = Date.now();
  const client = getGoogleClient(apiKey);
  const model = options.model || 'gemini-3.1-flash-image-preview';

  try {
    // Build multimodal content parts: text + images
    const contentParts = [{ text: prompt }];

    for (const img of images) {
      const { data, mimeType } = await resolveImageToBase64(img);
      contentParts.push({
        inlineData: { data, mimeType }
      });
    }

    const imageConfig = {};
    if (options.aspectRatio) {
      imageConfig.aspectRatio = options.aspectRatio;
    } else if (options.size) {
      const ar = pixelSizeToAspectRatio(options.size);
      if (ar) imageConfig.aspectRatio = ar;
    }
    if (options.imageSize) {
      imageConfig.outputImageSize = options.imageSize;
    } else if (options.size) {
      const gs = pixelSizeToGoogleSize(options.size);
      if (gs) imageConfig.outputImageSize = gs;
    }

    const requestConfig = {
      responseModalities: ['TEXT', 'IMAGE'],
    };
    if (Object.keys(imageConfig).length > 0) {
      requestConfig.imageGenerationConfig = imageConfig;
    }

    const response = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: contentParts }],
      config: requestConfig,
    });

    const imageParts = (response.candidates?.[0]?.content?.parts || [])
      .filter(p => p.inlineData?.data);

    if (imageParts.length === 0) {
      throw new Error('Google Gemini did not return any edited images. The model may have refused the prompt.');
    }

    const uploadStartTime = Date.now();

    const editedImages = await Promise.all(
      imageParts.map(async (part, index) => {
        const base64Data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        const format = mimeType.split('/')[1]?.split(';')[0] || 'png';

        try {
          const uploadResult = await uploadImageToS3(
            base64Data,
            domain || 'default',
            format,
            'google'
          );

          return {
            url: uploadResult.url,
            s3Key: uploadResult.key,
            size: uploadResult.size,
            revisedPrompt: null
          };
        } catch (uploadError) {
          console.error(`Failed to upload edited Google image ${index + 1}:`, uploadError);
          return {
            base64: base64Data,
            url: null,
            error: uploadError.message,
            revisedPrompt: null
          };
        }
      })
    );

    const uploadDuration = Date.now() - uploadStartTime;

    const googleSize = options.imageSize || pixelSizeToGoogleSize(options.size) || '1K';
    const cost = calculateImageCost(options.size, options.quality, editedImages.length, 'google', googleSize);
    trackCost(domain, model, cost, 0);

    const duration = Date.now() - startTime;
    logUsage({
      domain,
      userId,
      type: 'image-edit',
      model,
      inputTokens: prompt.length + images.length,
      outputTokens: editedImages.length,
      cost,
      duration,
      success: true
    });

    const result = {
      success: true,
      images: editedImages,
      model,
      cost,
      duration,
      count: editedImages.length,
      uploadDuration
    };

    console.log(`[Google] Image edited and uploaded (${duration}ms total, ${uploadDuration}ms upload)`);

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;

    logUsage({
      domain,
      userId,
      type: 'image-edit',
      model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message
    });

    console.error('AI image edit error (Google):', error);

    return {
      success: false,
      error: error.message || 'Image edit failed',
      duration
    };
  }
}

// --- Shared utilities ---

/**
 * Calculate image generation cost
 * @param {string} size - Image size (e.g., "1024x1024")
 * @param {string} quality - Quality setting
 * @param {number} count - Number of images
 * @param {string} provider - Provider ('openai' | 'google')
 * @param {string} googleSize - Google size format ('512', '1K', '2K', '4K')
 * @returns {number} Estimated cost in USD
 */
function calculateImageCost(size = '1024x1024', quality = 'auto', count = 1, provider = 'openai', googleSize = null) {
  if (provider === 'google') {
    const gSize = googleSize || pixelSizeToGoogleSize(size) || '1K';
    const baseCost = GOOGLE_SIZE_COSTS[gSize] || 0.05;
    return baseCost * count;
  }

  // OpenAI costs
  const baseCosts = {
    '1024x1024': 0.02,
    '1024x1536': 0.03,
    '1536x1024': 0.03
  };

  const qualityMultipliers = {
    'low': 0.5,
    'medium': 1.0,
    'high': 1.5,
    'auto': 1.0
  };

  const baseCost = baseCosts[size] || 0.02;
  const multiplier = qualityMultipliers[quality] || 1.0;

  return baseCost * multiplier * count;
}

/**
 * Save base64 image to file
 * @param {string} base64Data - Base64 encoded image
 * @param {string} filePath - Path to save file
 * @returns {Promise<void>}
 */
export async function saveBase64Image(base64Data, filePath) {
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.promises.writeFile(filePath, buffer);
}

/**
 * Valid Google image sizes
 */
const VALID_GOOGLE_SIZES = ['512', '1K', '2K', '4K'];

/**
 * Validate image size against limits
 * @param {string} size - Requested size
 * @param {string} maxSize - Maximum allowed size from config
 * @param {string} model - Model name (for provider-aware validation)
 * @returns {Object} { valid: boolean, reason: string|null }
 */
export function validateImageSize(size, maxSize, model = null) {
  const provider = model ? getProviderForModel(model) : 'openai';

  if (provider === 'google') {
    // Google accepts: pixel sizes (auto-converted), native sizes, or null (uses default)
    if (!size) return { valid: true, reason: null };

    // Accept Google native sizes directly
    if (VALID_GOOGLE_SIZES.includes(size)) {
      return { valid: true, reason: null };
    }

    // Accept pixel sizes that can be converted
    if (pixelSizeToGoogleSize(size) || pixelSizeToAspectRatio(size)) {
      return { valid: true, reason: null };
    }

    return {
      valid: false,
      reason: `Invalid size for Google model. Use pixel sizes (1024x1024, etc.) or Google sizes (${VALID_GOOGLE_SIZES.join(', ')})`
    };
  }

  // OpenAI validation (unchanged)
  const validSizes = ['1024x1024', '1024x1536', '1536x1024'];

  if (!validSizes.includes(size)) {
    return {
      valid: false,
      reason: `Invalid size. Allowed: ${validSizes.join(', ')}`
    };
  }

  if (maxSize && maxSize !== 'auto') {
    const [maxWidth, maxHeight] = maxSize.split('x').map(Number);
    const [width, height] = size.split('x').map(Number);

    if (width > maxWidth || height > maxHeight) {
      return {
        valid: false,
        reason: `Size exceeds maximum allowed: ${maxSize}`
      };
    }
  }

  return { valid: true, reason: null };
}

/**
 * Convert FileUpload component output to image inputs for editImage()
 * Accepts FileUpload objects ({url, type, name}), plain URLs, or arrays of either.
 * @param {Array|Object|string} uploadedFiles - Files from FileUpload component, URLs, or mixed
 * @returns {Array} Array of image sources (FileUpload objects or URL strings)
 */
export function convertUploadedFilesToImages(uploadedFiles) {
  const files = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

  return files
    .filter(file => {
      if (!file) return false;
      // String URL
      if (typeof file === 'string') return true;
      // FileUpload object with image MIME type
      return file.type && file.type.startsWith('image/') && file.url;
    });
}

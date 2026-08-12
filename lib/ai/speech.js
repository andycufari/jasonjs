/**
 * AI Speech Generation (Text-to-Speech)
 * Handles text-to-speech generation using OpenAI API
 */

import OpenAI from 'openai';
import { trackCost, logUsage } from './security.js';
import fs from 'fs';
import path from 'path';

// OpenAI client cache (per API key)
const openaiClients = new Map();

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
 * Generate speech from text using OpenAI API
 * @param {string} text - Text to convert to speech
 * @param {Object} options - Speech generation options
 * @param {string} domain - Domain name (for tracking)
 * @param {string} userId - User ID (optional, for tracking)
 * @param {string} apiKey - API key to use (optional, from config)
 * @returns {Promise<Object>} Generation result
 */
export async function generateSpeech(text, options = {}, domain = null, userId = null, apiKey = null) {
  const startTime = Date.now();
  const client = getOpenAIClient(apiKey);

  try {
    // Validate text length
    const maxLength = options.maxLength || 4096;
    if (text.length > maxLength) {
      throw new Error(`Text too long: ${text.length} characters (max: ${maxLength})`);
    }

    const requestParams = {
      model: options.model || 'gpt-4o-mini-tts',
      voice: options.voice || 'coral',
      input: text,
      response_format: options.format || 'mp3'
    };

    // Add optional parameters
    if (options.speed) {
      requestParams.speed = options.speed;
    }

    if (options.instructions) {
      requestParams.instructions = options.instructions;
    }

    // Make API call
    const response = await client.audio.speech.create(requestParams);

    // Convert response to buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Calculate cost (based on character count)
    const cost = calculateSpeechCost(text.length, options.model);
    trackCost(domain, options.model, text.length, 0);

    // Track usage
    const duration = Date.now() - startTime;
    logUsage({
      domain,
      userId,
      type: 'speech',
      model: options.model,
      inputTokens: text.length, // Characters for speech
      outputTokens: buffer.length,
      cost,
      duration,
      success: true
    });

    return {
      success: true,
      audio: buffer,
      base64: buffer.toString('base64'),
      format: options.format || 'mp3',
      model: options.model || 'gpt-4o-mini-tts',
      cost,
      duration,
      size: buffer.length
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error
    logUsage({
      domain,
      userId,
      type: 'speech',
      model: options.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message
    });

    console.error('AI speech generation error:', error);

    return {
      success: false,
      error: error.message || 'Speech generation failed',
      duration
    };
  }
}

/**
 * Save audio buffer to file
 * @param {Buffer} buffer - Audio buffer
 * @param {string} filePath - Path to save file
 * @returns {Promise<void>}
 */
export async function saveAudioFile(buffer, filePath) {
  await fs.promises.writeFile(filePath, buffer);
}

/**
 * Generate speech and save to file
 * @param {string} text - Text to convert
 * @param {string} filePath - Output file path
 * @param {Object} options - Speech options
 * @param {string} domain - Domain name
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Generation result with file path
 */
export async function generateSpeechFile(text, filePath, options = {}, domain = null, userId = null) {
  const result = await generateSpeech(text, options, domain, userId);

  if (result.success) {
    await saveAudioFile(result.audio, filePath);
    result.filePath = filePath;
  }

  return result;
}

/**
 * Calculate speech generation cost
 * @param {number} characterCount - Number of characters
 * @param {string} model - Model name
 * @returns {number} Estimated cost in USD
 */
function calculateSpeechCost(characterCount, model = 'gpt-4o-mini-tts') {
  // Approximate pricing: $0.00015 per 1000 characters for gpt-4o-mini-tts
  const costPer1000Chars = 0.00015;

  return (characterCount / 1000) * costPer1000Chars;
}

/**
 * Validate text length against limits
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {Object} { valid: boolean, length: number, reason: string|null }
 */
export function validateTextLength(text, maxLength = 4096) {
  const length = text.length;

  if (length > maxLength) {
    return {
      valid: false,
      length,
      reason: `Text too long: ${length} characters (max: ${maxLength})`
    };
  }

  if (length === 0) {
    return {
      valid: false,
      length,
      reason: 'Text cannot be empty'
    };
  }

  return {
    valid: true,
    length,
    reason: null
  };
}

/**
 * Get available voices
 * @returns {Array} List of available voice names
 */
export function getAvailableVoices() {
  return [
    'coral',    // Warm and friendly
    'alloy',    // Neutral and balanced
    'echo',     // Deep and resonant
    'fable',    // Expressive and dynamic
    'onyx',     // Deep and authoritative
    'nova',     // Energetic and upbeat
    'shimmer'   // Soft and calm
  ];
}

/**
 * Get available formats
 * @returns {Array} List of supported audio formats
 */
export function getAvailableFormats() {
  return ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
}

/**
 * Validate voice name
 * @param {string} voice - Voice name to validate
 * @returns {boolean} True if valid
 */
export function validateVoice(voice) {
  return getAvailableVoices().includes(voice);
}

/**
 * Validate audio format
 * @param {string} format - Format to validate
 * @returns {boolean} True if valid
 */
export function validateFormat(format) {
  return getAvailableFormats().includes(format);
}
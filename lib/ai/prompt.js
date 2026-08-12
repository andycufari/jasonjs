/**
 * AI Text Generation (Prompt Handler)
 * Handles text generation using OpenAI and Anthropic APIs
 */

import OpenAI from 'openai';
import { buildMessages, buildMultiModalContent, replaceVariables } from './templates.js';
import { estimateCost, trackCost, logUsage } from './security.js';

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

  // Return cached client for this API key
  if (openaiClients.has(key)) {
    return openaiClients.get(key);
  }

  // Create new client
  const client = new OpenAI({
    apiKey: key,
    organization: process.env.OPENAI_ORG_ID
  });

  openaiClients.set(key, client);
  return client;
}

/**
 * Generate text using Anthropic API (Messages API)
 * @param {string} prompt - Prompt text
 * @param {Object} options - Generation options
 * @param {string} domain - Domain name (for tracking)
 * @param {string} userId - User ID (optional, for tracking)
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object>} Generation result
 */
async function generateTextAnthropic(prompt, options = {}, domain = null, userId = null, apiKey = null) {
  const startTime = Date.now();

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured for this site. Set it in settings/.env.');
  }
  const key = apiKey;

  try {
    // Build messages for Anthropic format
    const messages = [];
    let systemPrompt = '';

    if (options.systemPrompt) {
      systemPrompt = options.systemPrompt;
    }

    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: options.model || 'claude-haiku-4-5-20251001',
      max_tokens: options.maxTokens || 4096,
      messages,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    // Anthropic does not allow both temperature and top_p simultaneously
    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    } else if (options.topP !== undefined) {
      requestBody.top_p = options.topP;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();

    const duration = Date.now() - startTime;
    const inputTokens = result.usage?.input_tokens || 0;
    const outputTokens = result.usage?.output_tokens || 0;
    const cost = trackCost(domain, options.model, inputTokens, outputTokens);

    logUsage({
      domain,
      userId,
      type: 'prompt',
      model: options.model,
      inputTokens,
      outputTokens,
      cost,
      duration,
      success: true,
    });

    return {
      success: true,
      text: result.content?.[0]?.text || '',
      model: result.model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      cost,
      duration,
      finishReason: result.stop_reason || 'end_turn',
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logUsage({
      domain,
      userId,
      type: 'prompt',
      model: options.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message,
    });

    console.error('Anthropic text generation error:', error);

    return {
      success: false,
      error: error.message || 'Text generation failed',
      duration,
    };
  }
}

/**
 * Generate text using the appropriate provider
 * @param {string} prompt - Prompt text
 * @param {Object} options - Generation options (includes `provider` field)
 * @param {string} domain - Domain name (for tracking)
 * @param {string} userId - User ID (optional, for tracking)
 * @param {string} apiKey - API key to use (optional, from config)
 * @returns {Promise<Object>} Generation result
 */
export async function generateText(prompt, options = {}, domain = null, userId = null, apiKey = null) {
  // Route to Anthropic if provider is explicitly set
  if (options.provider === 'anthropic') {
    return generateTextAnthropic(prompt, options, domain, userId, apiKey);
  }

  const startTime = Date.now();
  const client = getOpenAIClient(apiKey);

  try {
    // Build input based on whether we have images/files
    let input;

    if (options.images && options.images.length > 0) {
      // Multi-modal input (text + images)
      const content = buildMultiModalContent(prompt, options.images);
      input = [{
        role: 'user',
        content
      }];
    } else {
      // Text-only input
      input = buildMessages(prompt, {
        systemPrompt: options.systemPrompt
      });
    }

    // Prepare request parameters
    const requestParams = {
      model: options.model || 'gpt-5-mini',
      input
    };

    // Add optional parameters
    if (options.maxTokens) {
      requestParams.max_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
      requestParams.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
      requestParams.top_p = options.topP;
    }

    if (options.frequencyPenalty !== undefined) {
      requestParams.frequency_penalty = options.frequencyPenalty;
    }

    if (options.presencePenalty !== undefined) {
      requestParams.presence_penalty = options.presencePenalty;
    }

    if (options.reasoning) {
      requestParams.reasoning = options.reasoning;
    }

    // Handle streaming
    if (options.stream) {
      return streamText(requestParams, domain, userId);
    }

    // Make API call
    const response = await client.responses.create(requestParams);

    // Track usage
    const duration = Date.now() - startTime;
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = trackCost(domain, options.model, inputTokens, outputTokens);

    // Log usage
    logUsage({
      domain,
      userId,
      type: 'prompt',
      model: options.model,
      inputTokens,
      outputTokens,
      cost,
      duration,
      success: true
    });

    return {
      success: true,
      text: response.output_text || response.output?.[0]?.text || '',
      model: response.model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      },
      cost,
      duration,
      finishReason: response.finish_reason || 'stop'
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error
    logUsage({
      domain,
      userId,
      type: 'prompt',
      model: options.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message
    });

    console.error('AI text generation error:', error);

    return {
      success: false,
      error: error.message || 'Text generation failed',
      duration
    };
  }
}

/**
 * Stream text generation (for real-time responses)
 * @param {Object} requestParams - OpenAI request parameters
 * @param {string} domain - Domain name
 * @param {string} userId - User ID
 * @returns {AsyncGenerator} Stream of text chunks
 */
async function* streamText(requestParams, domain, userId) {
  const client = getOpenAIClient();
  const startTime = Date.now();

  try {
    const stream = await client.responses.create({
      ...requestParams,
      stream: true
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.output?.[0]?.text || '';

      if (delta) {
        outputTokens += estimateTokens(delta);

        yield {
          success: true,
          text: delta,
          done: false
        };
      }

      // Track usage from chunk
      if (chunk.usage) {
        inputTokens = chunk.usage.input_tokens || inputTokens;
        outputTokens = chunk.usage.output_tokens || outputTokens;
      }
    }

    // Final chunk
    const duration = Date.now() - startTime;
    const cost = trackCost(domain, requestParams.model, inputTokens, outputTokens);

    logUsage({
      domain,
      userId,
      type: 'prompt',
      model: requestParams.model,
      inputTokens,
      outputTokens,
      cost,
      duration,
      success: true
    });

    yield {
      success: true,
      text: '',
      done: true,
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      cost,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logUsage({
      domain,
      userId,
      type: 'prompt',
      model: requestParams.model,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      success: false,
      error: error.message
    });

    yield {
      success: false,
      error: error.message,
      done: true
    };
  }
}

/**
 * Estimate token count (rough approximation)
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens more accurately (for cost estimation before calling API)
 * @param {string} text - Text to count
 * @returns {number} Estimated token count
 */
export function countTokens(text) {
  if (!text) return 0;

  // More accurate estimation:
  // - Split by whitespace
  // - Account for punctuation
  // - Average 3-4 chars per token
  const words = text.split(/\s+/).length;
  const chars = text.length;

  // Use word count + character count hybrid
  return Math.ceil((words + chars / 4) / 2);
}

/**
 * Validate token limits before making API call
 * @param {string} prompt - Prompt text
 * @param {number} maxTokens - Maximum allowed tokens
 * @returns {Object} { valid: boolean, estimatedTokens: number, reason: string|null }
 */
export function validateTokenLimit(prompt, maxTokens) {
  const estimated = countTokens(prompt);

  if (estimated > maxTokens) {
    return {
      valid: false,
      estimatedTokens: estimated,
      reason: `Prompt too long: ${estimated} tokens (max: ${maxTokens})`
    };
  }

  return {
    valid: true,
    estimatedTokens: estimated,
    reason: null
  };
}
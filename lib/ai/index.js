/**
 * JasonJS AI Library
 * Main entry point for AI functionality
 *
 * IMPORTANT: This file should ONLY be imported server-side
 * Client-side code should use core/app/ai.js which calls API routes
 *
 * Uses lazy imports to ensure heavy dependencies (OpenAI, MongoDB)
 * are only loaded when actually needed
 */

// These are lightweight utility functions - safe to import
import {
  isTemplateReference,
  extractTemplateName,
  processPrompt,
  replaceVariables,
  validateTemplateVariables,
  parsePromptOptions,
  parseImageOptions,
  parseSpeechOptions
} from './templates.js';

// Heavy modules are imported dynamically inside methods
// to prevent bundling in client code

/**
 * Main AI client for JasonJS Framework
 */
class JasonAI {
  constructor(domain = null, userId = null, context = 'client') {
    this.domain = domain;
    this.userId = userId;
    this.context = context;
    this.config = null;
  }

  /**
   * Load configuration for the domain
   */
  async loadConfig() {
    if (!this.config) {
      const { loadAIConfig } = await import('./config.js');
      this.config = await loadAIConfig(this.domain);
    }
    return this.config;
  }

  /**
   * Check if AI is enabled for this domain
   */
  async isEnabled() {
    const { isAIEnabled } = await import('./config.js');
    return await isAIEnabled(this.domain);
  }

  /**
   * Generate text from prompt
   * @param {string} promptOrTemplate - Prompt text or template reference
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async prompt(promptOrTemplate, options = {}) {
    // Load config
    await this.loadConfig();

    // Check if AI is enabled
    if (!this.config.config.enabled) {
      throw new Error('AI is not enabled. Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY) in settings/.env, or create settings/ai.json.');
    }

    // Check if text feature is enabled
    if (!this.config.config.features.text) {
      throw new Error('Text generation is not enabled. Set "features.text": true in settings/ai.json.');
    }

    // Dynamic imports for heavy modules
    const { checkRateLimit, validatePrompt, checkCostLimit } = await import('./security.js');
    const { getPromptTemplate } = await import('./config.js');
    const { generateText, validateTokenLimit } = await import('./prompt.js');

    // Check rate limits
    const rateLimit = await checkRateLimit(
      this.domain,
      this.userId,
      this.config.config.limits
    );

    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`
      );
    }

    // Process prompt (template or direct)
    let finalPrompt = promptOrTemplate;
    let template = null;

    if (isTemplateReference(promptOrTemplate)) {
      const templateName = extractTemplateName(promptOrTemplate);
      template = await getPromptTemplate(this.domain, templateName);

      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }

      // Validate template variables
      const validation = validateTemplateVariables(template.template, options.variables);
      if (!validation.valid) {
        throw new Error(`Missing template variables: ${validation.missing.join(', ')}`);
      }

      finalPrompt = processPrompt(promptOrTemplate, template, options.variables);
    }

    // Validate prompt security
    const security = validatePrompt(promptOrTemplate, this.config, this.context);
    if (!security.valid) {
      throw new Error(security.reason);
    }

    // Parse and validate options
    const parsedOptions = parsePromptOptions(options, template, this.config);

    // Validate input token limits (maxInputTokens caps prompt size, maxTokens caps response size)
    const inputTokenLimit = this.config.config.limits?.maxInputTokens || 4000;
    const tokenValidation = validateTokenLimit(finalPrompt, inputTokenLimit);
    if (!tokenValidation.valid) {
      throw new Error(tokenValidation.reason);
    }

    // Check cost limits
    const costCheck = checkCostLimit(
      this.domain,
      process.env.AI_MAX_COST_PER_DAY || 100
    );

    if (!costCheck.allowed) {
      throw new Error(
        `Daily cost limit reached: $${costCheck.current.toFixed(2)} / $${costCheck.limit.toFixed(2)}`
      );
    }

    // Resolve API key using provider-aware system
    const { getProviderForModel, resolveApiKey } = await import('./providers.js');
    const provider = getProviderForModel(parsedOptions.model);
    const apiKey = resolveApiKey(this.config.config, provider) || this.config.config.api_key || null;

    // Generate text (pass provider for routing to correct API)
    return await generateText(finalPrompt, { ...parsedOptions, provider }, this.domain, this.userId, apiKey);
  }

  /**
   * Generate image from prompt
   * @param {string} promptOrTemplate - Image prompt or template reference
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async image(promptOrTemplate, options = {}) {
    // Load config
    await this.loadConfig();

    // Check if AI is enabled
    if (!this.config.config.enabled) {
      throw new Error('AI is not enabled. Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY) in settings/.env, or create settings/ai.json.');
    }

    // Check if image feature is enabled
    if (!this.config.config.features.image) {
      throw new Error('Image generation is not enabled. Set "features.image": true in settings/ai.json.');
    }

    // Dynamic imports for heavy modules
    const { checkRateLimit, validatePrompt } = await import('./security.js');
    const { getPromptTemplate } = await import('./config.js');
    const { generateImage, editImage, validateImageSize, convertUploadedFilesToImages } = await import('./image.js');

    // Check rate limits
    const rateLimit = await checkRateLimit(
      this.domain,
      this.userId,
      this.config.config.limits
    );

    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`
      );
    }

    // Process prompt
    let finalPrompt = promptOrTemplate;
    let template = null;

    if (isTemplateReference(promptOrTemplate)) {
      const templateName = extractTemplateName(promptOrTemplate);
      template = await getPromptTemplate(this.domain, templateName);

      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }

      finalPrompt = processPrompt(promptOrTemplate, template, options.variables);
    }

    // Validate prompt security
    const security = validatePrompt(promptOrTemplate, this.config, this.context);
    if (!security.valid) {
      throw new Error(security.reason);
    }

    // Parse options
    const parsedOptions = parseImageOptions(options, template, this.config);

    // Validate image size (provider-aware)
    const sizeValidation = validateImageSize(
      parsedOptions.size,
      this.config.config.limits.maxImageSize,
      parsedOptions.model
    );

    if (!sizeValidation.valid) {
      throw new Error(sizeValidation.reason);
    }

    // Check if editing mode
    if (parsedOptions.editMode && parsedOptions.images.length > 0) {
      // Convert uploaded files to image format if needed
      const images = convertUploadedFilesToImages(parsedOptions.images);
      return await editImage(finalPrompt, images, parsedOptions, this.domain, this.userId, null, this.config);
    }

    // Generate new image
    return await generateImage(finalPrompt, parsedOptions, this.domain, this.userId, null, this.config);
  }

  /**
   * Generate speech from text
   * @param {string} textOrTemplate - Text or template reference
   * @param {Object} options - Speech options
   * @returns {Promise<Object>} Generation result
   */
  async speech(textOrTemplate, options = {}) {
    // Load config
    await this.loadConfig();

    // Check if AI is enabled
    if (!this.config.config.enabled) {
      throw new Error('AI is not enabled. Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY) in settings/.env, or create settings/ai.json.');
    }

    // Check if speech feature is enabled
    if (!this.config.config.features.speech) {
      throw new Error('Speech generation is not enabled. Set "features.speech": true in settings/ai.json.');
    }

    // Dynamic imports for heavy modules
    const { checkRateLimit } = await import('./security.js');
    const { getPromptTemplate } = await import('./config.js');
    const { generateSpeech, validateTextLength } = await import('./speech.js');

    // Check rate limits
    const rateLimit = await checkRateLimit(
      this.domain,
      this.userId,
      this.config.config.limits
    );

    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`
      );
    }

    // Process text
    let finalText = textOrTemplate;
    let template = null;

    if (isTemplateReference(textOrTemplate)) {
      const templateName = extractTemplateName(textOrTemplate);
      template = await getPromptTemplate(this.domain, templateName);

      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }

      finalText = processPrompt(textOrTemplate, template, options.variables);
    }

    // Parse options
    const parsedOptions = parseSpeechOptions(options, template, this.config);

    // Validate text length
    const lengthValidation = validateTextLength(
      finalText,
      this.config.config.limits.maxSpeechLength
    );

    if (!lengthValidation.valid) {
      throw new Error(lengthValidation.reason);
    }

    // Get API key from config (if configured)
    const apiKey = this.config.config.api_key || null;

    // Generate speech
    return await generateSpeech(finalText, parsedOptions, this.domain, this.userId, apiKey);
  }

  /**
   * Get available voices for speech generation
   */
  async getVoices() {
    const { getAvailableVoices } = await import('./speech.js');
    return getAvailableVoices();
  }

  /**
   * Get available audio formats
   */
  async getFormats() {
    const { getAvailableFormats } = await import('./speech.js');
    return getAvailableFormats();
  }

  /**
   * Estimate cost for a prompt
   * @param {string} prompt - Prompt to estimate
   * @param {Object} options - Options
   * @returns {number} Estimated cost in USD
   */
  async estimateCost(prompt, options = {}) {
    const { countTokens } = await import('./prompt.js');
    const tokens = countTokens(prompt);
    const model = options.model || 'gpt-5-mini';

    // Rough estimate (actual costs calculated during generation)
    return tokens * 0.0000015; // Average cost per token
  }

  /**
   * Chat with an AI agent (server-side only)
   *
   * Agents are defined in ai.json config under the "agents" key.
   * They support tools (server functions) and maintain conversation context.
   *
   * @param {string} agentName - Agent name from ai.json config
   * @param {Array} chatHistory - Standard chat history [{role: 'user'|'assistant', content: string}, ...]
   * @returns {Promise<Object>} Response with text, usage, cost, toolEvents
   *
   * @example
   * // In a server function:
   * const response = await app.ai.chat('customerSupport', [
   *   { role: 'user', content: 'What is the status of my order #12345?' }
   * ]);
   *
   * console.log(response.text);        // Agent's response
   * console.log(response.usage);       // { inputTokens, outputTokens, totalTokens }
   * console.log(response.cost);        // Total cost in USD
   * console.log(response.toolEvents);  // Array of tool calls made
   */
  async chat(agentName, chatHistory = []) {
    // Validate server-side context
    if (this.context === 'client') {
      throw new Error('Agent chat is only available server-side. Use this in server functions only.');
    }

    // Validate chat history format
    if (!Array.isArray(chatHistory)) {
      throw new Error('chatHistory must be an array of message objects');
    }

    // Validate each message in history
    for (const msg of chatHistory) {
      if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
        throw new Error('Each message must have a role of "user", "assistant", or "system"');
      }
      if (typeof msg.content !== 'string') {
        throw new Error('Each message must have a content string');
      }
    }

    // Load config and get agent
    await this.loadConfig();

    // Check if AI is enabled
    if (!this.config.config.enabled) {
      throw new Error('AI is not enabled. Set an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY) in settings/.env, or create settings/ai.json.');
    }

    // Get agent configuration
    const agentConfig = this.config.agents?.[agentName];

    if (!agentConfig) {
      throw new Error(`Agent '${agentName}' not found in ai.json. Available agents: ${Object.keys(this.config.agents || {}).join(', ') || 'none'}`);
    }

    // Dynamic imports for heavy modules
    const { checkRateLimit, checkCostLimit } = await import('./security.js');

    // Check rate limits
    const rateLimit = await checkRateLimit(
      this.domain,
      this.userId,
      this.config.config.limits
    );

    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`
      );
    }

    // Check cost limits
    const costCheck = checkCostLimit(
      this.domain,
      process.env.AI_MAX_COST_PER_DAY || 100
    );

    if (!costCheck.allowed) {
      throw new Error(
        `Daily cost limit reached: $${costCheck.current.toFixed(2)} / $${costCheck.limit.toFixed(2)}`
      );
    }

    // Resolve API key using provider-aware system
    const { getProviderForModel, resolveApiKey } = await import('./providers.js');
    const agentModel = agentConfig.model || 'gpt-4o-mini';
    const agentProvider = getProviderForModel(agentModel);
    const agentApiKey = resolveApiKey(this.config.config, agentProvider) || this.config.config.api_key || null;

    // Execute agent
    const { executeAgentChat } = await import('./agent.js');

    return await executeAgentChat(agentConfig, chatHistory, {
      domain: this.domain,
      userId: this.userId,
      user: this.user || null,
      apiKey: agentApiKey
    });
  }
}

/**
 * Create AI client instance
 * @param {string} domain - Domain name
 * @param {string} userId - User ID (optional)
 * @param {string} context - Execution context
 * @returns {JasonAI} AI client instance
 */
export function createAIClient(domain, userId = null, context = 'client') {
  return new JasonAI(domain, userId, context);
}

// Export utilities (use dynamic imports to avoid bundling)
// These should only be used server-side
export async function loadAIConfig(domain) {
  const { loadAIConfig: _loadAIConfig } = await import('./config.js');
  return _loadAIConfig(domain);
}

export async function isAIEnabled(domain) {
  const { isAIEnabled: _isAIEnabled } = await import('./config.js');
  return _isAIEnabled(domain);
}

export async function isFeatureEnabled(domain, feature) {
  const { isFeatureEnabled: _isFeatureEnabled } = await import('./config.js');
  return _isFeatureEnabled(domain, feature);
}

export async function clearConfigCache(domain) {
  const { clearConfigCache: _clearConfigCache } = await import('./config.js');
  return _clearConfigCache(domain);
}

export async function generateText(prompt, options, domain, userId) {
  const { generateText: _generateText } = await import('./prompt.js');
  return _generateText(prompt, options, domain, userId);
}

export async function generateImage(prompt, options, domain, userId) {
  const { generateImage: _generateImage } = await import('./image.js');
  return _generateImage(prompt, options, domain, userId);
}

export async function generateSpeech(text, options, domain, userId) {
  const { generateSpeech: _generateSpeech } = await import('./speech.js');
  return _generateSpeech(text, options, domain, userId);
}

export async function checkRateLimit(domain, userId, limits) {
  const { checkRateLimit: _checkRateLimit } = await import('./security.js');
  return _checkRateLimit(domain, userId, limits);
}

export async function validateOrigin(request, allowedOrigins) {
  const { validateOrigin: _validateOrigin } = await import('./security.js');
  return _validateOrigin(request, allowedOrigins);
}

// Lightweight template utilities - safe to export directly
export { isTemplateReference, replaceVariables } from './templates.js';

export default JasonAI;
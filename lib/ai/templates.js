/**
 * AI Prompt Template System
 * Handles template variable replacement and prompt processing
 */

/**
 * Replace template variables in a string
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {Object} variables - Object with variable values
 * @returns {string} String with variables replaced
 */
export function replaceVariables(template, variables = {}) {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    if (variables.hasOwnProperty(varName)) {
      const value = variables[varName];

      // Convert to string if not already
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    }

    // Leave placeholder if variable not found
    return match;
  });
}

/**
 * Check if a string is a template reference (starts with {{)
 * @param {string} str - String to check
 * @returns {boolean} True if template reference
 */
export function isTemplateReference(str) {
  if (typeof str !== 'string') return false;
  return /^\{\{[\w\s]+\}\}$/.test(str.trim());
}

/**
 * Extract template name from reference
 * @param {string} reference - Template reference like "{{promptName}}"
 * @returns {string} Template name
 */
export function extractTemplateName(reference) {
  if (!isTemplateReference(reference)) {
    return reference;
  }

  return reference.replace(/^\{\{|\}\}$/g, '').trim();
}

/**
 * Process a prompt with template and variables
 * @param {string} promptOrTemplate - Either a direct prompt or template reference
 * @param {Object} template - Template configuration from ai-prompts.json
 * @param {Object} variables - Variables to replace in template
 * @returns {string} Processed prompt
 */
export function processPrompt(promptOrTemplate, template, variables = {}) {
  let finalPrompt;

  // If it's a template reference and we have a template config
  if (isTemplateReference(promptOrTemplate) && template) {
    finalPrompt = template.template || promptOrTemplate;
  } else {
    finalPrompt = promptOrTemplate;
  }

  // Replace variables
  return replaceVariables(finalPrompt, variables);
}

/**
 * Build OpenAI messages array from input
 * @param {string|Array} input - Prompt string or messages array
 * @param {Object} options - Additional options (systemPrompt, etc.)
 * @returns {Array} OpenAI messages array
 */
export function buildMessages(input, options = {}) {
  const messages = [];

  // Add system/developer message if provided
  if (options.systemPrompt) {
    messages.push({
      role: 'developer',
      content: options.systemPrompt
    });
  }

  // Handle input
  if (typeof input === 'string') {
    // Simple string input
    messages.push({
      role: 'user',
      content: input
    });
  } else if (Array.isArray(input)) {
    // Already formatted messages
    messages.push(...input);
  } else if (input && typeof input === 'object') {
    // Single message object
    messages.push(input);
  }

  return messages;
}

/**
 * Build content array for multi-modal input (text + images)
 * @param {string} text - Text content
 * @param {Array} images - Array of image URLs or objects
 * @returns {Array} Content array for OpenAI
 */
export function buildMultiModalContent(text, images = []) {
  const content = [];

  // Add text
  if (text) {
    content.push({
      type: 'input_text',
      text
    });
  }

  // Add images
  if (Array.isArray(images) && images.length > 0) {
    images.forEach(image => {
      if (typeof image === 'string') {
        // Image URL
        content.push({
          type: 'input_image',
          image_url: image
        });
      } else if (image && image.url) {
        // Image object with URL
        content.push({
          type: 'input_image',
          image_url: image.url
        });
      }
    });
  }

  return content;
}

/**
 * Validate template variables are provided
 * @param {string} template - Template string
 * @param {Object} variables - Provided variables
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validateTemplateVariables(template, variables = {}) {
  if (!template || typeof template !== 'string') {
    return { valid: true, missing: [] };
  }

  const requiredVars = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    if (!requiredVars.includes(varName)) {
      requiredVars.push(varName);
    }
  }

  const missing = requiredVars.filter(varName => !variables.hasOwnProperty(varName));

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Parse and validate prompt options
 * @param {Object} options - User-provided options
 * @param {Object} template - Template configuration
 * @param {Object} domainConfig - Domain AI configuration
 * @returns {Object} Validated options
 */
export function parsePromptOptions(options = {}, template = null, domainConfig = {}) {
  const parsed = {
    model: options.model || template?.model || domainConfig.config?.models?.text?.[0] || 'gpt-5-mini',
    maxTokens: options.maxTokens || template?.maxTokens || 500,
    temperature: options.temperature ?? 0.7,
    topP: options.topP !== undefined ? options.topP : undefined,
    frequencyPenalty: options.frequencyPenalty ?? 0,
    presencePenalty: options.presencePenalty ?? 0,
    reasoning: options.reasoning || template?.reasoning,
    // Accept both `systemPrompt` (framework convention) and `system`
    // (Anthropic/OpenAI API convention) — dropping one silently was a footgun.
    systemPrompt: options.systemPrompt || options.system || template?.systemPrompt || template?.system,
    stream: options.stream ?? false,
    variables: options.variables || {},
    files: options.files || [],
    images: options.images || []
  };

  // Validate model is allowed
  const allowedModels = domainConfig.config?.models?.text || ['gpt-5-mini'];
  if (!allowedModels.includes(parsed.model)) {
    parsed.model = allowedModels[0]; // Use first allowed model
  }

  return parsed;
}

/**
 * Parse image generation options
 * @param {Object} options - User-provided options
 * @param {Object} template - Template configuration
 * @param {Object} domainConfig - Domain AI configuration
 * @returns {Object} Validated options
 */
export function parseImageOptions(options = {}, template = null, domainConfig = {}) {
  const parsed = {
    model: options.model || template?.model || domainConfig.config?.models?.image?.[0] || 'gpt-image-1',
    size: options.size || template?.size || '1024x1024',
    quality: options.quality || template?.quality || 'auto',
    format: options.format || template?.format || 'png',
    background: options.background || template?.background || 'opaque',
    compression: options.compression || template?.compression,
    variables: options.variables || {},
    editMode: options.editMode || false,
    images: options.images || [], // For edit mode
    // Google-specific options
    aspectRatio: options.aspectRatio || null, // e.g., '16:9', '3:4'
    imageSize: options.imageSize || null // Google size: '512', '1K', '2K', '4K'
  };

  return parsed;
}

/**
 * Parse speech generation options
 * @param {Object} options - User-provided options
 * @param {Object} template - Template configuration
 * @param {Object} domainConfig - Domain AI configuration
 * @returns {Object} Validated options
 */
export function parseSpeechOptions(options = {}, template = null, domainConfig = {}) {
  const parsed = {
    model: options.model || template?.model || domainConfig.config?.models?.speech?.[0] || 'gpt-4o-mini-tts',
    voice: options.voice || template?.voice || 'coral',
    instructions: options.instructions || template?.instructions,
    format: options.format || 'mp3',
    speed: options.speed ?? 1.0,
    variables: options.variables || {}
  };

  return parsed;
}
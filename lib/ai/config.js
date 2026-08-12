/**
 * AI Configuration Loader
 * Loads and validates AI prompts configuration from settings
 * Uses fileSystem abstraction for both local and database modes
 *
 * IMPORTANT: Uses dynamic imports to avoid bundling server-side
 * dependencies (MongoDB, fs) in client bundle
 */

/**
 * Default AI configuration
 */
const DEFAULT_CONFIG = {
  config: {
    enabled: false,
    api_keys: {},
    models: {
      text: ['gpt-5-mini', 'gpt-5-nano', 'gpt-5'],
      image: ['gpt-image-1'],
      speech: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd']
    },
    features: {
      text: true,
      image: false,
      speech: false,
      allowFiles: false
    },
    limits: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 500,
      maxInputTokens: 4000,
      maxImageSize: '1536x1536',
      maxSpeechLength: 4096
    },
    security: {
      allowedContexts: ['functions', 'system-components'],
      allowArbitraryPrompts: false,
      requireAuth: false,
      allowedOrigins: ['same-origin']
    }
  },
  prompts: {},
  agents: {}
};

// In-memory cache for configurations
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Process environment variables in config
 * Replaces [[env.VARIABLE_NAME]] with actual values
 * @param {Object} config - Configuration object
 * @param {string} domain - Domain name
 * @param {Function} getEnv - getEnv function from fileSystem
 * @returns {Promise<Object>} Processed configuration
 */
async function processEnvVariables(config, domain, getEnv) {
  const envPattern = /\[\[env\.(\w+)\]\]/g;

  // Recursively process object
  async function processValue(value) {
    if (typeof value === 'string') {
      // Check if string contains env variable references
      const matches = value.matchAll(envPattern);
      let result = value;

      for (const match of matches) {
        const varName = match[1];
        // Try site-specific env first, then fallback to global process.env
        const envValue = await getEnv(domain, varName) || process.env[varName];

        if (envValue !== null && envValue !== undefined) {
          result = result.replace(match[0], envValue);
        } else {
          console.warn(`Environment variable ${varName} not found for domain ${domain}`);
        }
      }

      return result;
    } else if (Array.isArray(value)) {
      return await Promise.all(value.map(item => processValue(item)));
    } else if (typeof value === 'object' && value !== null) {
      const processed = {};
      for (const [key, val] of Object.entries(value)) {
        processed[key] = await processValue(val);
      }
      return processed;
    }

    return value;
  }

  return await processValue(config);
}

/**
 * Load AI configuration for a domain
 * Uses fileSystem to load from settings/prompts.json (or database)
 * @param {string} domain - Domain name
 * @returns {Promise<Object>} AI configuration
 */
export async function loadAIConfig(domain) {
  // Check cache
  const cached = configCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.config;
  }

  try {
    // Dynamic import to avoid bundling server-side code in client
    // This import only executes on the server (in API routes or functions)
    const { getFile, getEnv } = await import('@/core/sites/files.js');

    // Load from settings using fileSystem abstraction
    // This works for both local mode (sites/{domain}/settings/ai.json)
    // and database mode (MongoDB with class='setting', name='ai')
    const configContent = await getFile(domain, 'setting', 'ai');

    if (!configContent && process.env.NODE_ENV === 'development') {
      console.log(`[AI Config] No 'ai' setting found for domain: ${domain}`);
      console.log(`[AI Config] Make sure:`);
      console.log(`  1. Domain '${domain}' exists in the site's domains array`);
      console.log(`  2. Setting with class='setting' and name='ai' exists`);
    }

    let config;
    if (configContent) {
      try {
        config = JSON.parse(configContent);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AI Config] Loaded for domain: ${domain}, enabled: ${config?.config?.enabled}`);
        }
      } catch (parseError) {
        console.error(`Error parsing AI config for ${domain}:`, parseError);
        config = { ...DEFAULT_CONFIG, config: { ...DEFAULT_CONFIG.config, enabled: false } };
      }
    } else {
      // No ai.json — auto-detect API keys from the TENANT's own settings/.env only.
      // 🔒 Tenant isolation: never fall back to the host process env — that would
      // let one site silently borrow another tenant's (or the platform's) key.
      const hasOpenAI = await getEnv(domain, 'OPENAI_API_KEY');
      const hasAnthropic = await getEnv(domain, 'ANTHROPIC_API_KEY');
      const hasGoogle = await getEnv(domain, 'GOOGLE_AI_API_KEY');

      if (hasOpenAI || hasAnthropic || hasGoogle) {
        // Auto-enable with sensible defaults — no ai.json needed for basic usage
        const models = [];
        if (hasOpenAI) models.push('gpt-5-mini', 'gpt-5');
        if (hasAnthropic) models.push('claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929');
        if (hasGoogle) models.push('gemini-2.0-flash');

        if (process.env.NODE_ENV === 'development') {
          console.log(`[AI Config] No ai.json for ${domain}, but found API keys — auto-enabling AI`);
        }

        const api_keys = {};
        if (hasOpenAI) api_keys.openai = hasOpenAI;
        if (hasAnthropic) api_keys.anthropic = hasAnthropic;
        if (hasGoogle) api_keys.google = hasGoogle;

        config = {
          config: {
            ...DEFAULT_CONFIG.config,
            enabled: true,
            api_keys,
            models: { text: models, image: DEFAULT_CONFIG.config.models.image, speech: DEFAULT_CONFIG.config.models.speech },
            features: { text: true, image: false, speech: false },
            security: {
              ...DEFAULT_CONFIG.config.security,
              allowedContexts: ['functions'],
              allowArbitraryPrompts: true
            }
          },
          prompts: {},
          agents: {}
        };
      } else {
        config = { ...DEFAULT_CONFIG, config: { ...DEFAULT_CONFIG.config, enabled: false } };
      }
    }

    // Process environment variables in config (e.g., [[env.OPENAI_API_KEY]])
    config = await processEnvVariables(config, domain, getEnv);

    // Validate configuration
    const validatedConfig = validateConfig(config);

    // Cache the configuration
    configCache.set(domain, {
      config: validatedConfig,
      timestamp: Date.now()
    });

    return validatedConfig;
  } catch (error) {
    console.error(`Error loading AI config for ${domain}:`, error);
    // Return disabled config on error
    return { ...DEFAULT_CONFIG, config: { ...DEFAULT_CONFIG.config, enabled: false } };
  }
}

/**
 * Validate AI configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validated configuration with defaults
 */
function validateConfig(config) {
  const validated = {
    config: {
      enabled: config.config?.enabled ?? DEFAULT_CONFIG.config.enabled,
      api_key: config.config?.api_key || null, // Per-domain API key (optional, legacy OpenAI)
      api_keys: config.config?.api_keys && typeof config.config.api_keys === 'object'
        ? { ...config.config.api_keys }
        : {},
      models: {
        text: Array.isArray(config.config?.models?.text)
          ? config.config.models.text
          : DEFAULT_CONFIG.config.models.text,
        image: Array.isArray(config.config?.models?.image)
          ? config.config.models.image
          : DEFAULT_CONFIG.config.models.image,
        speech: Array.isArray(config.config?.models?.speech)
          ? config.config.models.speech
          : DEFAULT_CONFIG.config.models.speech
      },
      features: {
        text: config.config?.features?.text ?? DEFAULT_CONFIG.config.features.text,
        image: config.config?.features?.image ?? DEFAULT_CONFIG.config.features.image,
        speech: config.config?.features?.speech ?? DEFAULT_CONFIG.config.features.speech,
        allowFiles: config.config?.features?.allowFiles ?? DEFAULT_CONFIG.config.features.allowFiles
      },
      limits: {
        requestsPerMinute: config.config?.limits?.requestsPerMinute ?? DEFAULT_CONFIG.config.limits.requestsPerMinute,
        requestsPerHour: config.config?.limits?.requestsPerHour ?? DEFAULT_CONFIG.config.limits.requestsPerHour,
        requestsPerDay: config.config?.limits?.requestsPerDay ?? DEFAULT_CONFIG.config.limits.requestsPerDay,
        maxInputTokens: config.config?.limits?.maxInputTokens ?? config.config?.limits?.maxTokensPerRequest ?? DEFAULT_CONFIG.config.limits.maxInputTokens,
        maxImageSize: config.config?.limits?.maxImageSize ?? DEFAULT_CONFIG.config.limits.maxImageSize,
        maxSpeechLength: config.config?.limits?.maxSpeechLength ?? DEFAULT_CONFIG.config.limits.maxSpeechLength
      },
      security: {
        allowedContexts: Array.isArray(config.config?.security?.allowedContexts)
          ? config.config.security.allowedContexts
          : DEFAULT_CONFIG.config.security.allowedContexts,
        allowArbitraryPrompts: config.config?.security?.allowArbitraryPrompts ?? DEFAULT_CONFIG.config.security.allowArbitraryPrompts,
        requireAuth: config.config?.security?.requireAuth ?? DEFAULT_CONFIG.config.security.requireAuth,
        allowedOrigins: Array.isArray(config.config?.security?.allowedOrigins)
          ? config.config.security.allowedOrigins
          : DEFAULT_CONFIG.config.security.allowedOrigins
      }
    },
    prompts: config.prompts || {},
    agents: config.agents || {}
  };

  return validated;
}

/**
 * Get a specific prompt template
 * @param {string} domain - Domain name
 * @param {string} promptName - Name of the prompt
 * @returns {Promise<Object|null>} Prompt configuration or null
 */
export async function getPromptTemplate(domain, promptName) {
  const config = await loadAIConfig(domain);

  // Remove {{ }} wrapper if present
  const cleanName = promptName.replace(/^\{\{|\}\}$/g, '').trim();

  return config.prompts[cleanName] || null;
}

/**
 * Check if AI is enabled for a domain
 * @param {string} domain - Domain name
 * @returns {Promise<boolean>} True if enabled
 */
export async function isAIEnabled(domain) {
  const config = await loadAIConfig(domain);
  return config.config.enabled === true;
}

/**
 * Check if a specific feature is enabled
 * @param {string} domain - Domain name
 * @param {string} feature - Feature name (text, image, speech)
 * @returns {Promise<boolean>} True if enabled
 */
export async function isFeatureEnabled(domain, feature) {
  const config = await loadAIConfig(domain);
  return config.config.enabled === true && config.config.features[feature] === true;
}

/**
 * Clear configuration cache for a domain
 * @param {string} domain - Domain name (optional, clears all if not provided)
 */
export function clearConfigCache(domain) {
  if (domain) {
    configCache.delete(domain);
  } else {
    configCache.clear();
  }
}

/**
 * Get default configuration (useful for initialization)
 * @returns {Object} Default configuration
 */
export function getDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
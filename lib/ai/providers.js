/**
 * AI Provider Registry
 * Maps model names to providers and resolves API keys
 */

const PROVIDER_PREFIXES = [
  { prefix: 'claude', provider: 'anthropic' },
  { prefix: 'gemini', provider: 'google' },
  { prefix: 'gpt', provider: 'openai' },
  { prefix: 'dall-e', provider: 'openai' },
];

/**
 * Detect provider from model name
 * @param {string} model - Model name (e.g., 'gemini-3.1-flash-image-preview', 'gpt-image-1')
 * @returns {'openai'|'google'|'anthropic'} Provider identifier
 */
export function getProviderForModel(model) {
  if (!model) return 'openai';
  const lower = model.toLowerCase();
  for (const { prefix, provider } of PROVIDER_PREFIXES) {
    if (lower.startsWith(prefix)) return provider;
  }
  return 'openai'; // default
}

/**
 * Resolve the correct API key for a provider.
 *
 * 🔒 TENANT ISOLATION: Keys come ONLY from the tenant's own config
 * (loaded from their settings/.env or ai.json). The host process's
 * environment variables are never used — one tenant must never
 * silently borrow another tenant's (or the host's) credentials.
 *
 * Resolution chain: config.api_keys.{provider} -> config.api_key (openai legacy)
 *
 * @param {Object} config - Domain AI config (config.config level)
 * @param {string} provider - Provider identifier ('openai' | 'google' | 'anthropic')
 * @returns {string|null} Resolved API key, or null if the tenant has not configured one
 */
export function resolveApiKey(config, provider) {
  // 1. Per-provider key from api_keys map
  const perProvider = config?.api_keys?.[provider];
  if (perProvider) return perProvider;

  // 2. Legacy api_key field (only for OpenAI)
  if (provider === 'openai' && config?.api_key) {
    return config.api_key;
  }

  return null;
}

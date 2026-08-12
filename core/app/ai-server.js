/**
 * AI Module for Server-Side Only
 * Has direct access to AI library for better performance
 * Uses dynamic imports to avoid client-side bundling
 *
 * IMPORTANT: This module should ONLY be imported in server-side code
 * (API routes, server functions, etc.)
 * For client-side, use core/app/ai-client.js instead
 */

/**
 * Create AI module for server-side usage (functions)
 * Has direct access to AI library for better performance
 * Uses dynamic imports to avoid client-side bundling
 */
export function createServerAI(context = {}) {
  const domain = context.domain || 'localhost';
  const userId = context.userId || context.user?.id;

  // Lazy load AI client only on server - NEVER imported on client
  let aiClient = null;

  async function getAIClient() {
    if (!aiClient) {
      // Dynamic import prevents client-side bundling
      const { createAIClient } = await import('@/lib/ai/index.js');
      aiClient = createAIClient(domain, userId, 'functions');
    }
    return aiClient;
  }

  return {
    /**
     * Generate text from prompt (direct server access)
     * @param {string} prompt - Prompt text or template reference
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generation result
     */
    async prompt(prompt, options = {}) {
      try {
        const client = await getAIClient();
        return await client.prompt(prompt, options);
      } catch (error) {
        const { default: appLog } = await import('@/core/utils/appLog');
        await appLog(`ai.prompt failed: ${error.message}`, 'error', error.stack);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Generate image from prompt (direct server access)
     * @param {string} prompt - Image prompt or template reference
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generation result
     */
    async image(prompt, options = {}) {
      try {
        const client = await getAIClient();
        return await client.image(prompt, options);
      } catch (error) {
        const { default: appLog } = await import('@/core/utils/appLog');
        await appLog(`ai.image failed: ${error.message}`, 'error', error.stack);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Generate speech from text (direct server access)
     * @param {string} text - Text to convert or template reference
     * @param {Object} options - Speech options
     * @returns {Promise<Object>} Generation result
     */
    async speech(text, options = {}) {
      try {
        const client = await getAIClient();
        return await client.speech(text, options);
      } catch (error) {
        const { default: appLog } = await import('@/core/utils/appLog');
        await appLog(`ai.speech failed: ${error.message}`, 'error', error.stack);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Get available voices
     * @returns {Array} List of voice names
     */
    getVoices() {
      return [
        'coral', 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
      ];
    },

    /**
     * Estimate cost for a prompt
     * @param {string} prompt - Prompt to estimate
     * @param {Object} options - Options
     * @returns {Promise<number>} Estimated cost
     */
    async estimateCost(prompt, options = {}) {
      try {
        const client = await getAIClient();
        return client.estimateCost(prompt, options);
      } catch (error) {
        console.error('Cost estimation error:', error);
        return 0;
      }
    },

    /**
     * Check if AI is available
     * @returns {Promise<boolean>} True if available
     */
    async isAvailable() {
      try {
        const { isAIEnabled } = await import('@/lib/ai');
        return await isAIEnabled(domain);
      } catch (error) {
        return false;
      }
    }
  };
}

/**
 * Default export for convenience
 */
export default createServerAI;
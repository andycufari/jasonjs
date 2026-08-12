/**
 * AI Module for Client-Side Only
 * NO server-side imports - pure API calls
 * This file is safe to import in client components
 */

'use client';

/**
 * Create AI module for client-side usage
 * All calls go through API routes for security
 * ZERO server-side dependencies
 */
export function createClientAI(context = {}) {
  const domain = context.domain || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const userId = context.userId || context.user?.id;

  return {
    /**
     * Generate text from prompt
     * @param {string} prompt - Prompt text or template reference {{templateName}}
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generation result
     */
    async prompt(prompt, options = {}) {
      try {
        const response = await fetch('/api/ai/prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            options,
            userId,
            context: options.context || 'client'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Text generation failed');
        }

        return result;
      } catch (error) {
        console.error('AI prompt error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Generate image from prompt
     * @param {string} prompt - Image prompt or template reference {{templateName}}
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generation result
     */
    async image(prompt, options = {}) {
      try {
        const response = await fetch('/api/ai/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            options,
            userId,
            context: options.context || 'client'
          })
        });

        // Handle non-JSON responses (e.g. 504 gateway timeout returns HTML)
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(
            response.status === 504
              ? 'Request timed out. Image generation can take up to 2 minutes — please try again.'
              : `Server error (${response.status})`
          );
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Image generation failed');
        }

        return result;
      } catch (error) {
        console.error('AI image error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Generate speech from text
     * @param {string} text - Text to convert or template reference {{templateName}}
     * @param {Object} options - Speech options
     * @returns {Promise<Object>} Generation result
     */
    async speech(text, options = {}) {
      try {
        const response = await fetch('/api/ai/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            options,
            userId,
            context: options.context || 'client'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Speech generation failed');
        }

        return result;
      } catch (error) {
        console.error('AI speech error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },

    /**
     * Get available voices for speech generation
     * @returns {Promise<Array>} List of voice names
     */
    async getVoices() {
      try {
        const response = await fetch('/api/ai/speech');
        const data = await response.json();
        return data.voices || [];
      } catch (error) {
        console.error('Error fetching voices:', error);
        return [];
      }
    },

    /**
     * Check if AI is available
     * @returns {Promise<boolean>} True if available
     */
    async isAvailable() {
      try {
        const response = await fetch('/api/ai/prompt');
        return response.ok;
      } catch (error) {
        return false;
      }
    }
  };
}

export default createClientAI;
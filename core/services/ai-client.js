// core/services/ai-client.js
'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * CLIENT-SIDE AI SERVICE
 * 
 * Provides streaming and non-streaming AI capabilities
 * All requests automatically tenant-isolated server-side
 */

// ===== AI CLIENT FUNCTIONS =====

/**
 * Call AI with automatic streaming support
 * @param {string} prompt - AI prompt
 * @param {Object} options - AI options
 * @returns {Promise<string>} AI response
 */
export async function callAI(prompt, options = {}) {
  const {
    model = 'gpt-4',
    temperature = 0.7,
    maxTokens,
    systemPrompt,
    stream = false,
    onStream,
    timeout = 60000
  } = options;
  
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model,
        temperature,
        maxTokens,
        systemPrompt,
        stream
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `AI request failed: ${response.status}`);
    }
    
    // Handle streaming response
    if (stream && onStream && response.body) {
      return await handleStreamingResponse(response, onStream);
    }
    
    // Handle regular response
    const result = await response.json();
    return result.content;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`AI request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Stream AI response with real-time updates
 * @param {string} prompt - AI prompt
 * @param {Object} options - AI options with streaming callbacks
 * @returns {Promise<string>} Complete response
 */
export async function streamAI(prompt, options = {}) {
  return await callAI(prompt, {
    ...options,
    stream: true
  });
}

/**
 * Handle streaming response from AI API
 * @param {Response} response - Fetch response
 * @param {Function} onStream - Stream callback
 * @returns {Promise<string>} Complete response
 */
async function handleStreamingResponse(response, onStream) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let completeResponse = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        // Handle Server-Sent Events format
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || 
                           parsed.content?.[0]?.text || 
                           parsed.delta?.text || 
                           '';
            
            if (content) {
              completeResponse += content;
              onStream(content, completeResponse);
            }
          } catch (parseError) {
            console.warn('Failed to parse streaming data:', parseError);
          }
        } else {
          // Handle plain text streaming
          completeResponse += chunk;
          onStream(chunk, completeResponse);
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    throw new Error(`Streaming failed: ${error.message}`);
  } finally {
    reader.releaseLock();
  }
  
  return completeResponse;
}

// ===== AI REACT HOOK =====

/**
 * React hook for AI operations with state management
 * @returns {Object} AI utilities and state
 */
export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [lastResponse, setLastResponse] = useState(null);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  
  const execute = useCallback(async (prompt, options = {}) => {
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    
    setIsLoading(true);
    setError(null);
    setCurrentResponse('');
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    try {
      const response = await callAI(prompt, options);
      
      setLastResponse({
        prompt,
        response,
        timestamp: new Date(),
        model: options.model || 'gpt-4',
        success: true
      });
      
      return response;
    } catch (err) {
      setError(err.message);
      setLastResponse({
        prompt,
        response: null,
        timestamp: new Date(),
        model: options.model || 'gpt-4',
        success: false,
        error: err.message
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const stream = useCallback(async (prompt, options = {}) => {
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    setCurrentResponse('');
    
    try {
      const response = await streamAI(prompt, {
        ...options,
        onStream: (chunk, complete) => {
          setCurrentResponse(complete);
          if (options.onStream) {
            options.onStream(chunk, complete);
          }
        }
      });
      
      setLastResponse({
        prompt,
        response,
        timestamp: new Date(),
        model: options.model || 'gpt-4',
        success: true
      });
      
      return response;
    } catch (err) {
      setError(err.message);
      setLastResponse({
        prompt,
        response: null,
        timestamp: new Date(),
        model: options.model || 'gpt-4',
        success: false,
        error: err.message
      });
      throw err;
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, []);
  
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, []);
  
  const clear = useCallback(() => {
    setCurrentResponse('');
    setLastResponse(null);
    setError(null);
  }, []);
  
  return {
    // State
    isLoading,
    isStreaming,
    currentResponse,
    lastResponse,
    error,
    
    // Methods
    execute,
    stream,
    cancel,
    clear,
    
    // Convenience methods
    callAI: execute,
    streamAI: stream
  };
}

// ===== AI CONVERSATION CLASS =====

/**
 * Multi-turn AI conversation with memory
 */
export class AIConversation {
  constructor(options = {}) {
    this.messages = [];
    this.model = options.model || 'gpt-4';
    this.temperature = options.temperature || 0.7;
    this.systemPrompt = options.systemPrompt || null;
    this.maxTokens = options.maxTokens;
    this.onStream = options.onStream;
    
    if (this.systemPrompt) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
    }
  }
  
  async send(message, options = {}) {
    // Add user message
    this.messages.push({ role: 'user', content: message });
    
    try {
      const response = await callAI(message, {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        systemPrompt: this.systemPrompt,
        stream: options.stream || false,
        onStream: this.onStream,
        ...options
      });
      
      // Add assistant response
      this.messages.push({ role: 'assistant', content: response });
      
      return response;
    } catch (error) {
      // Don't add failed responses to conversation
      console.error('Conversation AI call failed:', error);
      throw error;
    }
  }
  
  async sendStream(message, options = {}) {
    return await this.send(message, { ...options, stream: true });
  }
  
  getHistory() {
    return [...this.messages];
  }
  
  clear() {
    this.messages = [];
    if (this.systemPrompt) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
    }
  }
  
  getLastResponse() {
    const lastMessage = this.messages[this.messages.length - 1];
    return lastMessage?.role === 'assistant' ? lastMessage.content : null;
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get available AI models
 * @returns {Promise<Object>} Available models and usage info
 */
export async function getAIModels() {
  try {
    const response = await fetch('/api/ai', {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to get AI models');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get AI models:', error);
    throw error;
  }
}

/**
 * Estimate token count for text
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  // Simple estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export default {
  callAI,
  streamAI,
  useAI,
  AIConversation,
  getAIModels,
  estimateTokens
};
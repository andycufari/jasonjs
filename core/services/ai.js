// core/services/ai.js
'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * AI SERVICE
 * 
 * Provides client-side interface for AI operations
 * All requests are automatically tenant-isolated server-side
 * Supports streaming, multiple models, and usage tracking
 */

// ===== CORE AI FUNCTIONS =====

/**
 * Execute AI prompt with full control over parameters
 * @param {string|Array} promptOrMessages - Prompt string or messages array
 * @param {Object} options - AI options
 * @returns {Promise<string>} AI response
 */
export async function callAI(promptOrMessages, options = {}) {
  const {
    model = 'gpt-4',
    temperature = 0.7,
    maxTokens,
    stream = false,
    systemPrompt,
    timeout = 60000
  } = options;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const body = {};
    
    // Handle both prompt string and messages array
    if (typeof promptOrMessages === 'string') {
      body.prompt = promptOrMessages;
      if (systemPrompt) {
        body.systemPrompt = systemPrompt;
      }
    } else if (Array.isArray(promptOrMessages)) {
      body.messages = promptOrMessages;
    } else {
      throw new Error('First parameter must be a string (prompt) or array (messages)');
    }
    
    // Add options
    Object.assign(body, {
      model,
      temperature,
      maxTokens,
      stream
    });
    
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `AI request failed: ${response.status}`);
    }
    
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
 * @param {string|Array} promptOrMessages - Prompt or messages
 * @param {Object} options - AI options
 * @param {Function} onChunk - Callback for each chunk
 * @returns {Promise<string>} Complete response
 */
export async function streamAI(promptOrMessages, options = {}, onChunk) {
  const {
    model = 'gpt-4',
    temperature = 0.7,
    maxTokens,
    systemPrompt
  } = options;
  
  const body = {
    model,
    temperature,
    maxTokens,
    stream: true
  };
  
  // Handle prompt format
  if (typeof promptOrMessages === 'string') {
    body.prompt = promptOrMessages;
    if (systemPrompt) {
      body.systemPrompt = systemPrompt;
    }
  } else if (Array.isArray(promptOrMessages)) {
    body.messages = promptOrMessages;
  }
  
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `AI streaming failed: ${response.status}`);
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      
      if (onChunk) {
        onChunk(chunk, fullResponse);
      }
    }
    
    return fullResponse;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get available AI models and current usage
 * @returns {Promise<Object>} Models and usage info
 */
export async function getAIInfo() {
  const response = await fetch('/api/ai', {
    method: 'GET'
  });
  
  if (!response.ok) {
    throw new Error('Failed to get AI info');
  }
  
  return await response.json();
}

// ===== CONVERSATION MANAGEMENT =====

/**
 * Conversation class for managing multi-turn AI chats
 */
export class AIConversation {
  constructor(options = {}) {
    this.messages = [];
    this.model = options.model || 'gpt-4';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens;
    this.systemPrompt = options.systemPrompt;
    
    // Add system prompt if provided
    if (this.systemPrompt) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
    }
  }
  
  /**
   * Add user message to conversation
   */
  addUserMessage(content) {
    this.messages.push({ role: 'user', content });
  }
  
  /**
   * Add assistant message to conversation
   */
  addAssistantMessage(content) {
    this.messages.push({ role: 'assistant', content });
  }
  
  /**
   * Send message and get response
   */
  async send(message, options = {}) {
    this.addUserMessage(message);
    
    const response = await callAI(this.messages, {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      ...options
    });
    
    this.addAssistantMessage(response);
    return response;
  }
  
  /**
   * Stream response
   */
  async sendStream(message, onChunk, options = {}) {
    this.addUserMessage(message);
    
    const response = await streamAI(this.messages, {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      ...options
    }, onChunk);
    
    this.addAssistantMessage(response);
    return response;
  }
  
  /**
   * Get conversation history
   */
  getHistory() {
    return [...this.messages];
  }
  
  /**
   * Clear conversation
   */
  clear() {
    this.messages = [];
    if (this.systemPrompt) {
      this.messages.push({ role: 'system', content: this.systemPrompt });
    }
  }
  
  /**
   * Export conversation
   */
  export() {
    return {
      messages: this.messages,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      systemPrompt: this.systemPrompt
    };
  }
  
  /**
   * Import conversation
   */
  import(data) {
    this.messages = data.messages || [];
    this.model = data.model || this.model;
    this.temperature = data.temperature || this.temperature;
    this.maxTokens = data.maxTokens || this.maxTokens;
    this.systemPrompt = data.systemPrompt || this.systemPrompt;
  }
}

// ===== REACT HOOK =====

/**
 * React hook for AI operations with state management
 */
export function useAI(options = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null);
  const [models, setModels] = useState({});
  const [isStreaming, setIsStreaming] = useState(false);
  const abortController = useRef(null);
  
  // Load AI info on mount
  const loadInfo = useCallback(async () => {
    try {
      const info = await getAIInfo();
      setModels(info.models);
      setUsage(info.usage);
    } catch (err) {
      console.error('Failed to load AI info:', err);
    }
  }, []);
  
  // Execute AI prompt
  const execute = useCallback(async (promptOrMessages, aiOptions = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      abortController.current = new AbortController();
      const result = await callAI(promptOrMessages, {
        ...options,
        ...aiOptions
      });
      
      // Refresh usage info
      await loadInfo();
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
      abortController.current = null;
    }
  }, [options, loadInfo]);
  
  // Stream AI response
  const stream = useCallback(async (promptOrMessages, onChunk, aiOptions = {}) => {
    setIsStreaming(true);
    setError(null);
    
    try {
      const result = await streamAI(promptOrMessages, {
        ...options,
        ...aiOptions
      }, onChunk);
      
      // Refresh usage info
      await loadInfo();
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsStreaming(false);
    }
  }, [options, loadInfo]);
  
  // Cancel current request
  const cancel = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);
  
  // Create conversation instance
  const createConversation = useCallback((conversationOptions = {}) => {
    return new AIConversation({
      ...options,
      ...conversationOptions
    });
  }, [options]);
  
  return {
    // State
    isLoading,
    error,
    usage,
    models,
    isStreaming,
    
    // Methods
    execute,
    stream,
    cancel,
    createConversation,
    loadInfo,
    
    // Convenience methods
    ask: execute,
    chat: execute,
    
    // Direct access to core functions
    callAI: useCallback((prompt, opts) => callAI(prompt, opts), []),
    streamAI: useCallback((prompt, opts, onChunk) => streamAI(prompt, opts, onChunk), [])
  };
}

// ===== PRESET FUNCTIONS =====

/**
 * Pre-configured AI functions for common tasks
 */
export const AIPresets = {
  /**
   * Generate creative content
   */
  async generateContent(topic, type = 'blog post', options = {}) {
    const prompt = `Write a ${type} about: ${topic}`;
    return await callAI(prompt, {
      model: 'gpt-4',
      temperature: 0.8,
      ...options
    });
  },
  
  /**
   * Code generation and assistance
   */
  async codeAssist(request, language = 'javascript', options = {}) {
    const systemPrompt = `You are a senior software engineer. Provide high-quality ${language} code with explanations.`;
    return await callAI(request, {
      systemPrompt,
      model: 'gpt-4',
      temperature: 0.2,
      ...options
    });
  },
  
  /**
   * Text summarization
   */
  async summarize(text, length = 'medium', options = {}) {
    const lengthMap = {
      short: 'in 1-2 sentences',
      medium: 'in 1-2 paragraphs',
      long: 'in detail'
    };
    
    const prompt = `Summarize the following text ${lengthMap[length]}:\n\n${text}`;
    return await callAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      ...options
    });
  },
  
  /**
   * Language translation
   */
  async translate(text, targetLanguage, sourceLanguage = 'auto', options = {}) {
    const prompt = sourceLanguage === 'auto' 
      ? `Translate this text to ${targetLanguage}: ${text}`
      : `Translate this text from ${sourceLanguage} to ${targetLanguage}: ${text}`;
      
    return await callAI(prompt, {
      model: 'gpt-3.5-turbo',
      temperature: 0.1,
      ...options
    });
  }
};

// Default export
export default {
  callAI,
  streamAI,
  getAIInfo,
  AIConversation,
  useAI,
  AIPresets
};
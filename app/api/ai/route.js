// app/api/ai/route.js
// Secure AI API with streaming support and tenant isolation

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import aiUsageTracker from '../../../core/services/tracking/aiUsage.js';

/**
 * SECURE AI API
 * 
 * Features:
 * - Server-side AI model integration
 * - Streaming support for real-time responses
 * - Multiple model support (OpenAI, Anthropic, etc.)
 * - Automatic tenant isolation (siteId tracking)
 * - Usage tracking and rate limiting
 * - Parameter validation and security
 */

// Supported AI models and their configurations
const AI_MODELS = {
  // OpenAI Models
  'gpt-4o-mini': {
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    costPer1kTokens: 0.0015
  },
  'gpt-4o': {
    provider: 'openai',
    maxTokens: 128000,
    supportsStreaming: true,
    costPer1kTokens: 0.01
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    maxTokens: 4096,
    supportsStreaming: true,
    costPer1kTokens: 0.001
  },
  
  // Anthropic Models
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    maxTokens: 4096,
    supportsStreaming: true,
    costPer1kTokens: 0.003
  },
  'claude-3-5-haiku': {
    provider: 'anthropic',
    maxTokens: 4096,
    supportsStreaming: true,
    costPer1kTokens: 0.00025
  }
};

// Note: Rate limiting and usage tracking now handled by aiUsageTracker (MongoDB)

/**
 * Rate limiting check using MongoDB
 */
async function checkRateLimit(siteId, userId) {
  const limit = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE) || 10;
  const windowMinutes = 1;
  
  return await aiUsageTracker.checkRateLimit(siteId, userId, limit, windowMinutes);
}

/**
 * Track AI usage in MongoDB
 */
async function trackUsage(siteId, userId, model, tokensUsed, cost, metadata = {}) {
  if (process.env.AI_USAGE_TRACKING === 'false') return;
  
  try {
    await aiUsageTracker.trackUsage(siteId, userId, model, tokensUsed, cost, metadata);
  } catch (error) {
    console.error('Failed to track AI usage:', error);
    // Don't throw - tracking failures shouldn't break AI requests
  }
}

/**
 * OpenAI API integration
 */
async function callOpenAI(model, messages, options = {}) {
  const { temperature = 0.7, maxTokens, stream = false } = options;
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  
  return response;
}

/**
 * Anthropic API integration  
 */
async function callAnthropic(model, messages, options = {}) {
  const { temperature = 0.7, maxTokens, stream = false } = options;
  
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }
  
  // Convert OpenAI format to Anthropic format
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage,
      messages: userMessages,
      stream
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
  }
  
  return response;
}

// Main AI handler
export async function POST(request) {
  try {
    // 1. CORS Protection - only allow same origin requests
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    // Check for internal calls (from function context)
    const isInternalCall = request.headers.get('X-Internal-Call') === 'true';
    const isFunctionContext = request.headers.get('X-Function-Context') === 'true';
    
    if (!isInternalCall && origin && !origin.includes(host)) {
      return NextResponse.json(
        { error: 'CORS violation: Unauthorized origin' },
        { status: 403 }
      );
    }
    
    // 2. Authentication and tenant isolation
    let session = null;
    let siteId = null;
    let userId = null;
    
    if (isFunctionContext) {
      // For function context calls, get context from headers
      siteId = request.headers.get('X-Site-ID');
      userId = request.headers.get('X-User-ID');
      
      if (!siteId) {
        return NextResponse.json(
          { error: 'Site ID missing in function context' },
          { status: 400 }
        );
      }
    } else {
      // For direct client calls, require session authentication
      session = await getServerSession(await authOptions());
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      siteId = session.user.startupId || session.user.siteId;
      userId = session.user.id;
      
      if (!siteId) {
        return NextResponse.json(
          { error: 'Site ID not found in session' },
          { status: 400 }
        );
      }
    }
    
    // 2. Rate limiting
    const rateLimit = await checkRateLimit(siteId, userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        },
        { status: 429 }
      );
    }
    
    // 3. Parse and validate request
    const body = await request.json();
    const { 
      prompt,
      messages,
      model = process.env.AI_DEFAULT_MODEL || 'gpt-4',
      temperature = 0.7,
      maxTokens,
      stream = false,
      systemPrompt
    } = body;
    
    if (!prompt && !messages) {
      return NextResponse.json(
        { error: 'Either prompt or messages is required' },
        { status: 400 }
      );
    }
    
    // 4. Validate model
    const modelConfig = AI_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json(
        { error: `Unsupported model: ${model}` },
        { status: 400 }
      );
    }
    
    // 5. Prepare messages
    let aiMessages;
    if (messages) {
      aiMessages = messages;
    } else {
      aiMessages = [];
      if (systemPrompt) {
        aiMessages.push({ role: 'system', content: systemPrompt });
      }
      aiMessages.push({ role: 'user', content: prompt });
    }
    
    // 6. Validate token limits
    const requestedMaxTokens = maxTokens || Math.min(
      parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST) || 4000,
      modelConfig.maxTokens
    );
    
    // 7. Call AI provider
    console.log(`AI request for site ${siteId}: ${model} - ${aiMessages.length} messages`);
    
    let response;
    const options = { temperature, maxTokens: requestedMaxTokens, stream };
    
    if (modelConfig.provider === 'openai') {
      response = await callOpenAI(model, aiMessages, options);
    } else if (modelConfig.provider === 'anthropic') {
      response = await callAnthropic(model, aiMessages, options);
    } else {
      throw new Error(`Unsupported AI provider: ${modelConfig.provider}`);
    }
    
    // 8. Handle streaming response
    if (stream && modelConfig.supportsStreaming) {
      // For streaming, we need to set up Server-Sent Events
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body.getReader();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              // Forward the chunk to the client
              controller.enqueue(value);
            }
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          } finally {
            controller.close();
          }
        }
      });
      
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Rate-Limit-Remaining': rateLimit.remaining.toString(),
          'X-Rate-Limit-Reset': rateLimit.resetTime.toString()
        }
      });
    }
    
    // 9. Handle non-streaming response
    const result = await response.json();
    
    // Extract response based on provider
    let content, tokensUsed = 0;
    
    if (modelConfig.provider === 'openai') {
      content = result.choices?.[0]?.message?.content || '';
      tokensUsed = result.usage?.total_tokens || 0;
    } else if (modelConfig.provider === 'anthropic') {
      content = result.content?.[0]?.text || '';
      tokensUsed = result.usage?.input_tokens + result.usage?.output_tokens || 0;
    }
    
    // 10. Track usage
    const estimatedCost = (tokensUsed / 1000) * modelConfig.costPer1kTokens;
    const usageMetadata = {
      provider: modelConfig.provider,
      temperature,
      maxTokens: requestedMaxTokens,
      promptLength: JSON.stringify(aiMessages).length,
      responseLength: content.length
    };
    await trackUsage(siteId, userId, model, tokensUsed, estimatedCost, usageMetadata);
    
    return NextResponse.json({
      success: true,
      content,
      model,
      tokensUsed,
      estimatedCost,
      siteId, // Include for debugging
      metadata: {
        model,
        provider: modelConfig.provider,
        tokensUsed,
        estimatedCost,
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        'X-Rate-Limit-Remaining': rateLimit.remaining.toString(),
        'X-Rate-Limit-Reset': rateLimit.resetTime.toString()
      }
    });
    
  } catch (error) {
    console.error('AI API error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'AI request failed',
        success: false 
      },
      { status: 500 }
    );
  }
}

// Get available models and usage info
export async function GET(request) {
  try {
    const session = await getServerSession(await authOptions());
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const siteId = session.user.startupId || session.user.siteId;
    
    // Return available models and current usage from MongoDB
    const usage = await aiUsageTracker.getTotalUsage(siteId, 1); // Today's usage
    
    return NextResponse.json({
      success: true,
      models: AI_MODELS,
      usage,
      rateLimit: {
        limit: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE) || 10,
        window: '1 minute'
      }
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get AI info' },
      { status: 500 }
    );
  }
}
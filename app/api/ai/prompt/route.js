/**
 * AI Prompt API Route
 * Handles text generation requests
 */

import { NextResponse } from 'next/server';
import { createAIClient, validateOrigin } from '@/lib/ai';
import { resolveSite } from '@/core/sites/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/prompt
 * Generate text using AI
 */
export async function POST(request) {
  try {
    // Get domain from request (handles localhost → DEFAULT_DOMAIN mapping)
    const { host: domain } = await resolveSite(request);

    // Validate origin (same-origin only)
    const config = await import('@/lib/ai/config.js').then(m => m.loadAIConfig(domain));

    if (!validateOrigin(request, config.config?.security?.allowedOrigins)) {
      return NextResponse.json(
        { success: false, error: 'Origin not allowed' },
        { status: 403 }
      );
    }

    // Check if AI is enabled
    if (!config.config.enabled) {
      return NextResponse.json(
        { success: false, error: 'AI is not enabled for this domain' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { prompt, options = {}, userId, context = 'client' } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Create AI client with context
    const ai = createAIClient(domain, userId, context);

    // Generate text
    const result = await ai.prompt(prompt, options);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Return result
    return NextResponse.json({
      success: true,
      text: result.text,
      model: result.model,
      usage: result.usage,
      cost: result.cost,
      duration: result.duration
    });

  } catch (error) {
    console.error('AI prompt API error:', error);

    // Handle specific errors
    if (error.message.includes('Rate limit exceeded')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 429 }
      );
    }

    if (error.message.includes('not enabled') || error.message.includes('not allowed')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    if (error.message.includes('Template') || error.message.includes('Missing')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Text generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/prompt
 * Get API information
 */
export async function GET(request) {
  return NextResponse.json({
    endpoint: '/api/ai/prompt',
    method: 'POST',
    description: 'Generate text using AI',
    parameters: {
      prompt: 'string (required) - Prompt text or template reference ({{templateName}})',
      options: 'object (optional) - Generation options',
      userId: 'string (optional) - User ID for tracking',
      context: 'string (optional) - Execution context (client, functions, system-components)'
    },
    options: {
      model: 'string - Model to use (gpt-5-mini, gpt-5-nano, gpt-5)',
      maxTokens: 'number - Maximum tokens to generate',
      temperature: 'number - Creativity (0-2)',
      variables: 'object - Template variables',
      images: 'array - Image URLs for multi-modal input',
      systemPrompt: 'string - System instructions'
    }
  });
}
/**
 * AI Speech API Route
 * Handles text-to-speech generation requests
 */

import { NextResponse } from 'next/server';
import { createAIClient, validateOrigin } from '@/lib/ai';
import { resolveSite } from '@/core/sites/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Speech generation can take longer

/**
 * POST /api/ai/speech
 * Generate speech from text using AI
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

    // Check if speech feature is enabled
    if (!config.config.features.speech) {
      return NextResponse.json(
        { success: false, error: 'Speech generation is not enabled' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { text, options = {}, userId, context = 'client' } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Create AI client with context
    const ai = createAIClient(domain, userId, context);

    // Generate speech
    const result = await ai.speech(text, options);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Return result (audio as base64)
    return NextResponse.json({
      success: true,
      audio: result.base64,
      format: result.format,
      model: result.model,
      cost: result.cost,
      duration: result.duration,
      size: result.size
    });

  } catch (error) {
    console.error('AI speech API error:', error);

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

    if (error.message.includes('Text too long') || error.message.includes('Template')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Speech generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/speech
 * Get API information
 */
export async function GET(request) {
  const { getAvailableVoices, getAvailableFormats } = await import('@/lib/ai/speech.js');

  return NextResponse.json({
    endpoint: '/api/ai/speech',
    method: 'POST',
    description: 'Generate speech from text using AI',
    parameters: {
      text: 'string (required) - Text to convert to speech or template reference ({{templateName}})',
      options: 'object (optional) - Generation options',
      userId: 'string (optional) - User ID for tracking',
      context: 'string (optional) - Execution context (client, functions, system-components)'
    },
    options: {
      model: 'string - Model to use (gpt-4o-mini-tts)',
      voice: 'string - Voice name',
      format: 'string - Audio format',
      speed: 'number - Speech speed (0.25 - 4.0)',
      instructions: 'string - Voice instructions',
      variables: 'object - Template variables'
    },
    voices: getAvailableVoices(),
    formats: getAvailableFormats()
  });
}
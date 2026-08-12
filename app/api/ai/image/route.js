/**
 * AI Image API Route
 * Handles image generation and editing requests
 */

import { NextResponse } from 'next/server';
import { createAIClient, validateOrigin } from '@/lib/ai';
import { resolveSite } from '@/core/sites/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Image generation can take 60+ seconds

/**
 * POST /api/ai/image
 * Generate or edit images using AI
 */
export async function POST(request) {
  try {
    // Get domain from request (handles localhost → DEFAULT_DOMAIN mapping)
    const { host: domain } = await resolveSite(request);

    // Parse request body
    const body = await request.json();

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

    // Check if image feature is enabled
    if (!config.config.features.image) {
      return NextResponse.json(
        { success: false, error: 'Image generation is not enabled' },
        { status: 403 }
      );
    }

    // Extract data from body (already parsed above)
    const { prompt, options = {}, userId, context = 'client' } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Create AI client with context
    const ai = createAIClient(domain, userId, context);

    // Generate image
    const result = await ai.image(prompt, options);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Return result (images as S3/CDN URLs)
    return NextResponse.json({
      success: true,
      images: result.images,
      model: result.model,
      cost: result.cost,
      duration: result.duration,
      uploadDuration: result.uploadDuration,
      count: result.count
    });

  } catch (error) {
    console.error('AI image API error:', error);

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

    if (error.message.includes('Template') || error.message.includes('Invalid size')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Image generation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/image
 * Get API information
 */
export async function GET(request) {
  return NextResponse.json({
    endpoint: '/api/ai/image',
    method: 'POST',
    description: 'Generate or edit images using AI',
    parameters: {
      prompt: 'string (required) - Image prompt or template reference ({{templateName}})',
      options: 'object (optional) - Generation options',
      userId: 'string (optional) - User ID for tracking',
      context: 'string (optional) - Execution context (client, functions, system-components)'
    },
    options: {
      model: 'string - Model to use (gpt-image-1, gemini-3.1-flash-image-preview, gemini-3-pro-image-preview)',
      size: 'string - Image size. OpenAI: 1024x1024, 1024x1536, 1536x1024. Google: auto-converted from pixel sizes',
      quality: 'string - Quality (low, medium, high, auto) - OpenAI only',
      format: 'string - Output format (png, jpeg, webp)',
      background: 'string - Background (opaque, transparent) - OpenAI only',
      compression: 'number - Compression level (0-100) for jpeg/webp - OpenAI only',
      aspectRatio: 'string - Aspect ratio for Google models (1:1, 16:9, 9:16, 3:4, 4:3)',
      imageSize: 'string - Output size for Google models (512, 1K, 2K, 4K)',
      variables: 'object - Template variables',
      editMode: 'boolean - Enable edit mode',
      images: 'array - Images to edit (for edit mode)'
    },
    providers: {
      openai: {
        models: ['gpt-image-1'],
        sizes: ['1024x1024', '1024x1536', '1536x1024']
      },
      google: {
        models: ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'],
        sizes: ['512', '1K', '2K', '4K'],
        aspectRatios: ['1:1', '16:9', '9:16', '3:4', '4:3', '2:3', '3:2']
      }
    },
    qualities: ['low', 'medium', 'high', 'auto'],
    formats: ['png', 'jpeg', 'webp']
  });
}
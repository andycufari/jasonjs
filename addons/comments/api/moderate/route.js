// AI Moderation API for Comments Plugin
// Uses OpenAI to check comment content for spam, toxicity, and inappropriate content

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { resolveSite } from '@/core/sites/resolve';
import { createAuthOptions } from '@/core/auth/options.js';

// In-memory cache for moderation results to avoid duplicate checks
const moderationCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Clean up expired cache entries
function cleanupCache() {
  const now = Date.now();
  for (const [key, data] of moderationCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      moderationCache.delete(key);
    }
  }
}

setInterval(cleanupCache, 60 * 60 * 1000); // Clean every hour

/**
 * Generate cache key for content
 */
function getCacheKey(content) {
  return `moderate_${Buffer.from(content).toString('base64').substring(0, 50)}`;
}

/**
 * Check if AI moderation is available
 */
async function isAIAvailable() {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    return !!openaiKey;
  } catch (error) {
    return false;
  }
}

/**
 * Moderate comment content using AI
 */
async function moderateContent(content) {
  // Check cache first
  const cacheKey = getCacheKey(content);
  const cached = moderationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // Check if AI is available
  const aiAvailable = await isAIAvailable();

  if (!aiAvailable) {
    // AI not available, approve by default
    return {
      isAppropriate: true,
      reason: null,
      confidence: 0,
      method: 'no-moderation',
    };
  }

  try {
    // Call OpenAI Moderation API (free endpoint)
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: content,
      }),
    });

    if (!response.ok) {
      throw new Error('Moderation API request failed');
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
      throw new Error('Invalid moderation response');
    }

    // Check if content is flagged
    const isFlagged = result.flagged;
    const categories = result.categories || {};
    const categoryScores = result.category_scores || {};

    // Find highest scoring category if flagged
    let reason = null;
    if (isFlagged) {
      const flaggedCategories = Object.keys(categories).filter((key) => categories[key]);

      if (flaggedCategories.length > 0) {
        // Get category with highest score
        const highestCategory = flaggedCategories.reduce((max, cat) => {
          return categoryScores[cat] > categoryScores[max] ? cat : max;
        }, flaggedCategories[0]);

        reason = highestCategory.replace(/[_-]/g, ' ');
      }
    }

    const moderationResult = {
      isAppropriate: !isFlagged,
      reason: reason,
      confidence: isFlagged ? Math.max(...Object.values(categoryScores)) : 0,
      method: 'openai-moderation',
      categories: isFlagged ? categories : null,
    };

    // Cache result
    moderationCache.set(cacheKey, {
      result: moderationResult,
      timestamp: Date.now(),
    });

    return moderationResult;
  } catch (error) {
    console.error('Moderation error:', error);

    // On error, use basic keyword filtering as fallback
    return fallbackModeration(content);
  }
}

/**
 * Fallback moderation using keyword filtering
 */
function fallbackModeration(content) {
  const lowerContent = content.toLowerCase();

  // Basic spam patterns
  const spamPatterns = [
    /\b(viagra|cialis|casino|lottery|prize|winner)\b/i,
    /\b(click here|buy now|limited time|act now)\b/i,
    /(https?:\/\/[^\s]+){3,}/gi, // Multiple URLs (3 or more)
    /(.)\1{10,}/, // Repeated characters
  ];

  // Check for spam patterns
  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      return {
        isAppropriate: false,
        reason: 'spam detected',
        confidence: 0.8,
        method: 'keyword-filter',
      };
    }
  }

  // Check for excessive caps (more than 70% uppercase)
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 10) {
    const uppercase = content.replace(/[^A-Z]/g, '');
    const capsRatio = uppercase.length / letters.length;

    if (capsRatio > 0.7) {
      return {
        isAppropriate: false,
        reason: 'excessive caps',
        confidence: 0.6,
        method: 'keyword-filter',
      };
    }
  }

  // Content passed basic checks
  return {
    isAppropriate: true,
    reason: null,
    confidence: 0.5,
    method: 'keyword-filter',
  };
}

/**
 * Get session from addon context or create manually
 */
async function getSession(request) {
  // Use injected context from addon router if available
  if (request.addonContext?.session) {
    return request.addonContext.session;
  }

  // Fallback: manual auth
  const { host } = await resolveSite(request);
  const authOptions = await createAuthOptions({ host });
  return await getServerSession(authOptions);
}

/**
 * POST /api/addons/comments/moderate
 * Moderate comment content
 */
export async function POST(request) {
  try {
    // Check authentication
    const session = await getSession(request);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const { content } = await request.json();

    // Validate content
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.trim().length === 0) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Content too long (max 1000 characters)' }, { status: 400 });
    }

    // Perform moderation
    const result = await moderateContent(content);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Moderation API error:', error);

    return NextResponse.json(
      {
        error: 'Moderation failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/addons/comments/moderate/status
 * Check if moderation is available
 */
export async function GET() {
  try {
    const available = await isAIAvailable();

    return NextResponse.json({
      available,
      method: available ? 'openai-moderation' : 'keyword-filter',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check moderation status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

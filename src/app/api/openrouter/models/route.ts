/**
 * The Counting House - OpenRouter Models API
 *
 * Endpoints:
 * GET /api/openrouter/models - Fetch available models from OpenRouter
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAvailableModels, type OpenRouterModel } from '@/lib/openrouter';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

// ============================================
// MOCK MODELS (Fallback when API key not configured)
// ============================================

const mockModels: OpenRouterModel[] = [
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fast and efficient model for quick tasks',
    pricing: { prompt: '0.00025', completion: '0.00125' },
    context_length: 200000,
  },
  {
    id: 'anthropic/claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    description: 'Latest Haiku model with improved capabilities',
    pricing: { prompt: '0.00025', completion: '0.00125' },
    context_length: 200000,
  },
  {
    id: 'anthropic/claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    description: 'Balanced performance and capability',
    pricing: { prompt: '0.003', completion: '0.015' },
    context_length: 200000,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Latest Sonnet model with enhanced reasoning',
    pricing: { prompt: '0.003', completion: '0.015' },
    context_length: 200000,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Cost-effective GPT-4o variant',
    pricing: { prompt: '0.00015', completion: '0.0006' },
    context_length: 128000,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable GPT-4 model',
    pricing: { prompt: '0.005', completion: '0.015' },
    context_length: 128000,
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    description: 'Fast and efficient Google model',
    pricing: { prompt: '0.000075', completion: '0.0003' },
    context_length: 1000000,
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    description: 'Advanced Google model with long context',
    pricing: { prompt: '0.00125', completion: '0.005' },
    context_length: 2000000,
  },
  {
    id: 'mistralai/mistral-7b-instruct',
    name: 'Mistral 7B Instruct',
    description: 'Efficient open-source model',
    pricing: { prompt: '0.00006', completion: '0.00006' },
    context_length: 32768,
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B Instruct',
    description: 'Mixture of experts model',
    pricing: { prompt: '0.00024', completion: '0.00024' },
    context_length: 32768,
  },
];

// ============================================
// GET /api/openrouter/models
// ============================================

export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    // Check if OpenRouter API key is configured
    const hasApiKey = !!process.env.OPENROUTER_API_KEY;

    if (!hasApiKey) {
      // Return mock models if API key not configured
      return NextResponse.json({
        models: mockModels,
        meta: {
          source: 'mock',
          message: 'Using mock data. Set OPENROUTER_API_KEY to fetch real models.',
        },
      });
    }

    // Fetch real models from OpenRouter
    const models = await getAvailableModels();

    // Filter to relevant models for categorization (text models)
    const relevantModels = models.filter(model => {
      // Exclude image/audio-only models
      const modality = model.architecture?.modality?.toLowerCase() || 'text';
      return modality.includes('text');
    });

    // Sort by model ID for consistent ordering
    relevantModels.sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({
      models: relevantModels,
      meta: {
        source: 'openrouter',
        total: relevantModels.length,
      },
    });
  } catch (error) {
    console.error('OpenRouter models API error:', error);
    logError('Failed to fetch OpenRouter models', { error: error as Error, source: 'api/openrouter/models', context: { method: 'GET' } });

    // Return mock models as fallback on error
    return NextResponse.json({
      models: mockModels,
      meta: {
        source: 'mock',
        message: 'Failed to fetch from OpenRouter. Using mock data.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

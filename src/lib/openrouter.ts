/**
 * The Counting House - OpenRouter AI Integration
 *
 * Provides AI-powered categorization for imported transactions.
 * Uses OpenRouter API to suggest event/category assignments.
 */

// ============================================
// TYPES
// ============================================

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
}

export interface AssignmentTarget {
  id: string;
  name: string;
  type: 'event' | 'category';
  eventType?: string;
  quarter?: string;
  description?: string;
}

export interface TransactionForCategorization {
  id: string;
  vendor: string;
  memo: string | null;
  amount: number;
  date: string;
}

export interface CategorizationResult {
  transactionId: string;
  suggestedTargetId: string | null;
  suggestedTargetType: 'event' | 'category' | null;
  confidence: number;
  reasoning?: string;
}

export interface CategorizationBatchResult {
  results: CategorizationResult[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// OPENROUTER CLIENT
// ============================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

/**
 * Get the OpenRouter API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Fetch available models from OpenRouter
 */
export async function getAvailableModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(`${OPENROUTER_API_URL}/models`, {
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'The Counting House',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Get a suitable default model for categorization tasks
 * Prefers fast, cost-effective models suitable for classification
 */
export async function getDefaultModel(): Promise<string> {
  try {
    const models = await getAvailableModels();

    // Preference order for categorization (fast, cheap, good at classification)
    const preferredModels = [
      'anthropic/claude-3-haiku',
      'anthropic/claude-3-5-haiku',
      'openai/gpt-4o-mini',
      'openai/gpt-3.5-turbo',
      'google/gemini-flash-1.5',
      'mistralai/mistral-7b-instruct',
    ];

    for (const preferred of preferredModels) {
      const found = models.find(m => m.id === preferred || m.id.startsWith(preferred));
      if (found) {
        return found.id;
      }
    }

    // Fallback to any available model
    if (models.length > 0) {
      return models[0].id;
    }

    // Ultimate fallback
    return 'anthropic/claude-3-haiku';
  } catch (error) {
    console.error('Failed to fetch models, using default:', error);
    return 'anthropic/claude-3-haiku';
  }
}

/**
 * Make a chat completion request to OpenRouter
 */
async function chatCompletion(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
): Promise<{
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}> {
  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'The Counting House',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.max_tokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}

// ============================================
// CATEGORIZATION FUNCTIONS
// ============================================

/**
 * Build the system prompt for categorization
 */
function buildCategorizationSystemPrompt(targets: AssignmentTarget[]): string {
  const events = targets.filter(t => t.type === 'event');
  const categories = targets.filter(t => t.type === 'category');

  return `You are a financial categorization assistant for a corporate events budget tracking system called "The Counting House".

Your task is to analyze credit card transactions and suggest which event or budget category each transaction should be assigned to.

AVAILABLE EVENTS:
${events.map(e => `- ID: ${e.id} | Name: "${e.name}" | Type: ${e.eventType || 'N/A'} | Quarter: ${e.quarter || 'TBD'}`).join('\n')}

AVAILABLE BUDGET CATEGORIES:
${categories.map(c => `- ID: ${c.id} | Name: "${c.name}"${c.description ? ` | Description: ${c.description}` : ''}`).join('\n')}

GUIDELINES:
1. Match transactions to events based on vendor names, memos, and timing (event dates vs transaction dates)
2. Look for event names, locations, conference names, or organization abbreviations in vendor/memo fields
3. Use budget categories for general expenses that don't belong to a specific event:
   - "Swag" for promotional items, giveaways, branded merchandise
   - "Exhibit Properties" for booth displays, banners, trade show equipment
   - "Marketing Expenses" for printing, shipping, general marketing supplies
   - "Spare Funds" for miscellaneous or unexpected expenses
   - "Conference Cost Increase" for upgrades or price increases on existing event bookings
4. Provide a confidence score from 0.0 to 1.0:
   - 0.9-1.0: Very confident match (exact name match, clear reference)
   - 0.7-0.9: Good match (strong contextual clues)
   - 0.5-0.7: Moderate match (some indicators but uncertain)
   - 0.3-0.5: Weak match (best guess based on limited info)
   - 0.0-0.3: Very uncertain (almost no matching information)

RESPONSE FORMAT:
Respond with valid JSON only. No markdown, no explanation outside JSON.
{
  "categorizations": [
    {
      "transactionId": "string",
      "targetId": "string or null if no good match",
      "targetType": "event" | "category" | null,
      "confidence": number between 0 and 1,
      "reasoning": "brief explanation"
    }
  ]
}`;
}

/**
 * Build the user prompt with transactions to categorize
 */
function buildCategorizationUserPrompt(transactions: TransactionForCategorization[]): string {
  const txnList = transactions.map(t =>
    `- ID: ${t.id} | Date: ${t.date} | Amount: $${t.amount.toFixed(2)} | Vendor: "${t.vendor}" | Memo: "${t.memo || 'N/A'}"`
  ).join('\n');

  return `Please categorize the following transactions:

${txnList}

Respond with JSON only.`;
}

/**
 * Categorize a batch of transactions using AI
 */
export async function categorizeTransactions(
  transactions: TransactionForCategorization[],
  targets: AssignmentTarget[],
  model?: string
): Promise<CategorizationBatchResult> {
  // Use provided model or get default
  const selectedModel = model || await getDefaultModel();

  // Build prompts
  const systemPrompt = buildCategorizationSystemPrompt(targets);
  const userPrompt = buildCategorizationUserPrompt(transactions);

  // Make API call
  const response = await chatCompletion(selectedModel, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // Parse response
  try {
    // Clean up response (remove markdown if present)
    let content = response.content.trim();
    if (content.startsWith('```json')) {
      content = content.slice(7);
    }
    if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    const parsed = JSON.parse(content);

    const results: CategorizationResult[] = (parsed.categorizations || []).map((cat: {
      transactionId: string;
      targetId: string | null;
      targetType: 'event' | 'category' | null;
      confidence: number;
      reasoning?: string;
    }) => ({
      transactionId: cat.transactionId,
      suggestedTargetId: cat.targetId,
      suggestedTargetType: cat.targetType,
      confidence: Math.max(0, Math.min(1, cat.confidence || 0)),
      reasoning: cat.reasoning,
    }));

    return {
      results,
      model: selectedModel,
      usage: response.usage,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', response.content);

    // Return empty results on parse failure
    return {
      results: transactions.map(t => ({
        transactionId: t.id,
        suggestedTargetId: null,
        suggestedTargetType: null,
        confidence: 0,
        reasoning: 'Failed to parse AI response',
      })),
      model: selectedModel,
      usage: response.usage,
    };
  }
}

/**
 * Categorize a single transaction (convenience wrapper)
 */
export async function categorizeSingleTransaction(
  transaction: TransactionForCategorization,
  targets: AssignmentTarget[],
  model?: string
): Promise<CategorizationResult> {
  const result = await categorizeTransactions([transaction], targets, model);
  return result.results[0] || {
    transactionId: transaction.id,
    suggestedTargetId: null,
    suggestedTargetType: null,
    confidence: 0,
  };
}

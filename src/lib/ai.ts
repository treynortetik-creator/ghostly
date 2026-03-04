/**
 * Centralized AI/OpenRouter configuration.
 * All OpenRouter calls should use these constants.
 */
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_AGENT_MODEL = 'anthropic/claude-sonnet-4';

/**
 * Strip markdown JSON code fences from AI responses.
 *
 * LLMs often wrap JSON in ```json ... ``` fences even when asked not to.
 * Use this before JSON.parse() on any AI-generated content.
 */
export function stripJsonFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```json')) {
    s = s.slice(7);
  } else if (s.startsWith('```')) {
    s = s.slice(3);
  }
  if (s.endsWith('```')) {
    s = s.slice(0, -3);
  }
  return s.trim();
}

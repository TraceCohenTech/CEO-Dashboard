/**
 * AI Client — Claude API integration for Phase 2 features.
 *
 * Phase 2 features (triage, drafts, briefs) require an Anthropic API key.
 * Without one, all AI endpoints return structured mock/placeholder responses
 * so the dashboard remains fully functional.
 *
 * Setup:
 *   1. Get an API key at https://console.anthropic.com
 *   2. Add ANTHROPIC_API_KEY to your .env.local
 *   3. Optionally set ANTHROPIC_MODEL (defaults to claude-sonnet-4-20250514)
 */

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
}

/**
 * Call the Claude API. Returns null if no API key is configured.
 *
 * Usage:
 *   const result = await callClaude({
 *     system: "You are a chief of staff AI...",
 *     messages: [{ role: "user", content: "Classify these emails..." }],
 *     maxTokens: 1024,
 *   });
 */
export async function callClaude(options: {
  system: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<AIResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.3,
      system: options.system,
      messages: options.messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text || "",
    model: data.model,
    usage: data.usage,
  };
}

/**
 * POST /api/triage — AI-powered classification of today's inputs.
 *
 * Takes emails, tasks, and follow-ups and classifies each into:
 *   Dispatch (AI handles) | Prep (AI drafts, human reviews) |
 *   Yours (human only) | Skip (defer/ignore)
 *
 * Requires: ANTHROPIC_API_KEY in env for real AI classification.
 * Without it, returns rule-based mock classifications.
 *
 * Request body: { emails, tasks, followUps, topContactEmails }
 * Response: TriageResult (see classification.ts)
 */

import { NextResponse } from "next/server";
import { callClaude, isAIEnabled, getModel } from "@/lib/ai";
import {
  TRIAGE_SYSTEM_PROMPT,
  formatTriageInput,
  mockClassify,
  type TriageInput,
  type ClassifiedItem,
  type TriageResult,
} from "@/lib/classification";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const input: TriageInput = await request.json();

    let items: ClassifiedItem[];
    let model: string | null = null;

    if (isAIEnabled()) {
      // Real AI classification
      const userMessage = formatTriageInput(input);
      const result = await callClaude({
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 4096,
        temperature: 0.2,
      });

      if (result) {
        try {
          items = JSON.parse(result.content);
          model = result.model;

          // Safety: reclassify low-confidence items as "yours"
          items = items.map((item) => ({
            ...item,
            bucket: item.confidence < 0.6 ? "yours" : item.bucket,
          }));
        } catch {
          // If JSON parsing fails, fall back to mock
          console.error("Failed to parse AI triage response, using mock");
          items = mockClassify(input);
        }
      } else {
        items = mockClassify(input);
      }
    } else {
      // No API key — use rule-based mock classifier
      items = mockClassify(input);
    }

    // Persist to database
    const db = getDb();
    await db.saveTriage(
      items.map((item) => ({
        id: `triage-${item.id}-${Date.now()}`,
        itemId: item.id,
        itemType: item.itemType,
        bucket: item.bucket,
        confidence: item.confidence,
        reason: item.reason,
        suggestedAction: item.suggestedAction,
        priority: item.priority,
        estimatedMinutes: item.estimatedMinutes,
        createdAt: new Date().toISOString(),
      }))
    );

    const result: TriageResult = {
      items,
      summary: {
        dispatch: items.filter((i) => i.bucket === "dispatch").length,
        prep: items.filter((i) => i.bucket === "prep").length,
        yours: items.filter((i) => i.bucket === "yours").length,
        skip: items.filter((i) => i.bucket === "skip").length,
        totalEstimatedMinutes: items.reduce((s, i) => s + (i.estimatedMinutes || 0), 0),
      },
      generatedAt: new Date().toISOString(),
      model,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Triage API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

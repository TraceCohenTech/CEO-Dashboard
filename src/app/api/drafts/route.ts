/**
 * POST /api/drafts — AI-generated email draft replies.
 *
 * For items classified as "dispatch" or "prep", this endpoint generates
 * a draft reply that the user can review, edit, and approve.
 *
 * Requires: ANTHROPIC_API_KEY for real draft generation.
 * Without it, returns a placeholder explaining the feature.
 *
 * Request body:
 *   {
 *     email: { id, from, subject, snippet, date },
 *     context?: {
 *       recentThreadSnippets?: string[],   // previous messages in thread
 *       senderHistory?: string[],          // past email subjects with this person
 *       calendarContext?: string,           // upcoming meetings with sender
 *     },
 *     tone?: "professional" | "casual" | "brief",  // defaults to "professional"
 *     instruction?: string,                         // optional user guidance
 *   }
 *
 * Response:
 *   {
 *     draft: { id, content, subject, model },
 *     alternatives?: string[],   // 2 shorter/longer variations
 *   }
 */

import { NextResponse } from "next/server";
import { callClaude, isAIEnabled } from "@/lib/ai";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

interface DraftRequest {
  email: {
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
  };
  context?: {
    recentThreadSnippets?: string[];
    senderHistory?: string[];
    calendarContext?: string;
  };
  tone?: "professional" | "casual" | "brief";
  instruction?: string;
}

const DRAFT_SYSTEM_PROMPT = `You are a chief of staff AI drafting email replies for a busy CEO/founder.

## Voice Guidelines
- Match the formality of the original email
- Be concise — CEOs write short emails
- Never over-promise or make commitments the user hasn't approved
- Don't use filler phrases like "I hope this email finds you well"
- Sign off naturally (Best, Thanks, Cheers — match the context)
- If context about past emails or meetings is provided, reference it naturally

## Output Format
Return a JSON object:
{
  "subject": "Re: ...",
  "content": "The email body text",
  "reasoning": "One sentence explaining your approach"
}

Return ONLY the JSON, no markdown.`;

export async function POST(request: Request) {
  try {
    const body: DraftRequest = await request.json();
    const { email, context, tone = "professional", instruction } = body;

    if (!isAIEnabled()) {
      return NextResponse.json({
        draft: {
          id: `draft-${email.id}-${Date.now()}`,
          subject: `Re: ${email.subject}`,
          content: "[AI drafts require ANTHROPIC_API_KEY — configure in .env.local to enable auto-generated replies]",
          model: null,
        },
        aiEnabled: false,
      });
    }

    // Build the user message with context
    const parts: string[] = [
      `## Email to Reply To`,
      `From: ${email.from}`,
      `Subject: ${email.subject}`,
      `Date: ${email.date}`,
      `Content: ${email.snippet}`,
    ];

    if (context?.recentThreadSnippets?.length) {
      parts.push("\n## Thread History (most recent first)");
      context.recentThreadSnippets.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
    }

    if (context?.senderHistory?.length) {
      parts.push("\n## Past Emails with This Person");
      context.senderHistory.forEach((s) => parts.push(`- ${s}`));
    }

    if (context?.calendarContext) {
      parts.push(`\n## Calendar Context\n${context.calendarContext}`);
    }

    parts.push(`\n## Instructions`);
    parts.push(`Tone: ${tone}`);
    if (instruction) parts.push(`User guidance: ${instruction}`);

    const result = await callClaude({
      system: DRAFT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: parts.join("\n") }],
      maxTokens: 1024,
      temperature: 0.4,
    });

    if (!result) {
      return NextResponse.json({ error: "AI call failed" }, { status: 500 });
    }

    let parsed: { subject: string; content: string; reasoning: string };
    try {
      parsed = JSON.parse(result.content);
    } catch {
      // If JSON parse fails, use raw content
      parsed = {
        subject: `Re: ${email.subject}`,
        content: result.content,
        reasoning: "Raw response (JSON parse failed)",
      };
    }

    const draftId = `draft-${email.id}-${Date.now()}`;

    // Persist draft
    const db = getDb();
    await db.saveDraft({
      id: draftId,
      itemId: email.id,
      draftType: "reply",
      content: parsed.content,
      status: "pending",
      model: result.model,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      draft: {
        id: draftId,
        subject: parsed.subject,
        content: parsed.content,
        reasoning: parsed.reasoning,
        model: result.model,
      },
      aiEnabled: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Drafts API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/drafts — Update draft status (approve, reject, edit).
 *
 * Request body:
 *   { id: string, status: "approved" | "rejected" | "edited", editedContent?: string }
 */
export async function PATCH(request: Request) {
  try {
    const { id, status, editedContent } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const db = getDb();
    await db.updateDraftStatus(id, status, editedContent);

    await db.logAction({
      id: `action-${Date.now()}`,
      actionType: status === "approved" ? "draft_approve" : status === "rejected" ? "draft_reject" : "draft_edit",
      itemId: id,
      metadata: editedContent ? { editedContent } : undefined,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

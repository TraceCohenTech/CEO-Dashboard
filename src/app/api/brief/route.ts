/**
 * POST /api/brief — AI-generated meeting brief.
 *
 * Takes a meeting (title, attendees, description) plus attendee email history
 * and generates a structured briefing document the user can review before
 * walking into the meeting.
 *
 * Requires: ANTHROPIC_API_KEY for real brief generation.
 * Without it, returns a structured placeholder with the raw data organized.
 *
 * Request body:
 *   {
 *     meeting: {
 *       summary: string,
 *       start: string,
 *       end: string,
 *       description?: string,
 *       location?: string,
 *     },
 *     attendees: {
 *       email: string,
 *       displayName?: string,
 *       emailHistory: { subject: string, snippet: string, date: string }[],
 *     }[],
 *     additionalContext?: string,  // user can add notes
 *   }
 *
 * Response:
 *   {
 *     brief: {
 *       id: string,
 *       summary: string,           // one-line meeting purpose
 *       attendeeNotes: { name: string, relationship: string, lastDiscussed: string }[],
 *       talkingPoints: string[],
 *       openQuestions: string[],
 *       prepActions: string[],     // things to do before the meeting
 *       model: string | null,
 *     }
 *   }
 */

import { NextResponse } from "next/server";
import { callClaude, isAIEnabled } from "@/lib/ai";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

interface BriefRequest {
  meeting: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
  };
  attendees: {
    email: string;
    displayName?: string;
    emailHistory: { subject: string; snippet: string; date: string }[];
  }[];
  additionalContext?: string;
}

const BRIEF_SYSTEM_PROMPT = `You are a chief of staff AI preparing meeting briefs for a busy CEO/founder.

## Your Job
Analyze the meeting details and email history with each attendee to produce a
concise, actionable briefing document. Think about:
- Why is this meeting happening?
- What was last discussed with each person?
- What should the user ask or bring up?
- Are there any open threads that need follow-up?

## Output Format
Return a JSON object:
{
  "summary": "One-line meeting purpose/context",
  "attendeeNotes": [
    {
      "name": "Person Name",
      "relationship": "Brief context (e.g., 'Portfolio founder at Acme', 'LP at Fund X')",
      "lastDiscussed": "Summary of last email exchange"
    }
  ],
  "talkingPoints": ["Point 1", "Point 2"],
  "openQuestions": ["Question that should be addressed"],
  "prepActions": ["Action to take before the meeting"]
}

Be concise. Talking points should be one sentence each. Max 5 talking points.
Return ONLY the JSON, no markdown.`;

export async function POST(request: Request) {
  try {
    const body: BriefRequest = await request.json();
    const { meeting, attendees, additionalContext } = body;

    if (!isAIEnabled()) {
      // Return structured placeholder using available data
      const brief = {
        id: `brief-${Date.now()}`,
        summary: meeting.summary || "Meeting",
        attendeeNotes: attendees.map((a) => ({
          name: a.displayName || a.email.split("@")[0],
          relationship: "Contact",
          lastDiscussed: a.emailHistory.length > 0
            ? `Last email: "${a.emailHistory[0].subject}" (${new Date(a.emailHistory[0].date).toLocaleDateString()})`
            : "No recent email history",
        })),
        talkingPoints: meeting.description
          ? [`Review: ${meeting.description.slice(0, 100)}`]
          : ["No description provided — consider checking with organizer"],
        openQuestions: attendees
          .filter((a) => a.emailHistory.length > 0)
          .map((a) => `Follow up on "${a.emailHistory[0].subject}" with ${a.displayName || a.email.split("@")[0]}`)
          .slice(0, 3),
        prepActions: ["[AI briefs require ANTHROPIC_API_KEY — configure in .env.local for full meeting intelligence]"],
        model: null,
      };

      return NextResponse.json({ brief, aiEnabled: false });
    }

    // Build context for AI
    const parts: string[] = [
      `## Meeting`,
      `Title: ${meeting.summary}`,
      `Time: ${meeting.start} to ${meeting.end}`,
      meeting.location ? `Location: ${meeting.location}` : "",
      meeting.description ? `Description: ${meeting.description}` : "",
    ].filter(Boolean);

    parts.push("\n## Attendees and Email History");
    for (const att of attendees) {
      parts.push(`\n### ${att.displayName || att.email}`);
      if (att.emailHistory.length > 0) {
        for (const h of att.emailHistory.slice(0, 3)) {
          parts.push(`- [${h.date}] ${h.subject}: ${h.snippet}`);
        }
      } else {
        parts.push("- No recent email history");
      }
    }

    if (additionalContext) {
      parts.push(`\n## Additional Context from User\n${additionalContext}`);
    }

    const result = await callClaude({
      system: BRIEF_SYSTEM_PROMPT,
      messages: [{ role: "user", content: parts.join("\n") }],
      maxTokens: 2048,
      temperature: 0.3,
    });

    if (!result) {
      return NextResponse.json({ error: "AI call failed" }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        summary: meeting.summary,
        attendeeNotes: [],
        talkingPoints: [result.content.slice(0, 200)],
        openQuestions: [],
        prepActions: [],
      };
    }

    const briefId = `brief-${Date.now()}`;

    // Persist brief as a draft
    const db = getDb();
    await db.saveDraft({
      id: briefId,
      itemId: `meeting-${meeting.start}`,
      draftType: "brief",
      content: JSON.stringify(parsed),
      status: "pending",
      model: result.model,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      brief: { id: briefId, ...parsed, model: result.model },
      aiEnabled: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Brief API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

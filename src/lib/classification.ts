/**
 * Classification Framework — Dispatch / Prep / Yours / Skip
 *
 * Every actionable item (email, task, follow-up, calendar event) gets
 * classified into one of four buckets that determine the human-AI boundary:
 *
 *   DISPATCH — AI can handle fully (draft reply, summarize, file, create task)
 *   PREP     — AI does the work, human makes the final call (draft important
 *              email, prepare talking points, assemble options)
 *   YOURS    — Requires human judgment, taste, authority, or relationship
 *              sensitivity (pricing decisions, investor comms, strategic choices)
 *   SKIP     — Not actionable today (newsletters, low-priority, blocked on others)
 *
 * The classifier errs toward YOURS when uncertain — it's safer to surface
 * something that could have been automated than to automate something sensitive.
 */

/* ─── Types ─── */

export type ClassificationBucket = "dispatch" | "prep" | "yours" | "skip";

export interface ClassifiedItem {
  /** Original item ID (email id, task id, etc.) */
  id: string;
  /** What kind of item this is */
  itemType: "email" | "task" | "follow-up" | "calendar" | "commitment";
  /** Classification bucket */
  bucket: ClassificationBucket;
  /** Confidence 0-1. Below 0.6 → default to "yours" */
  confidence: number;
  /** One-line reason for the classification */
  reason: string;
  /** Suggested next action (e.g., "Draft reply", "Add to agenda", "Ignore") */
  suggestedAction: string;
  /** Priority within bucket: 1 (highest) to 5 (lowest) */
  priority: number;
  /** Estimated time to handle in minutes */
  estimatedMinutes?: number;
}

export interface TriageResult {
  items: ClassifiedItem[];
  summary: {
    dispatch: number;
    prep: number;
    yours: number;
    skip: number;
    totalEstimatedMinutes: number;
  };
  generatedAt: string;
  model: string | null;
}

/* ─── System Prompt ─── */

export const TRIAGE_SYSTEM_PROMPT = `You are an AI chief of staff for a busy CEO/founder who runs a venture fund.
Your job is to classify incoming items (emails, tasks, follow-ups) into four buckets.

## Classification Buckets

DISPATCH — AI can handle fully and safely, subject to review:
- Routine scheduling responses
- Newsletter acknowledgments
- Simple information requests with clear answers
- Filing/organizing tasks
- Meeting confirmations

PREP — AI can get it mostly done, human makes final call:
- Important email replies (draft for review)
- Meeting talking points or briefing docs
- Research summaries for decisions
- Proposal outlines
- Follow-up drafts to investors or portfolio companies

YOURS — Requires the human's judgment, presence, taste, or authority:
- Pricing or investment decisions
- Sensitive relationship communications
- Strategic choices with real downside
- Anything ambiguous with consequences
- Communications with investors, LPs, or board members
- Negotiations

SKIP — Not actionable today or low value:
- Newsletters (unless from a key source)
- Automated notifications
- Marketing emails
- Items blocked on someone else
- Informational-only updates

## Rules
1. When confidence is below 0.6, classify as YOURS (err toward human review)
2. Emails from top contacts are NEVER classified as SKIP
3. Anything involving money, commitments, or external relationships defaults to PREP or YOURS
4. Be concise in reasons — one sentence max
5. Estimate time honestly — most emails take 2-5 minutes, complex ones 10-15

## Output Format
Return a JSON array of objects with these fields:
- id: string (the item's ID)
- itemType: "email" | "task" | "follow-up" | "calendar" | "commitment"
- bucket: "dispatch" | "prep" | "yours" | "skip"
- confidence: number (0-1)
- reason: string (one sentence)
- suggestedAction: string (e.g., "Draft reply", "Review and send", "Ignore")
- priority: number (1-5, lower is more urgent)
- estimatedMinutes: number

Return ONLY the JSON array, no markdown or explanation.`;

/* ─── Input Formatters ─── */

export interface TriageInput {
  emails: {
    id: string;
    from: string;
    subject: string;
    snippet: string;
    isUnread: boolean;
    date: string;
  }[];
  tasks: {
    id: string;
    title: string;
    due?: string;
    notes?: string;
  }[];
  followUps: {
    id: string;
    to: string;
    subject: string;
    date: string;
  }[];
  topContactEmails: string[];
}

export function formatTriageInput(input: TriageInput): string {
  const sections: string[] = [];

  if (input.emails.length > 0) {
    sections.push("## Unread Emails\n" + input.emails.map((e) =>
      `- ID: ${e.id} | From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet} | Date: ${e.date}`
    ).join("\n"));
  }

  if (input.tasks.length > 0) {
    sections.push("## Open Tasks\n" + input.tasks.map((t) =>
      `- ID: ${t.id} | Title: ${t.title}${t.due ? ` | Due: ${t.due}` : ""}${t.notes ? ` | Notes: ${t.notes}` : ""}`
    ).join("\n"));
  }

  if (input.followUps.length > 0) {
    sections.push("## Pending Follow-ups (sent, no reply)\n" + input.followUps.map((f) =>
      `- ID: ${f.id} | To: ${f.to} | Subject: ${f.subject} | Sent: ${f.date}`
    ).join("\n"));
  }

  if (input.topContactEmails.length > 0) {
    sections.push("## Top Contacts (high priority senders)\n" +
      input.topContactEmails.join(", "));
  }

  return sections.join("\n\n");
}

/* ─── Mock Classifier (used when no AI key is configured) ─── */

export function mockClassify(input: TriageInput): ClassifiedItem[] {
  const items: ClassifiedItem[] = [];
  const topSet = new Set(input.topContactEmails.map((e) => e.toLowerCase()));

  for (const email of input.emails) {
    const fromEmail = email.from.match(/<([^>]+)>/)?.[1]?.toLowerCase() || email.from.toLowerCase();
    const isVIP = topSet.has(fromEmail);
    const lowerSubject = email.subject.toLowerCase();

    let bucket: ClassificationBucket = "yours";
    let reason = "Unclassified — needs human review";
    let action = "Review";
    let priority = 3;

    if (/newsletter|unsubscribe|digest/i.test(email.snippet + email.subject)) {
      bucket = "skip";
      reason = "Appears to be a newsletter or automated digest";
      action = "Ignore";
      priority = 5;
    } else if (/confirm|rsvp|accept|calendar/i.test(lowerSubject) && !isVIP) {
      bucket = "dispatch";
      reason = "Routine scheduling/confirmation";
      action = "Auto-confirm or file";
      priority = 4;
    } else if (isVIP) {
      bucket = "yours";
      reason = "From a top contact — requires personal attention";
      action = "Read and respond personally";
      priority = 1;
    }

    items.push({
      id: email.id,
      itemType: "email",
      bucket,
      confidence: 0.5, // mock = low confidence
      reason,
      suggestedAction: action,
      priority,
      estimatedMinutes: bucket === "skip" ? 0 : isVIP ? 5 : 2,
    });
  }

  for (const task of input.tasks) {
    const isOverdue = task.due && new Date(task.due) < new Date();
    items.push({
      id: task.id,
      itemType: "task",
      bucket: isOverdue ? "yours" : "prep",
      confidence: 0.5,
      reason: isOverdue ? "Overdue — needs immediate attention" : "Open task, may need preparation",
      suggestedAction: isOverdue ? "Complete or reschedule" : "Review status",
      priority: isOverdue ? 1 : 3,
      estimatedMinutes: 5,
    });
  }

  for (const fu of input.followUps) {
    const age = Math.floor((Date.now() - new Date(fu.date).getTime()) / 86400000);
    items.push({
      id: fu.id,
      itemType: "follow-up",
      bucket: age >= 5 ? "yours" : "prep",
      confidence: 0.5,
      reason: age >= 5 ? "No reply in 5+ days — may need a nudge" : "Awaiting reply",
      suggestedAction: age >= 5 ? "Send follow-up" : "Wait or draft follow-up",
      priority: age >= 5 ? 2 : 4,
      estimatedMinutes: 3,
    });
  }

  return items;
}

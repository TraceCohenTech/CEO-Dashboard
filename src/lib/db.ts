/**
 * Database Layer — Persistent state for Phase 2+ features.
 *
 * This module defines the schema and provides a pluggable adapter interface.
 * Currently ships with an in-memory adapter (data lost on restart) so the
 * dashboard works without any database. To persist data:
 *
 *   Option A: SQLite via better-sqlite3 or Turso (good for single-user)
 *   Option B: PostgreSQL via Vercel Postgres or Neon (good for multi-user)
 *   Option C: Redis/Upstash for fast KV (good for triage cache)
 *
 * To use a real database:
 *   1. Install your preferred driver (e.g., `npm install @vercel/postgres`)
 *   2. Implement the DatabaseAdapter interface
 *   3. Replace the export in getDb()
 *
 * SQL schema (for reference — create these tables in your database):
 *
 *   CREATE TABLE triage_results (
 *     id            TEXT PRIMARY KEY,        -- UUID
 *     item_id       TEXT NOT NULL,           -- email/task/followup ID
 *     item_type     TEXT NOT NULL,           -- 'email' | 'task' | 'follow-up' | 'calendar'
 *     bucket        TEXT NOT NULL,           -- 'dispatch' | 'prep' | 'yours' | 'skip'
 *     confidence    REAL NOT NULL,
 *     reason        TEXT,
 *     suggested_action TEXT,
 *     priority      INTEGER DEFAULT 3,
 *     estimated_minutes INTEGER,
 *     user_override TEXT,                    -- if the user re-classified it
 *     created_at    TIMESTAMP DEFAULT NOW(),
 *     acted_at      TIMESTAMP               -- when the user took action
 *   );
 *
 *   CREATE TABLE drafts (
 *     id            TEXT PRIMARY KEY,
 *     item_id       TEXT NOT NULL,           -- email ID this draft replies to
 *     draft_type    TEXT NOT NULL,           -- 'reply' | 'follow-up' | 'brief'
 *     content       TEXT NOT NULL,
 *     status        TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'edited' | 'rejected'
 *     edited_content TEXT,                   -- user's edited version
 *     model         TEXT,                    -- which AI model generated it
 *     created_at    TIMESTAMP DEFAULT NOW(),
 *     acted_at      TIMESTAMP
 *   );
 *
 *   CREATE TABLE daily_plans (
 *     id            TEXT PRIMARY KEY,
 *     date          DATE NOT NULL,
 *     plan_json     JSONB NOT NULL,          -- structured day plan
 *     created_at    TIMESTAMP DEFAULT NOW(),
 *     updated_at    TIMESTAMP
 *   );
 *
 *   CREATE TABLE action_log (
 *     id            TEXT PRIMARY KEY,
 *     action_type   TEXT NOT NULL,           -- 'triage' | 'draft_approve' | 'draft_reject' | 'defer' | 'complete'
 *     item_id       TEXT,
 *     metadata      JSONB,
 *     created_at    TIMESTAMP DEFAULT NOW()
 *   );
 *
 *   CREATE INDEX idx_triage_item ON triage_results(item_id);
 *   CREATE INDEX idx_triage_bucket ON triage_results(bucket);
 *   CREATE INDEX idx_drafts_item ON drafts(item_id);
 *   CREATE INDEX idx_drafts_status ON drafts(status);
 *   CREATE INDEX idx_daily_plans_date ON daily_plans(date);
 *   CREATE INDEX idx_action_log_type ON action_log(action_type);
 */

/* ─── Types ─── */

export interface TriageRecord {
  id: string;
  itemId: string;
  itemType: string;
  bucket: string;
  confidence: number;
  reason: string;
  suggestedAction: string;
  priority: number;
  estimatedMinutes?: number;
  userOverride?: string;
  createdAt: string;
  actedAt?: string;
}

export interface DraftRecord {
  id: string;
  itemId: string;
  draftType: "reply" | "follow-up" | "brief";
  content: string;
  status: "pending" | "approved" | "edited" | "rejected";
  editedContent?: string;
  model?: string;
  createdAt: string;
  actedAt?: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  plan: {
    blocks: {
      startTime: string;
      endTime: string;
      type: "meeting" | "focus" | "admin" | "break";
      title: string;
      items: string[]; // item IDs to work on during this block
    }[];
    topPriorities: string[];
    deferredItems: string[];
  };
  createdAt: string;
  updatedAt?: string;
}

export interface ActionLogEntry {
  id: string;
  actionType: string;
  itemId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/* ─── Adapter Interface ─── */

export interface DatabaseAdapter {
  // Triage
  saveTriage(records: TriageRecord[]): Promise<void>;
  getTriageByItemId(itemId: string): Promise<TriageRecord | null>;
  getTriageByBucket(bucket: string, limit?: number): Promise<TriageRecord[]>;
  updateTriageOverride(id: string, override: string): Promise<void>;
  markTriageActed(id: string): Promise<void>;

  // Drafts
  saveDraft(draft: DraftRecord): Promise<void>;
  getDraftsByItemId(itemId: string): Promise<DraftRecord[]>;
  getPendingDrafts(limit?: number): Promise<DraftRecord[]>;
  updateDraftStatus(id: string, status: DraftRecord["status"], editedContent?: string): Promise<void>;

  // Daily Plans
  savePlan(plan: DailyPlan): Promise<void>;
  getPlanByDate(date: string): Promise<DailyPlan | null>;

  // Action Log
  logAction(entry: ActionLogEntry): Promise<void>;
  getRecentActions(limit?: number): Promise<ActionLogEntry[]>;
}

/* ─── In-Memory Adapter (development / no-database fallback) ─── */

class InMemoryAdapter implements DatabaseAdapter {
  private triage: Map<string, TriageRecord> = new Map();
  private drafts: Map<string, DraftRecord> = new Map();
  private plans: Map<string, DailyPlan> = new Map();
  private actions: ActionLogEntry[] = [];

  async saveTriage(records: TriageRecord[]) {
    for (const r of records) this.triage.set(r.id, r);
  }

  async getTriageByItemId(itemId: string) {
    for (const r of this.triage.values()) {
      if (r.itemId === itemId) return r;
    }
    return null;
  }

  async getTriageByBucket(bucket: string, limit = 50) {
    return [...this.triage.values()]
      .filter((r) => r.bucket === bucket)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, limit);
  }

  async updateTriageOverride(id: string, override: string) {
    const r = this.triage.get(id);
    if (r) r.userOverride = override;
  }

  async markTriageActed(id: string) {
    const r = this.triage.get(id);
    if (r) r.actedAt = new Date().toISOString();
  }

  async saveDraft(draft: DraftRecord) {
    this.drafts.set(draft.id, draft);
  }

  async getDraftsByItemId(itemId: string) {
    return [...this.drafts.values()].filter((d) => d.itemId === itemId);
  }

  async getPendingDrafts(limit = 20) {
    return [...this.drafts.values()]
      .filter((d) => d.status === "pending")
      .slice(0, limit);
  }

  async updateDraftStatus(id: string, status: DraftRecord["status"], editedContent?: string) {
    const d = this.drafts.get(id);
    if (d) {
      d.status = status;
      d.actedAt = new Date().toISOString();
      if (editedContent) d.editedContent = editedContent;
    }
  }

  async savePlan(plan: DailyPlan) {
    this.plans.set(plan.date, plan);
  }

  async getPlanByDate(date: string) {
    return this.plans.get(date) || null;
  }

  async logAction(entry: ActionLogEntry) {
    this.actions.unshift(entry);
    if (this.actions.length > 1000) this.actions.length = 1000;
  }

  async getRecentActions(limit = 50) {
    return this.actions.slice(0, limit);
  }
}

/* ─── Singleton ─── */

let _db: DatabaseAdapter | null = null;

/**
 * Get the database adapter. Replace InMemoryAdapter with your
 * preferred database implementation for persistent storage.
 */
export function getDb(): DatabaseAdapter {
  if (!_db) {
    // TODO: Replace with a real database adapter when ready.
    // Example with Vercel Postgres:
    //   _db = new PostgresAdapter(process.env.POSTGRES_URL);
    // Example with Turso/SQLite:
    //   _db = new TursoAdapter(process.env.TURSO_URL, process.env.TURSO_AUTH_TOKEN);
    _db = new InMemoryAdapter();
  }
  return _db;
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";

/* ─── Types ─── */
interface CalendarEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  location?: string;
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: string;
  }[];
}

interface Email {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  shared?: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  due?: string;
  status: string;
  notes?: string;
}

interface TaskList {
  listName: string;
  open: TaskItem[];
  completedCount: number;
  totalCount: number;
}

interface TopContact {
  name: string;
  email: string;
  count: number;
}

interface OverviewAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  emailHistory: { subject: string; snippet: string; date: string }[];
}

interface MeetingPrepData {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  location?: string;
  attendees: OverviewAttendee[];
}

interface PendingFollowUp {
  id: string;
  to: string;
  subject: string;
  date: string;
}

interface OverviewData {
  upcomingEvents: CalendarEvent[];
  meetingPrep: MeetingPrepData[];
  pendingFollowUps: PendingFollowUp[];
  generatedAt: string;
}

interface DashboardData {
  user: { name: string; email: string; photo: string };
  today: {
    events: CalendarEvent[];
    meetingsLeft: number;
    sentEmails: number;
  };
  calendar: {
    upcoming: CalendarEvent[];
    weeklyData: { day: string; meetings: number; hours: number; focusHours: number }[];
    totalMeetingsThisWeek: number;
    meetingHoursThisWeek: number;
  };
  email: {
    recent: Email[];
    unreadCount: number;
    inboxTotal: number;
    dailyStats: {
      date: string;
      dayLabel: string;
      received: number;
      sent: number;
    }[];
  };
  drive: {
    recentFiles: DriveFile[];
    storageUsed: string;
    storageLimit: string;
  };
  tasks: {
    lists: TaskList[];
    totalOpen: number;
    totalCompleted: number;
    overdue: number;
  };
  emailCategories: {
    categories: {
      key: string;
      label: string;
      count: number;
      previews: {
        id: string;
        from: string;
        subject: string;
        date: string;
        snippet: string;
      }[];
    }[];
    otherCount: number;
    totalInbox: number;
    period: string;
  };
  topContacts: TopContact[];
  lastWeek: { received: number; meetings: number; meetingHours: number };
  busiestHours: { hour: number; label: string; count: number }[];
  recentSent: {
    id: string;
    to: string;
    subject: string;
    date: string;
    snippet: string;
  }[];
  generatedAt: string;
}

interface HistoryYear {
  year: number;
  received: number;
  sent: number;
  meetings: number;
  meetingHours: number;
  recurringMeetings: number;
  recurringHours: number;
  oneOffMeetings: number;
  oneOffHours: number;
}

interface HistoryData {
  yearly: HistoryYear[];
  totalEmails: number;
  totalMeetings: number;
  totalMeetingHours: number;
}

interface HeatmapDay {
  date: string;
  count: number;
}

/* ─── Hooks ─── */
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

/* ─── Helpers ─── */
function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function parseFromName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}

function extractEmail(from: string) {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.includes("@") ? from.trim().toLowerCase() : "";
}

function formatBytes(bytes: string) {
  const b = parseInt(bytes);
  if (b === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function mimeLabel(mimeType: string) {
  if (mimeType.includes("spreadsheet")) return "Sheet";
  if (mimeType.includes("document")) return "Doc";
  if (mimeType.includes("presentation")) return "Slides";
  if (mimeType.includes("folder")) return "Folder";
  if (mimeType.includes("form")) return "Form";
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("image")) return "Image";
  return "File";
}

function mimeDot(mimeType: string) {
  if (mimeType.includes("spreadsheet")) return "bg-emerald-500";
  if (mimeType.includes("document")) return "bg-blue-500";
  if (mimeType.includes("presentation")) return "bg-amber-500";
  if (mimeType.includes("form")) return "bg-purple-500";
  return "bg-gray-400";
}

function timeUntil(dateStr: string) {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 0) return "now";
  if (diffMin < 60) return `in ${diffMin}m`;
  return `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function wowArrow(current: number, previous: number) {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  return { pct, up: pct > 0 };
}

/* ─── Components ─── */
function AnimatedNumber({ value }: { value: number }) {
  const display = useCountUp(value);
  return <>{display.toLocaleString()}</>;
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  wow,
  gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  wow?: { pct: number; up: boolean } | null;
  gradient?: string;
}) {
  const isNum = typeof value === "number";
  return (
    <div className={`rounded-2xl p-5 shadow-sm card-hover ${gradient || "bg-white"}`}>
      <p className={`text-[13px] font-medium ${gradient ? "text-white/60" : "text-[#86868b]"}`}>{label}</p>
      <div className="flex items-end gap-2">
        <p className={`text-3xl font-bold tracking-tight mt-1 ${accent || ""} ${gradient ? "text-white" : ""}`}>
          {isNum ? <AnimatedNumber value={value} /> : value}
        </p>
        {wow && (
          <span className={`text-xs font-semibold mb-1 ${wow.up ? "text-emerald-500" : "text-red-400"}`}>
            {wow.up ? "\u2191" : "\u2193"}{Math.abs(wow.pct)}%
          </span>
        )}
      </div>
      {sub && <p className={`text-[12px] mt-1 ${gradient ? "text-white/50" : "text-[#86868b]"}`}>{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
      <div className="skeleton h-3 w-20" />
      <div className="skeleton h-8 w-28" />
      <div className="skeleton h-3 w-16" />
    </div>
  );
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="skeleton h-3 w-24" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div className="skeleton h-3 w-3 rounded-full" />
          <div className="skeleton h-3 flex-1" />
          <div className="skeleton h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function StorageRing({ percent }: { percent: number }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f0f0f0" strokeWidth="6" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0071e3" />
            <stop offset="100%" stopColor="#5856d6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{percent}%</span>
      </div>
    </div>
  );
}

function CalendarHeatmap({ days }: { days: HeatmapDay[] }) {
  if (!days.length) return null;

  // Group by week (columns) starting from Sunday
  const weeks: HeatmapDay[][] = [];
  let currentWeek: HeatmapDay[] = [];

  // Pad the first week
  const firstDay = new Date(days[0].date).getDay();
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push({ date: "", count: -1 });
  }

  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  function getColor(count: number) {
    if (count < 0) return "transparent";
    if (count === 0) return "#f0f0f0";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return "#c6e3ff";
    if (intensity < 0.5) return "#6bb5ff";
    if (intensity < 0.75) return "#0071e3";
    return "#004999";
  }

  // Month labels
  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    for (const day of week) {
      if (!day.date) continue;
      const m = new Date(day.date).getMonth();
      if (m !== lastMonth) {
        months.push({
          label: new Date(day.date).toLocaleDateString("en-US", { month: "short" }),
          col: wi,
        });
        lastMonth = m;
      }
      break;
    }
  });

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="min-w-[700px]">
        {/* Month labels */}
        <div className="flex ml-8 mb-1">
          {months.map((m, i) => (
            <div
              key={i}
              className="text-[10px] text-[#86868b]"
              style={{
                position: "relative",
                left: `${(m.col / weeks.length) * 100}%`,
                marginRight: i < months.length - 1 ? "auto" : 0,
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] text-[10px] text-[#86868b] mr-1">
            {["", "M", "", "W", "", "F", ""].map((d, i) => (
              <div key={i} className="h-[11px] flex items-center justify-end w-5">{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <motion.div
                  key={di}
                  className="w-[11px] h-[11px] rounded-[2px]"
                  style={{ backgroundColor: getColor(day.count) }}
                  title={day.date ? `${day.date}: ${day.count} meetings` : ""}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: wi * 0.005, duration: 0.2 }}
                />
              ))}
              {/* Pad incomplete weeks */}
              {week.length < 7 &&
                Array.from({ length: 7 - week.length }).map((_, i) => (
                  <div key={`pad-${i}`} className="w-[11px] h-[11px]" />
                ))}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 mt-2 ml-8">
          <span className="text-[10px] text-[#86868b] mr-1">Less</span>
          {["#f0f0f0", "#c6e3ff", "#6bb5ff", "#0071e3", "#004999"].map((c) => (
            <div key={c} className="w-[11px] h-[11px] rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
          <span className="text-[10px] text-[#86868b] ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

function NextMeetingCard({ event }: { event: CalendarEvent }) {
  const startTime = event.start?.dateTime;
  const attendeeCount = event.attendees?.length || 0;

  return (
    <div className="bg-gradient-to-br from-[#1d1d1f] to-[#2d2d2f] rounded-2xl p-5 text-white shadow-lg card-hover">
      <p className="text-[13px] text-white/50 font-medium">Next Meeting</p>
      <p className="text-lg font-semibold mt-2 leading-snug">
        {event.summary || "Untitled"}
      </p>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm text-white/70">
          {startTime ? `${formatTime(startTime)} \u00b7 ${timeUntil(startTime)}` : "All day"}
        </span>
      </div>
      <div className="flex items-center justify-between mt-4">
        {attendeeCount > 0 && (
          <span className="text-xs text-white/50">
            {attendeeCount} attendee{attendeeCount !== 1 ? "s" : ""}
          </span>
        )}
        {event.hangoutLink && (
          <a
            href={event.hangoutLink}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Join Call
          </a>
        )}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#1d1d1f",
  border: "none",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
};

const tabVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/* ─── Main ─── */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "calendar" | "email" | "inbox" | "drive" | "tasks" | "analytics">("overview");
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [heatmap, setHeatmap] = useState<HeatmapDay[] | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [expandedPrep, setExpandedPrep] = useState<number | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (tab === "overview" && !overview && !overviewLoading && data) {
      setOverviewLoading(true);
      fetch("/api/overview")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) setOverview(d);
        })
        .finally(() => setOverviewLoading(false));
    }
  }, [tab, overview, overviewLoading, data]);

  useEffect(() => {
    if (tab === "analytics" && !history && !historyLoading) {
      setHistoryLoading(true);
      Promise.all([
        fetch("/api/history").then((r) => r.json()),
        fetch("/api/heatmap").then((r) => r.json()),
      ]).then(([histData, heatData]) => {
        if (!histData.error) setHistory(histData);
        if (!heatData.error) setHeatmap(heatData.days);
      }).finally(() => setHistoryLoading(false));
    }
  }, [tab, history, historyLoading]);

  if (loading && !data) {
    return (
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-10 bg-[#fafafa]/80 backdrop-blur-xl border-b border-[#e5e5e5]/60">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="skeleton h-6 w-48 mb-2" />
            <div className="skeleton h-4 w-32" />
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-6 mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonList /><SkeletonList />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-md text-center">
          <p className="text-red-500 font-medium mb-2">Something went wrong</p>
          <p className="text-[#86868b] text-sm">{error}</p>
          <button onClick={fetchData} className="mt-4 text-[#0071e3] text-sm font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const firstName = data.user.name?.split(" ")[0] || "";
  const storagePercent =
    data.drive.storageLimit !== "0"
      ? Math.round(
          (parseInt(data.drive.storageUsed) / parseInt(data.drive.storageLimit)) * 100
        )
      : 0;

  // Week-over-week comparisons
  const thisWeekReceived = data.email.dailyStats.reduce((s, d) => s + d.received, 0);
  const emailWow = wowArrow(thisWeekReceived, data.lastWeek.received);
  const meetingWow = wowArrow(data.calendar.totalMeetingsThisWeek, data.lastWeek.meetings);
  const hoursWow = wowArrow(data.calendar.meetingHoursThisWeek, data.lastWeek.meetingHours);

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "calendar" as const, label: "Calendar" },
    { id: "email" as const, label: "Email" },
    { id: "inbox" as const, label: "Inbox Intel" },
    { id: "drive" as const, label: "Drive" },
    { id: "tasks" as const, label: "Tasks" },
    { id: "analytics" as const, label: "Analytics" },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fafafa]/80 backdrop-blur-xl border-b border-[#e5e5e5]/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data.user.photo && (
                <img
                  src={data.user.photo}
                  alt=""
                  className="w-10 h-10 rounded-full ring-2 ring-white shadow-sm"
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {getGreeting()}, {firstName}
                </h1>
                <p className="text-[13px] text-[#86868b]">
                  Monitoring The (Work) Situation \u00b7 {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data.email.unreadCount > 0 && (
                <div className="relative">
                  <div className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full pulse-badge">
                    {data.email.unreadCount}
                  </div>
                </div>
              )}
              {loading && (
                <div className="w-4 h-4 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
              )}
              <button
                onClick={fetchData}
                className="text-[#0071e3] text-sm font-medium hover:underline"
              >
                Refresh
              </button>
            </div>
          </div>
          {/* Tabs */}
          <nav className="flex gap-1 mt-4 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  tab === t.id
                    ? "bg-[#1d1d1f] text-white shadow-sm"
                    : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 mt-6">
        <AnimatePresence mode="wait">
          {/* ─── OVERVIEW TAB ─── */}
          {tab === "overview" && (
            <motion.div
              key="overview"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >

              {/* ── Needs Your Decision ── */}
              {(() => {
                const overdueTasks = data.tasks.lists
                  .flatMap((l) => l.open)
                  .filter((t) => t.due && new Date(t.due) < new Date());

                const topContactEmails = new Set(
                  data.topContacts.slice(0, 10).map((c) => c.email.toLowerCase())
                );
                const allUnread = data.email.recent.filter((e) => e.isUnread);
                const vipUnread = allUnread.filter((e) => {
                  const email = extractEmail(e.from);
                  return email && topContactEmails.has(email);
                });
                const otherUnread = allUnread.filter((e) => !vipUnread.includes(e));
                const followUps = overview?.pendingFollowUps || [];

                type ActionItem =
                  | { type: "overdue"; task: TaskItem }
                  | { type: "vip-unread"; email: Email }
                  | { type: "follow-up"; followUp: PendingFollowUp }
                  | { type: "unread"; email: Email };

                const actions: ActionItem[] = [
                  ...overdueTasks.slice(0, 5).map((t) => ({ type: "overdue" as const, task: t })),
                  ...vipUnread.slice(0, 5).map((e) => ({ type: "vip-unread" as const, email: e })),
                  ...followUps.slice(0, 4).map((f) => ({ type: "follow-up" as const, followUp: f })),
                  ...otherUnread.slice(0, 3).map((e) => ({ type: "unread" as const, email: e })),
                ];

                return (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-[#f0f0f0]">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${actions.length > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
                      <p className="text-[14px] font-semibold">Needs Your Decision</p>
                      {actions.length > 0 && (
                        <span className="text-[11px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full leading-none">{actions.length}</span>
                      )}
                    </div>
                    {actions.length === 0 && !overviewLoading ? (
                      <div className="px-4 py-8 flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-[14px] font-semibold text-[#1d1d1f]">All clear</p>
                        <p className="text-[12px] text-[#86868b]">Nothing needs your attention right now</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#f5f5f5]">
                        {actions.map((action) => {
                          if (action.type === "overdue") {
                            return (
                              <div key={`ot-${action.task.id}`} className="px-4 py-2.5 flex items-start gap-3 hover:bg-[#fef9f5] transition-colors">
                                <div className="w-5 h-5 rounded-full border-2 border-orange-400 shrink-0 mt-0.5 flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-orange-500">!</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium truncate">{action.task.title}</p>
                                  <p className="text-[11px] text-orange-500 font-medium">
                                    {"Overdue \u00b7 due "}
                                    {new Date(action.task.due!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </p>
                                </div>
                                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium shrink-0">Task</span>
                              </div>
                            );
                          }
                          if (action.type === "vip-unread") {
                            return (
                              <div key={`vu-${action.email.id}`} className="px-4 py-2.5 flex items-start gap-3 hover:bg-[#f0f7ff] transition-colors">
                                <div className="w-5 h-5 rounded-full bg-[#0071e3] flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[9px] font-bold text-white">{"\u2605"}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold truncate">{parseFromName(action.email.from)}</p>
                                  <p className="text-[11px] text-[#86868b] truncate">{action.email.subject || "(no subject)"}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-[#86868b]">{formatRelative(action.email.date)}</span>
                                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">VIP</span>
                                </div>
                              </div>
                            );
                          }
                          if (action.type === "follow-up") {
                            return (
                              <div key={`fu-${action.followUp.id}`} className="px-4 py-2.5 flex items-start gap-3 hover:bg-[#f8f5ff] transition-colors">
                                <div className="w-5 h-5 rounded-full bg-[#5856d6] flex items-center justify-center shrink-0 mt-0.5">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium truncate">{"To: "}{parseFromName(action.followUp.to)}</p>
                                  <p className="text-[11px] text-[#86868b] truncate">{action.followUp.subject || "(no subject)"}{" \u00b7 no reply"}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-[#86868b]">{formatRelative(action.followUp.date)}</span>
                                  <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium">Follow up</span>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={`ur-${action.email.id}`} className="px-4 py-2.5 flex items-start gap-3 hover:bg-[#f9f9f9] transition-colors">
                              <div className="w-5 h-5 rounded-full bg-[#0071e3]/15 flex items-center justify-center shrink-0 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-[#0071e3]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium truncate">{parseFromName(action.email.from)}</p>
                                <p className="text-[11px] text-[#86868b] truncate">{action.email.subject || "(no subject)"}</p>
                              </div>
                              <span className="text-[10px] text-[#86868b] shrink-0">{formatRelative(action.email.date)}</span>
                            </div>
                          );
                        })}
                        {overviewLoading && !overview && (
                          <div className="px-4 py-2 space-y-1.5">
                            <div className="skeleton h-3 w-3/4" />
                            <div className="skeleton h-3 w-1/2" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Waiting On Others + Your Commitments ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Waiting On Others */}
                {(() => {
                  const followUps = overview?.pendingFollowUps || [];
                  const followUpKeys = new Set(followUps.map((fu) => `${fu.to}::${fu.subject}`));
                  const recentWaiting = data.recentSent
                    .filter((s) => !followUpKeys.has(`${s.to}::${s.subject}`))
                    .slice(0, 4);

                  const allWaiting = [
                    ...followUps.map((fu) => ({
                      id: fu.id,
                      to: fu.to,
                      subject: fu.subject,
                      date: fu.date,
                      age: Math.floor((Date.now() - new Date(fu.date).getTime()) / 86400000),
                      noReply: true,
                    })),
                    ...recentWaiting.map((s) => ({
                      id: s.id,
                      to: s.to,
                      subject: s.subject,
                      date: s.date,
                      age: Math.floor((Date.now() - new Date(s.date).getTime()) / 86400000),
                      noReply: false,
                    })),
                  ].sort((a, b) => b.age - a.age);

                  return (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                        <p className="text-[13px] text-[#86868b] font-medium">Waiting On Others</p>
                        {allWaiting.length > 0 && (
                          <span className="text-[10px] font-bold bg-[#f0f0f0] text-[#86868b] px-1.5 py-0.5 rounded-full leading-none">{allWaiting.length}</span>
                        )}
                      </div>
                      {overviewLoading && !overview ? (
                        <div className="px-4 py-3 space-y-2">
                          <div className="skeleton h-3 w-3/4" />
                          <div className="skeleton h-3 w-1/2" />
                        </div>
                      ) : allWaiting.length === 0 ? (
                        <div className="px-4 py-4 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-[12px] text-[#86868b]">No outstanding items</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#f5f5f5]">
                          {allWaiting.slice(0, 8).map((item) => (
                            <div key={item.id} className="px-4 py-2 flex items-center gap-3 hover:bg-[#f9f9f9] transition-colors">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.age >= 5 ? "bg-red-400" : item.age >= 3 ? "bg-orange-400" : "bg-[#d1d1d6]"}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium truncate">{parseFromName(item.to)}</p>
                                <p className="text-[11px] text-[#86868b] truncate">
                                  {item.subject || "(no subject)"}
                                  {item.noReply ? " \u00b7 no reply" : ""}
                                </p>
                              </div>
                              <span className={`text-[10px] font-medium shrink-0 ${item.age >= 5 ? "text-red-500" : item.age >= 3 ? "text-orange-500" : "text-[#86868b]"}`}>
                                {item.age}d ago
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Your Commitments */}
                {(() => {
                  const commitmentPattern = /\b(i'll|i will|let me|i can send|i'm going to|will send|will follow|will get back|will share|by (monday|tuesday|wednesday|thursday|friday|end of|eod|eow))/i;
                  const commitments = data.recentSent
                    .filter((s) => commitmentPattern.test(s.snippet))
                    .slice(0, 6);

                  return (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                        <p className="text-[13px] text-[#86868b] font-medium">Your Commitments</p>
                        <span className="text-[10px] text-[#d1d1d6]">from sent emails</span>
                      </div>
                      {commitments.length === 0 ? (
                        <div className="px-4 py-4 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#f0f0f0] flex items-center justify-center">
                            <svg className="w-3 h-3 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <p className="text-[12px] text-[#86868b]">No detected commitments</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#f5f5f5]">
                          {commitments.map((sent) => (
                            <div key={sent.id} className="px-4 py-2 flex items-start gap-3 hover:bg-[#f9f9f9] transition-colors">
                              <svg className="w-4 h-4 text-[#0071e3] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium truncate">{"To: "}{parseFromName(sent.to)}</p>
                                <p className="text-[11px] text-[#86868b] line-clamp-2 leading-relaxed">{sent.snippet}</p>
                              </div>
                              <span className="text-[10px] text-[#86868b] shrink-0">{formatRelative(sent.date)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── Today's Plan ── */}
              {(() => {
                const now = new Date();
                const upNextEvents = overview?.upcomingEvents || data.today.events;
                const todayEnd = new Date(now);
                todayEnd.setHours(23, 59, 59, 999);

                const remainingToday = upNextEvents.filter((e) => {
                  const start = e.start?.dateTime || e.start?.date || "";
                  const d = new Date(start);
                  return d >= now && d <= todayEnd;
                });

                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                const tomorrowEnd = new Date(tomorrow);
                tomorrowEnd.setHours(23, 59, 59, 999);

                const tomorrowEvents = upNextEvents.filter((e) => {
                  const start = e.start?.dateTime || e.start?.date || "";
                  const d = new Date(start);
                  return d >= tomorrow && d <= tomorrowEnd;
                });

                const dayAfter = new Date(now);
                dayAfter.setDate(dayAfter.getDate() + 2);
                dayAfter.setHours(0, 0, 0, 0);
                const dayAfterEnd = new Date(dayAfter);
                dayAfterEnd.setHours(23, 59, 59, 999);

                const dayAfterEvents = upNextEvents.filter((e) => {
                  const start = e.start?.dateTime || e.start?.date || "";
                  const d = new Date(start);
                  return d >= dayAfter && d <= dayAfterEnd;
                });

                let displayEvents: CalendarEvent[];
                let headerLabel: string;

                if (remainingToday.length > 0) {
                  displayEvents = remainingToday;
                  headerLabel = "Rest of Today";
                } else if (tomorrowEvents.length > 0) {
                  displayEvents = tomorrowEvents;
                  headerLabel = "Tomorrow";
                } else if (dayAfterEvents.length > 0) {
                  displayEvents = dayAfterEvents;
                  headerLabel = dayAfter.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                } else {
                  displayEvents = [];
                  headerLabel = "Up Next";
                }

                const nextEvent = displayEvents[0];

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Next Meeting Hero */}
                    {nextEvent ? (
                      <div className="bg-gradient-to-br from-[#1d1d1f] to-[#2d2d2f] rounded-2xl p-5 text-white shadow-lg card-hover flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">Next Up</p>
                            {nextEvent.start?.dateTime && (
                              <span className="text-[11px] text-white/50 font-mono">{timeUntil(nextEvent.start.dateTime)}</span>
                            )}
                          </div>
                          <p className="text-[17px] font-semibold mt-3 leading-snug">{nextEvent.summary || "Untitled"}</p>
                          <p className="text-[13px] text-white/60 mt-1">
                            {nextEvent.start?.dateTime ? formatTime(nextEvent.start.dateTime) : "All day"}
                            {nextEvent.end?.dateTime && nextEvent.start?.dateTime && ` \u2013 ${formatTime(nextEvent.end.dateTime)}`}
                          </p>
                          {nextEvent.location && (
                            <p className="text-[11px] text-white/40 mt-1 truncate">{nextEvent.location}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          {nextEvent.attendees && nextEvent.attendees.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-1.5">
                                {nextEvent.attendees.slice(0, 5).map((a, j) => (
                                  <div key={j} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-white/10"
                                    title={a.displayName || a.email}>
                                    {(a.displayName || a.email).charAt(0).toUpperCase()}
                                  </div>
                                ))}
                              </div>
                              <span className="text-[11px] text-white/40">
                                {nextEvent.attendees.length} attendee{nextEvent.attendees.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          ) : <div />}
                          {nextEvent.hangoutLink && (
                            <a href={nextEvent.hangoutLink} target="_blank" rel="noopener noreferrer"
                              className="bg-white/15 hover:bg-white/25 text-white text-[12px] font-medium px-4 py-1.5 rounded-lg transition-colors backdrop-blur-sm">
                              Join Call
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg card-hover">
                        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{headerLabel}</p>
                        <p className="text-[17px] font-semibold mt-3">Clear runway</p>
                        <p className="text-[13px] text-white/60 mt-1">No meetings on deck</p>
                      </div>
                    )}

                    {/* Schedule Timeline */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                        <p className="text-[13px] text-[#86868b] font-medium">{headerLabel}</p>
                        <span className="text-[11px] text-[#86868b]">{displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}</span>
                      </div>
                      {displayEvents.length > 0 ? (
                        <div className="divide-y divide-[#f5f5f5]">
                          {displayEvents.slice(0, 10).map((event, i) => {
                            const isNext = i === 0;
                            return (
                              <div key={i} className={`px-4 py-2 flex items-center gap-3 ${isNext ? "bg-[#f0f7ff]" : "hover:bg-[#f9f9f9]"} transition-colors`}>
                                <span className="text-[12px] text-[#86868b] w-14 shrink-0 text-right font-mono">
                                  {event.start?.dateTime ? formatTime(event.start.dateTime) : "All day"}
                                </span>
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isNext ? "bg-[#0071e3]" : "bg-[#d1d1d6]"}`} />
                                <p className={`text-[13px] truncate flex-1 ${isNext ? "font-semibold" : ""}`}>{event.summary || "Untitled"}</p>
                                <div className="flex items-center gap-2 shrink-0">
                                  {event.attendees && event.attendees.length > 0 && (
                                    <div className="flex -space-x-1">
                                      {event.attendees.slice(0, 3).map((a, j) => (
                                        <div key={j} className="w-4 h-4 rounded-full bg-[#e5e5e5] flex items-center justify-center text-[7px] font-bold text-[#86868b] ring-1 ring-white"
                                          title={a.displayName || a.email}>
                                          {(a.displayName || a.email).charAt(0).toUpperCase()}
                                        </div>
                                      ))}
                                      {event.attendees.length > 3 && (
                                        <span className="text-[9px] text-[#86868b] ml-1">+{event.attendees.length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                  {event.hangoutLink && (
                                    <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer"
                                      className="text-[#0071e3] text-[11px] font-medium hover:underline">Join</a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="px-4 py-4 text-[13px] text-[#86868b]">No upcoming events</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Meeting Prep + Inbox Intelligence ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Meeting Prep */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[13px] text-[#86868b] font-medium">Meeting Prep</p>
                  </div>
                  {overviewLoading && !overview ? (
                    <div className="px-4 py-3 space-y-2">
                      <div className="skeleton h-3 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                      <div className="skeleton h-3 w-2/3" />
                    </div>
                  ) : overview && overview.meetingPrep.length > 0 ? (
                    <div className="divide-y divide-[#f5f5f5]">
                      {overview.meetingPrep.map((meeting, idx) => {
                        const isExpanded = expandedPrep === idx;
                        return (
                          <div key={idx}>
                            <button
                              onClick={() => setExpandedPrep(isExpanded ? null : idx)}
                              className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-[#f9f9f9] transition-colors"
                            >
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0071e3] to-[#5856d6] flex items-center justify-center shrink-0">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold truncate">{meeting.summary || "Untitled"}</p>
                                <p className="text-[11px] text-[#86868b]">
                                  {meeting.start?.dateTime ? formatTime(meeting.start.dateTime) : "All day"}
                                  {" \u00b7 "}
                                  {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <svg className={`w-3.5 h-3.5 text-[#86868b] transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={{ duration: 0.2 }}
                                className="border-t border-[#f0f0f0]">
                                <div className="px-4 py-2.5 space-y-2.5">
                                  {meeting.attendees.map((att) => (
                                    <div key={att.email} className="flex gap-2">
                                      <div className="w-5 h-5 rounded-full bg-[#e5e5e5] flex items-center justify-center text-[9px] font-bold text-[#86868b] shrink-0 mt-0.5">
                                        {(att.displayName || att.email).charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-medium">{att.displayName || att.email.split("@")[0]}</p>
                                        {att.emailHistory.length > 0 ? att.emailHistory.slice(0, 2).map((t, ti) => (
                                          <p key={ti} className="text-[11px] text-[#86868b] truncate">{t.subject || "(no subject)"}</p>
                                        )) : (
                                          <p className="text-[10px] text-[#d1d1d6]">No recent emails</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-[12px] text-[#86868b]">No upcoming meetings with external attendees</p>
                  )}
                </div>

                {/* Inbox Intelligence */}
                {(() => {
                  const cats = data.emailCategories;
                  const total = cats.totalInbox || 1;
                  const catColors: Record<string, string> = {
                    dealFlow: "#0071e3",
                    intros: "#5856d6",
                    portfolio: "#34c759",
                    newsletters: "#86868b",
                  };

                  return (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                        <p className="text-[13px] text-[#86868b] font-medium">Inbox Intelligence</p>
                        <button onClick={() => setTab("inbox")} className="text-[#0071e3] text-[11px] font-medium">Details</button>
                      </div>
                      <div className="px-4 pb-2">
                        <div className="flex rounded-lg overflow-hidden h-2.5">
                          {cats.categories.map((cat) => {
                            const pct = (cat.count / total) * 100;
                            if (pct < 0.5) return null;
                            return (
                              <div
                                key={cat.key}
                                className="transition-all"
                                style={{ width: `${pct}%`, backgroundColor: catColors[cat.key] || "#d1d1d6" }}
                                title={`${cat.label}: ${cat.count}`}
                              />
                            );
                          })}
                          {cats.otherCount > 0 && (
                            <div style={{ width: `${(cats.otherCount / total) * 100}%`, backgroundColor: "#e5e5e5" }} title={`Other: ${cats.otherCount}`} />
                          )}
                        </div>
                      </div>
                      <div className="divide-y divide-[#f5f5f5] border-t border-[#f0f0f0]">
                        {cats.categories.map((cat) => (
                          <div key={cat.key} className="px-4 py-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColors[cat.key] || "#d1d1d6" }} />
                              <span className="text-[11px] font-semibold text-[#1d1d1f]">{cat.label}</span>
                              <span className="text-[11px] font-bold text-[#86868b] ml-auto">{cat.count}</span>
                            </div>
                            {cat.previews.length > 0 ? (
                              <div className="space-y-0.5">
                                {cat.previews.slice(0, 2).map((p) => (
                                  <p key={p.id} className="text-[11px] text-[#86868b] truncate leading-tight">
                                    <span className="text-[#1d1d1f]/70 font-medium">{parseFromName(p.from)}</span>
                                    {" \u00b7 "}
                                    {p.subject || "(no subject)"}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-[#d1d1d6]">No recent</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Quick Access: Top Contacts + Recent Emails + Recent Files ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Top Contacts */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-[13px] text-[#86868b] font-medium">Top Contacts</p>
                    <button onClick={() => setTab("email")} className="text-[#0071e3] text-[11px] font-medium">All</button>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {data.topContacts.slice(0, 6).map((contact, i) => {
                      const maxCount = data.topContacts[0]?.count || 1;
                      return (
                        <div key={contact.email} className="px-4 py-1.5 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0071e3] to-[#5856d6] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate">{contact.name}</p>
                            <div className="mt-0.5 h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-[#0071e3] to-[#5856d6] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(contact.count / maxCount) * 100}%` }}
                                transition={{ duration: 0.8, delay: i * 0.08 }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-[#86868b] font-medium tabular-nums shrink-0">{contact.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Emails */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-[13px] text-[#86868b] font-medium">Recent Emails</p>
                    <button onClick={() => setTab("email")} className="text-[#0071e3] text-[11px] font-medium">All</button>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {data.email.recent.slice(0, 7).map((email) => (
                      <div key={email.id} className="px-4 py-1.5 hover:bg-[#f9f9f9] transition-colors">
                        <div className="flex items-center gap-1.5">
                          {email.isUnread && <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3] shrink-0" />}
                          <p className={`text-[12px] truncate flex-1 ${email.isUnread ? "font-semibold" : "text-[#1d1d1f]/70"}`}>
                            {parseFromName(email.from)}
                          </p>
                          <span className="text-[10px] text-[#86868b] shrink-0">{formatRelative(email.date)}</span>
                        </div>
                        <p className="text-[11px] text-[#86868b] truncate">{email.subject || "(no subject)"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Files */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <p className="text-[13px] text-[#86868b] font-medium">Recent Files</p>
                    <button onClick={() => setTab("drive")} className="text-[#0071e3] text-[11px] font-medium">All</button>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {data.drive.recentFiles.slice(0, 7).map((file) => (
                      <a key={file.id} href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-1.5 flex items-center gap-2 hover:bg-[#f9f9f9] transition-colors block">
                        <div className={`w-2 h-2 rounded-full ${mimeDot(file.mimeType)} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate">{file.name}</p>
                          <p className="text-[10px] text-[#86868b]">{mimeLabel(file.mimeType)}{" \u00b7 "}{formatRelative(file.modifiedTime)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Open Tasks ── */}
              {data.tasks.totalOpen > 0 && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] text-[#86868b] font-medium">Open Tasks</p>
                      <span className="text-[10px] font-bold bg-[#f0f0f0] text-[#86868b] px-1.5 py-0.5 rounded-full leading-none">
                        {data.tasks.totalOpen}
                      </span>
                    </div>
                    <button onClick={() => setTab("tasks")} className="text-[#0071e3] text-[11px] font-medium">All Tasks</button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#f0f0f0]">
                    {data.tasks.lists.filter(l => l.open.length > 0).slice(0, 2).map((list) => (
                      <div key={list.listName} className="px-4 py-2">
                        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">{list.listName}</p>
                        <div className="space-y-1">
                          {list.open.slice(0, 4).map((task) => {
                            const isOverdue = task.due && new Date(task.due) < new Date();
                            return (
                              <div key={task.id} className="flex items-start gap-2">
                                <div className={`w-3 h-3 rounded-full border-2 shrink-0 mt-0.5 ${isOverdue ? "border-orange-400" : "border-[#d1d1d6]"}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-medium truncate">{task.title}</p>
                                  {task.due && (
                                    <p className={`text-[10px] ${isOverdue ? "text-orange-500 font-medium" : "text-[#86868b]"}`}>
                                      {isOverdue ? "Overdue" : "Due"} {new Date(task.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {list.open.length > 4 && (
                            <p className="text-[10px] text-[#86868b] ml-5">+{list.open.length - 4} more</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Pulse Strip (compact KPIs) ── */}
              <div className="bg-white rounded-2xl shadow-sm px-5 py-2.5 flex items-center justify-between flex-wrap gap-y-2">
                <div className="flex items-center divide-x divide-[#e5e5e5]">
                  {[
                    { n: data.email.unreadCount, label: "unread", accent: data.email.unreadCount > 50 ? "text-red-500" : "text-[#0071e3]", wow: emailWow },
                    { n: data.today.meetingsLeft, label: `meeting${data.today.meetingsLeft !== 1 ? "s" : ""} left`, accent: "text-[#1d1d1f]", wow: null },
                    { n: data.tasks.overdue, label: "overdue", accent: data.tasks.overdue > 0 ? "text-orange-500" : "text-[#1d1d1f]", wow: null },
                    { n: data.today.sentEmails, label: "sent today", accent: "text-emerald-600", wow: null },
                  ].map((item, i) => (
                    <div key={i} className="flex items-baseline gap-1.5 px-4 first:pl-0 last:pr-0">
                      <span className={`text-lg font-bold tabular-nums ${item.accent}`}>
                        <AnimatedNumber value={item.n} />
                      </span>
                      <span className="text-[11px] text-[#86868b]">{item.label}</span>
                      {item.wow && (
                        <span className={`text-[10px] font-semibold ${item.wow.up ? "text-emerald-500" : "text-red-400"}`}>
                          {item.wow.up ? "\u2191" : "\u2193"}{Math.abs(item.wow.pct)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold tabular-nums">{data.calendar.meetingHoursThisWeek}h</span>
                  <span className="text-[11px] text-[#86868b]">meetings this week</span>
                  {hoursWow && (
                    <span className={`text-[10px] font-semibold ${hoursWow.up ? "text-emerald-500" : "text-red-400"}`}>
                      {hoursWow.up ? "\u2191" : "\u2193"}{Math.abs(hoursWow.pct)}%
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── CALENDAR TAB ─── */}
          {tab === "calendar" && (
            <motion.div
              key="calendar"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
                <KpiCard
                  label="Meetings This Week"
                  value={data.calendar.totalMeetingsThisWeek}
                  wow={meetingWow}
                />
                <KpiCard
                  label="Meeting Hours"
                  value={`${data.calendar.meetingHoursThisWeek}h`}
                  wow={hoursWow}
                />
                <KpiCard
                  label="Today"
                  value={data.today.meetingsLeft}
                  sub="meetings remaining"
                />
                <KpiCard
                  label="Avg Per Day"
                  value={`${Math.round((data.calendar.meetingHoursThisWeek / 5) * 10) / 10}h`}
                  sub="weekdays"
                />
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                <p className="text-[13px] text-[#86868b] font-medium mb-4">
                  Weekly Meeting Load
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.calendar.weeklyData}>
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#86868b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#86868b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(value, name) => [name === "hours" ? `${value}h` : value, name === "hours" ? "Hours" : "Meetings"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="meetings" fill="#0071e3" radius={[6, 6, 0, 0]} maxBarSize={40} name="Meetings" />
                    <Bar dataKey="hours" fill="#34c759" radius={[6, 6, 0, 0]} maxBarSize={40} name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Busiest Hours */}
              <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                <p className="text-[13px] text-[#86868b] font-medium mb-4">
                  Busiest Hours
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.busiestHours}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#86868b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Meetings"]} />
                    <Bar dataKey="count" fill="#5856d6" radius={[4, 4, 0, 0]} maxBarSize={32} name="Meetings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[13px] text-[#86868b] font-medium">
                    Upcoming Events
                  </p>
                </div>
                <div className="divide-y divide-[#f5f5f5]">
                  {data.calendar.upcoming.map((event, i) => {
                    const startDt = event.start?.dateTime;
                    const startDate = event.start?.dateTime || event.start?.date || "";
                    const dateLabel = new Date(startDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <div
                        key={i}
                        className="px-5 py-3.5 flex items-center gap-4 hover:bg-[#f9f9f9] transition-colors"
                      >
                        <div className="w-24 shrink-0">
                          <p className="text-[11px] text-[#86868b] uppercase">{dateLabel}</p>
                          <p className="text-sm font-mono text-[#1d1d1f]">
                            {startDt ? formatTime(startDt) : "All day"}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {event.summary || "Untitled"}
                          </p>
                          {event.location && (
                            <p className="text-[11px] text-[#86868b] truncate mt-0.5">
                              {event.location}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {event.attendees && event.attendees.length > 1 && (
                            <span className="text-[11px] text-[#86868b]">
                              {event.attendees.length}
                            </span>
                          )}
                          {event.hangoutLink && (
                            <a
                              href={event.hangoutLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#0071e3] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#0077ED] transition-colors"
                            >
                              Join
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── EMAIL TAB ─── */}
          {tab === "email" && (
            <motion.div
              key="email"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
                <KpiCard
                  label="Unread"
                  value={data.email.unreadCount}
                  accent={data.email.unreadCount > 50 ? "text-red-500" : ""}
                />
                <KpiCard label="Inbox Total" value={data.email.inboxTotal} />
                <KpiCard label="Sent Today" value={data.today.sentEmails} />
                <KpiCard
                  label="Avg Received / Day"
                  value={Math.round(
                    data.email.dailyStats.reduce((s, d) => s + d.received, 0) /
                      Math.max(data.email.dailyStats.length, 1)
                  )}
                  sub="last 7 days"
                  wow={emailWow}
                />
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                <p className="text-[13px] text-[#86868b] font-medium mb-4">
                  Email Volume (7 Days)
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.email.dailyStats}>
                    <defs>
                      <linearGradient id="colorReceived2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0071e3" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0071e3" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorSent2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34c759" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#34c759" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="dayLabel"
                      tick={{ fontSize: 12, fill: "#86868b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#86868b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="received"
                      stroke="#0071e3"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorReceived2)"
                      name="Received"
                    />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      stroke="#34c759"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSent2)"
                      name="Sent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top Contacts */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[13px] text-[#86868b] font-medium">Top Contacts</p>
                </div>
                <div className="divide-y divide-[#f5f5f5]">
                  {data.topContacts.slice(0, 8).map((contact, i) => {
                    const maxCount = data.topContacts[0]?.count || 1;
                    return (
                      <div key={contact.email} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071e3] to-[#5856d6] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-[11px] text-[#86868b] truncate">{contact.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-[#0071e3] to-[#5856d6] rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${(contact.count / maxCount) * 100}%` }}
                              transition={{ duration: 0.8, delay: i * 0.1 }}
                            />
                          </div>
                          <span className="text-xs text-[#86868b] font-medium tabular-nums w-6 text-right">
                            {contact.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[13px] text-[#86868b] font-medium">Inbox</p>
                </div>
                <div className="divide-y divide-[#f5f5f5]">
                  {data.email.recent.map((email) => (
                    <div
                      key={email.id}
                      className="px-5 py-3.5 hover:bg-[#f9f9f9] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {email.isUnread && (
                          <div className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0" />
                        )}
                        {!email.isUnread && <div className="w-2 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-sm truncate ${
                                email.isUnread
                                  ? "font-semibold"
                                  : "font-medium text-[#1d1d1f]/80"
                              }`}
                            >
                              {parseFromName(email.from)}
                            </p>
                            <span className="text-[11px] text-[#86868b] shrink-0">
                              {formatRelative(email.date)}
                            </span>
                          </div>
                          <p
                            className={`text-sm truncate mt-0.5 ${
                              email.isUnread ? "font-medium" : "text-[#1d1d1f]/70"
                            }`}
                          >
                            {email.subject || "(no subject)"}
                          </p>
                          <p className="text-xs text-[#86868b] truncate mt-0.5">
                            {email.snippet}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── INBOX INTEL TAB ─── */}
          {tab === "inbox" && (
            <motion.div
              key="inbox"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {(() => {
                const cats = data.emailCategories;
                const total = cats.totalInbox || 1;
                const colors: Record<string, string> = {
                  dealFlow: "bg-[#0071e3]",
                  intros: "bg-[#5856d6]",
                  portfolio: "bg-emerald-500",
                  newsletters: "bg-[#86868b]",
                };
                const dotColors: Record<string, string> = {
                  dealFlow: "bg-[#0071e3]",
                  intros: "bg-[#5856d6]",
                  portfolio: "bg-emerald-500",
                  newsletters: "bg-[#86868b]",
                };

                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 stagger">
                      {cats.categories.map((cat) => (
                        <KpiCard
                          key={cat.key}
                          label={cat.label}
                          value={cat.count}
                          sub={`${Math.round((cat.count / total) * 100)}% of inbox`}
                        />
                      ))}
                      <KpiCard
                        label="Direct / Other"
                        value={cats.otherCount}
                        sub={`${Math.round((cats.otherCount / total) * 100)}% of inbox`}
                      />
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[13px] text-[#86868b] font-medium">
                          Inbox Breakdown
                        </p>
                        <p className="text-[11px] text-[#86868b]">{cats.period}</p>
                      </div>
                      <div className="flex rounded-lg overflow-hidden h-8">
                        {cats.categories.map((cat) => {
                          const pct = (cat.count / total) * 100;
                          if (pct < 1) return null;
                          return (
                            <div
                              key={cat.key}
                              className={`${colors[cat.key] || "bg-gray-400"} relative group transition-all hover:brightness-110`}
                              style={{ width: `${pct}%` }}
                              title={`${cat.label}: ${cat.count}`}
                            >
                              {pct > 8 && (
                                <span className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-medium">
                                  {Math.round(pct)}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {cats.otherCount > 0 && (
                          <div
                            className="bg-[#e5e5e5] relative"
                            style={{ width: `${(cats.otherCount / total) * 100}%` }}
                            title={`Other: ${cats.otherCount}`}
                          >
                            {(cats.otherCount / total) * 100 > 8 && (
                              <span className="absolute inset-0 flex items-center justify-center text-[#86868b] text-[11px] font-medium">
                                {Math.round((cats.otherCount / total) * 100)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-3">
                        {cats.categories.map((cat) => (
                          <div key={cat.key} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${dotColors[cat.key] || "bg-gray-400"}`} />
                            <span className="text-[11px] text-[#86868b]">{cat.label}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#e5e5e5]" />
                          <span className="text-[11px] text-[#86868b]">Other</span>
                        </div>
                      </div>
                    </div>

                    {cats.categories.map((cat) => (
                      <div key={cat.key} className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${dotColors[cat.key] || "bg-gray-400"}`} />
                            <p className="text-[13px] font-semibold">{cat.label}</p>
                          </div>
                          <span className="text-[11px] text-[#86868b]">
                            {cat.count} emails \u00b7 {cats.period.toLowerCase()}
                          </span>
                        </div>
                        {cat.previews.length > 0 ? (
                          <div className="divide-y divide-[#f5f5f5]">
                            {cat.previews.map((email) => (
                              <div
                                key={email.id}
                                className="px-5 py-3 hover:bg-[#f9f9f9] transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium truncate">
                                    {parseFromName(email.from)}
                                  </p>
                                  <span className="text-[11px] text-[#86868b] shrink-0">
                                    {formatRelative(email.date)}
                                  </span>
                                </div>
                                <p className="text-[13px] text-[#1d1d1f]/70 truncate mt-0.5">
                                  {email.subject || "(no subject)"}
                                </p>
                                <p className="text-xs text-[#86868b] truncate mt-0.5">
                                  {email.snippet}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-5 pb-5 text-[#86868b] text-sm">
                            No emails in this category
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                );
              })()}
            </motion.div>
          )}

          {/* ─── DRIVE TAB ─── */}
          {tab === "drive" && (
            <motion.div
              key="drive"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
                <KpiCard label="Recent Files" value={data.drive.recentFiles.length} />
                <KpiCard
                  label="Storage Used"
                  value={formatBytes(data.drive.storageUsed)}
                  sub={
                    data.drive.storageLimit !== "0"
                      ? `of ${formatBytes(data.drive.storageLimit)}`
                      : undefined
                  }
                />
                <div className="bg-white rounded-2xl p-5 shadow-sm card-hover flex items-center gap-5">
                  <StorageRing percent={storagePercent} />
                  <div>
                    <p className="text-[13px] text-[#86868b] font-medium">Storage</p>
                    <p className="text-2xl font-bold mt-1">{storagePercent}%</p>
                    <p className="text-[11px] text-[#86868b]">used</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                <div className="px-5 pt-5 pb-3">
                  <p className="text-[13px] text-[#86868b] font-medium">
                    Recently Modified
                  </p>
                </div>
                <div className="divide-y divide-[#f5f5f5]">
                  {data.drive.recentFiles.map((file) => (
                    <a
                      key={file.id}
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-3.5 flex items-center gap-3 hover:bg-[#f9f9f9] transition-colors block"
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${mimeDot(file.mimeType)} shrink-0`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-[11px] text-[#86868b] mt-0.5">
                          {mimeLabel(file.mimeType)}
                          {file.shared && " \u00b7 Shared"}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#86868b] shrink-0">
                        {formatRelative(file.modifiedTime)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── TASKS TAB ─── */}
          {tab === "tasks" && (
            <motion.div
              key="tasks"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-3 gap-4 stagger">
                <KpiCard
                  label="Open"
                  value={data.tasks.totalOpen}
                  accent={data.tasks.overdue > 0 ? "text-orange-500" : ""}
                />
                <KpiCard label="Completed" value={data.tasks.totalCompleted} />
                <KpiCard
                  label="Completion Rate"
                  value={
                    data.tasks.totalOpen + data.tasks.totalCompleted > 0
                      ? `${Math.round(
                          (data.tasks.totalCompleted /
                            (data.tasks.totalOpen + data.tasks.totalCompleted)) *
                            100
                        )}%`
                      : "---"
                  }
                />
              </div>

              {data.tasks.overdue > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                  <p className="text-sm font-medium text-orange-700">
                    {data.tasks.overdue} overdue task
                    {data.tasks.overdue !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {data.tasks.lists.map((list) => (
                <div key={list.listName} className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                    <p className="text-[13px] text-[#86868b] font-medium">
                      {list.listName}
                    </p>
                    <span className="text-[11px] text-[#86868b]">
                      {list.open.length} open \u00b7 {list.completedCount} done
                    </span>
                  </div>
                  {list.open.length > 0 ? (
                    <div className="divide-y divide-[#f5f5f5]">
                      {list.open.map((task) => {
                        const isOverdue =
                          task.due && new Date(task.due) < new Date();
                        return (
                          <div
                            key={task.id}
                            className="px-5 py-3.5 flex items-start gap-3"
                          >
                            <div
                              className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${
                                isOverdue
                                  ? "border-orange-400"
                                  : "border-[#d1d1d6]"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{task.title}</p>
                              {task.due && (
                                <p
                                  className={`text-[11px] mt-0.5 ${
                                    isOverdue
                                      ? "text-orange-500 font-medium"
                                      : "text-[#86868b]"
                                  }`}
                                >
                                  {isOverdue ? "Overdue \u00b7 " : "Due "}
                                  {new Date(task.due).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                              )}
                              {task.notes && (
                                <p className="text-[11px] text-[#86868b] truncate mt-0.5">
                                  {task.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-5 pb-5 text-[#86868b] text-sm">
                      All tasks complete
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {/* ─── ANALYTICS TAB ─── */}
          {tab === "analytics" && (
            <motion.div
              key="analytics"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {historyLoading && !history && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                  </div>
                  <SkeletonList rows={6} />
                  <SkeletonList rows={6} />
                </div>
              )}

              {history && (() => {
                const { yearly } = history;
                const currentYear = new Date().getFullYear();
                const fullYears = yearly.filter((y) => y.year < currentYear);

                const peakEmailYear = [...fullYears].sort((a, b) => (b.received + b.sent) - (a.received + a.sent))[0];
                const peakMeetingYear = [...fullYears].sort((a, b) => b.meetings - a.meetings)[0];

                const latestFull = fullYears[fullYears.length - 1];
                const priorFull = fullYears[fullYears.length - 2];
                const yoyEmail =
                  latestFull && priorFull && priorFull.received > 0
                    ? Math.round(((latestFull.received - priorFull.received) / priorFull.received) * 100)
                    : null;

                const fullYearEmails = fullYears.reduce((s, y) => s + y.received + y.sent, 0);
                const fullYearMeetings = fullYears.reduce((s, y) => s + y.meetings, 0);
                const fullYearHours = fullYears.reduce((s, y) => s + y.meetingHours, 0);
                const fullYearCount = Math.max(fullYears.length, 1);

                const totalRecurring = fullYears.reduce((s, y) => s + y.recurringMeetings, 0);
                const totalMeetingsFull = fullYears.reduce((s, y) => s + y.meetings, 0);
                const recurringPct = totalMeetingsFull > 0 ? Math.round((totalRecurring / totalMeetingsFull) * 100) : 0;

                const peakHoursYear = [...fullYears].sort((a, b) => b.meetingHours - a.meetingHours)[0];

                return (
                  <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
                      <KpiCard
                        label="Total Emails"
                        value={history.totalEmails}
                        sub="since 2020"
                        gradient="bg-gradient-to-br from-[#0071e3] to-[#5856d6]"
                      />
                      <KpiCard
                        label="Total Meetings"
                        value={history.totalMeetings}
                        sub={`${history.totalMeetingHours.toLocaleString()}h total`}
                        gradient="bg-gradient-to-br from-[#ff9500] to-[#ff6b00]"
                      />
                      <KpiCard
                        label="Avg / Year"
                        value={Math.round(fullYearEmails / fullYearCount).toLocaleString()}
                        sub={`emails \u00b7 ${Math.round(fullYearMeetings / fullYearCount).toLocaleString()} meetings`}
                      />
                      {yoyEmail !== null ? (
                        <KpiCard
                          label={`${latestFull.year} vs ${priorFull.year}`}
                          value={`${yoyEmail > 0 ? "+" : ""}${yoyEmail}%`}
                          sub="email volume change"
                          accent={yoyEmail > 0 ? "text-emerald-500" : "text-red-500"}
                        />
                      ) : (
                        <KpiCard
                          label="Peak Year"
                          value={String(peakEmailYear?.year || "---")}
                          sub={`${((peakEmailYear?.received || 0) + (peakEmailYear?.sent || 0)).toLocaleString()} emails`}
                        />
                      )}
                    </div>

                    {/* Calendar Heatmap */}
                    {heatmap && (
                      <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                        <p className="text-[13px] text-[#86868b] font-medium mb-4">
                          Meeting Activity (Past 12 Months)
                        </p>
                        <CalendarHeatmap days={heatmap} />
                      </div>
                    )}

                    {/* Email Volume by Year */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                      <p className="text-[13px] text-[#86868b] font-medium mb-4">
                        Email Volume by Year
                      </p>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={yearly} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="year"
                            tick={{ fontSize: 13, fill: "#1d1d1f", fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "#86868b" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                          />
                          <Tooltip contentStyle={tooltipStyle}
                            formatter={(value, name) => [Number(value).toLocaleString(), name]}
                            labelFormatter={(label) => `Year ${label}`}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar
                            dataKey="received"
                            fill="#0071e3"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={48}
                            name="Received"
                          />
                          <Bar
                            dataKey="sent"
                            fill="#5ac8fa"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={48}
                            name="Sent"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Meetings by Year */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                      <p className="text-[13px] text-[#86868b] font-medium mb-4">
                        Meetings by Year — Recurring vs One-Off
                      </p>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={yearly} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="year"
                            tick={{ fontSize: 13, fill: "#1d1d1f", fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "#86868b" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip contentStyle={tooltipStyle}
                            formatter={(value, name) => [Number(value).toLocaleString(), name]}
                            labelFormatter={(label) => `Year ${label}`}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="recurringMeetings" fill="#ff9500" maxBarSize={48} stackId="meetings" name="Recurring" />
                          <Bar dataKey="oneOffMeetings" fill="#5856d6" radius={[6, 6, 0, 0]} maxBarSize={48} stackId="meetings" name="One-Off" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Meeting Hours by Year */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                      <p className="text-[13px] text-[#86868b] font-medium mb-4">
                        Meeting Hours by Year — Recurring vs One-Off
                      </p>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={yearly} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="year"
                            tick={{ fontSize: 13, fill: "#1d1d1f", fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "#86868b" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}h`}
                          />
                          <Tooltip contentStyle={tooltipStyle}
                            formatter={(value, name) => [`${Number(value).toLocaleString()}h`, name]}
                            labelFormatter={(label) => `Year ${label}`}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="recurringHours" fill="#ff9500" maxBarSize={48} stackId="hours" name="Recurring" />
                          <Bar dataKey="oneOffHours" fill="#5856d6" radius={[6, 6, 0, 0]} maxBarSize={48} stackId="hours" name="One-Off" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Year-over-Year Table */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                      <div className="px-5 pt-5 pb-3">
                        <p className="text-[13px] text-[#86868b] font-medium">
                          Year-over-Year Breakdown
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#f0f0f0]">
                              <th className="text-left px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">Year</th>
                              <th className="text-right px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">Received</th>
                              <th className="text-right px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">Sent</th>
                              <th className="text-right px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">Recurring</th>
                              <th className="text-right px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">One-Off</th>
                              <th className="text-right px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">Total Mtgs</th>
                              <th className="text-right px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">Hours</th>
                              <th className="text-right px-5 py-2.5 text-[11px] text-[#86868b] font-semibold uppercase tracking-wider">Email YoY</th>
                            </tr>
                          </thead>
                          <tbody>
                            {yearly.map((y, i) => {
                              const prev = i > 0 ? yearly[i - 1] : null;
                              const emailChange =
                                prev && prev.received > 0
                                  ? Math.round(((y.received - prev.received) / prev.received) * 100)
                                  : null;
                              return (
                                <tr key={y.year} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#f9f9f9] transition-colors">
                                  <td className="px-5 py-3 font-semibold">
                                    {y.year}
                                    {y.year === currentYear && (
                                      <span className="text-[10px] text-[#86868b] font-normal ml-1">YTD</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-3 text-right tabular-nums">{y.received.toLocaleString()}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{y.sent.toLocaleString()}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{y.recurringMeetings.toLocaleString()}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{y.oneOffMeetings.toLocaleString()}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{y.meetings.toLocaleString()}</td>
                                  <td className="px-5 py-3 text-right tabular-nums">{y.meetingHours.toLocaleString()}h</td>
                                  <td className="px-5 py-3 text-right">
                                    {emailChange !== null ? (
                                      <span
                                        className={`font-medium ${
                                          emailChange >= 0 ? "text-emerald-500" : "text-red-500"
                                        }`}
                                      >
                                        {emailChange > 0 ? "+" : ""}{emailChange}%
                                      </span>
                                    ) : (
                                      <span className="text-[#d1d1d6]">---</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Insights */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                        <p className="text-[13px] text-[#86868b] font-medium mb-3">Peaks</p>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Busiest Email Year</p>
                              <p className="text-xs text-[#86868b]">{peakEmailYear?.year}</p>
                            </div>
                            <p className="text-lg font-bold gradient-text">
                              {((peakEmailYear?.received || 0) + (peakEmailYear?.sent || 0)).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Most Meetings</p>
                              <p className="text-xs text-[#86868b]">{peakMeetingYear?.year}</p>
                            </div>
                            <p className="text-lg font-bold text-[#ff9500]">
                              {peakMeetingYear?.meetings.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Most Meeting Hours</p>
                              <p className="text-xs text-[#86868b]">{peakHoursYear?.year}</p>
                            </div>
                            <p className="text-lg font-bold text-[#5856d6]">
                              {peakHoursYear?.meetingHours.toLocaleString()}h
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                        <p className="text-[13px] text-[#86868b] font-medium mb-3">Averages</p>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Emails per Year</p>
                            <p className="text-lg font-bold">
                              {Math.round(fullYearEmails / fullYearCount).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Meeting Hours per Year</p>
                            <p className="text-lg font-bold">
                              {Math.round(fullYearHours / fullYearCount).toLocaleString()}h
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Recurring Meeting %</p>
                            <p className="text-lg font-bold text-[#ff9500]">
                              {recurringPct}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-[#e5e5e5]/60 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[11px] text-[#86868b]">
          <p>
            Auto-refreshes every 5 min \u00b7 Last updated{" "}
            {new Date(data.generatedAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <div className="flex items-center gap-4">
            {process.env.NEXT_PUBLIC_TWITTER_URL && (
              <a
                href={process.env.NEXT_PUBLIC_TWITTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#1d1d1f] transition-colors"
              >
                Twitter
              </a>
            )}
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL && (
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}
                className="hover:text-[#1d1d1f] transition-colors"
              >
                Email
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

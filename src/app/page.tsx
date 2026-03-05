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
              className="space-y-6"
            >
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
                <KpiCard
                  label="Meetings Today"
                  value={data.today.meetingsLeft}
                  sub={`${data.calendar.totalMeetingsThisWeek} this week`}
                  wow={meetingWow}
                />
                <KpiCard
                  label="Unread Emails"
                  value={data.email.unreadCount}
                  sub={`${data.today.sentEmails} sent today`}
                  accent={data.email.unreadCount > 50 ? "text-red-500" : ""}
                  wow={emailWow}
                />
                <KpiCard
                  label="Open Tasks"
                  value={data.tasks.totalOpen}
                  sub={
                    data.tasks.overdue > 0
                      ? `${data.tasks.overdue} overdue`
                      : `${data.tasks.totalCompleted} completed`
                  }
                  accent={data.tasks.overdue > 0 ? "text-orange-500" : ""}
                />
                <KpiCard
                  label="Meeting Hours"
                  value={`${data.calendar.meetingHoursThisWeek}h`}
                  sub="this week"
                  wow={hoursWow}
                />
              </div>

              {/* Next Meeting + Today's Schedule */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  {data.today.events.length > 0 ? (
                    <NextMeetingCard event={data.today.events[0]} />
                  ) : (
                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg card-hover">
                      <p className="text-[13px] text-white/50 font-medium">Today</p>
                      <p className="text-lg font-semibold mt-2">No more meetings</p>
                      <p className="text-sm text-white/70 mt-1">You have the rest of the day free</p>
                    </div>
                  )}
                </div>
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm card-hover">
                  <p className="text-[13px] text-[#86868b] font-medium mb-3">
                    Today&apos;s Schedule
                  </p>
                  {data.today.events.length > 0 ? (
                    <div className="space-y-3">
                      {data.today.events.map((event, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="text-sm text-[#86868b] w-20 shrink-0 text-right font-mono">
                            {event.start?.dateTime ? formatTime(event.start.dateTime) : "All day"}
                          </span>
                          <div className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{event.summary || "Untitled"}</p>
                              {event.hangoutLink && (
                                <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer"
                                  className="text-[#0071e3] text-xs font-medium shrink-0 hover:underline">Join</a>
                              )}
                            </div>
                            {event.attendees && event.attendees.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                {event.attendees.slice(0, 4).map((a, j) => (
                                  <div key={j} className="w-5 h-5 rounded-full bg-[#e5e5e5] flex items-center justify-center text-[9px] font-bold text-[#86868b] -ml-1 first:ml-0 ring-1 ring-white"
                                    title={a.displayName || a.email}>
                                    {(a.displayName || a.email).charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {event.attendees.length > 4 && (
                                  <span className="text-[10px] text-[#86868b] ml-1">+{event.attendees.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#86868b] text-sm py-4 text-center">No events scheduled today</p>
                  )}
                </div>
              </div>

              {/* Needs Attention + Overdue Tasks */}
              {(() => {
                const overdueTasks = data.tasks.lists
                  .flatMap((l) => l.open)
                  .filter((t) => t.due && new Date(t.due) < new Date());
                const importantUnread = data.email.recent.filter((e) => e.isUnread);
                const hasAttention = overdueTasks.length > 0 || importantUnread.length > 0;

                if (!hasAttention) return null;
                return (
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200/50 rounded-2xl p-5 shadow-sm">
                    <p className="text-[13px] font-semibold text-orange-800 mb-3">Needs Your Attention</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {overdueTasks.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-orange-600 font-semibold mb-2">Overdue Tasks</p>
                          <div className="space-y-2">
                            {overdueTasks.slice(0, 3).map((task) => (
                              <div key={task.id} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border-2 border-orange-400 shrink-0" />
                                <p className="text-sm font-medium truncate">{task.title}</p>
                                <span className="text-[10px] text-orange-500 font-medium shrink-0">
                                  {new Date(task.due!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {importantUnread.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-red-600 font-semibold mb-2">Unread from People</p>
                          <div className="space-y-2">
                            {importantUnread.slice(0, 3).map((email) => (
                              <div key={email.id} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#0071e3] shrink-0" />
                                <p className="text-sm font-medium truncate">{parseFromName(email.from)}</p>
                                <p className="text-[11px] text-[#86868b] truncate shrink-0">{formatRelative(email.date)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Follow Up + Week Ahead */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Follow Up */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-5 pt-5 pb-3">
                    <p className="text-[13px] text-[#86868b] font-medium">Follow Up</p>
                    <p className="text-[11px] text-[#86868b]">Recently sent — may need a response</p>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {data.recentSent.slice(0, 5).map((sent) => (
                      <div key={sent.id} className="px-5 py-3 hover:bg-[#f9f9f9] transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium truncate flex-1">
                            {parseFromName(sent.to)}
                          </p>
                          <span className="text-[11px] text-[#86868b] shrink-0">{formatRelative(sent.date)}</span>
                        </div>
                        <p className="text-[12px] text-[#1d1d1f]/60 truncate mt-0.5 ml-7">
                          {sent.subject || "(no subject)"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Week at a Glance */}
                <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                  <p className="text-[13px] text-[#86868b] font-medium mb-4">Week at a Glance</p>
                  <div className="space-y-3">
                    {data.calendar.weeklyData.map((day) => {
                      const isToday = day.day === new Date().toLocaleDateString("en-US", { weekday: "short" });
                      const maxMeetings = Math.max(...data.calendar.weeklyData.map((d) => d.meetings), 1);
                      return (
                        <div key={day.day} className={`flex items-center gap-3 ${isToday ? "bg-[#f0f7ff] -mx-2 px-2 py-1.5 rounded-lg" : ""}`}>
                          <span className={`text-sm w-10 shrink-0 font-mono ${isToday ? "font-bold text-[#0071e3]" : "text-[#86868b]"}`}>
                            {day.day}
                          </span>
                          <div className="flex-1 h-5 bg-[#f0f0f0] rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${isToday ? "bg-[#0071e3]" : "bg-[#1d1d1f]/20"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${(day.meetings / maxMeetings) * 100}%` }}
                              transition={{ duration: 0.6 }}
                            />
                          </div>
                          <span className={`text-xs tabular-nums w-14 text-right ${isToday ? "font-semibold" : "text-[#86868b]"}`}>
                            {day.meetings} mtg{day.meetings !== 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Top Contacts + Email Volume */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-5 pt-5 pb-3">
                    <p className="text-[13px] text-[#86868b] font-medium">Top Contacts</p>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {data.topContacts.slice(0, 5).map((contact, i) => {
                      const maxCount = data.topContacts[0]?.count || 1;
                      return (
                        <div key={contact.email} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071e3] to-[#5856d6] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{contact.name}</p>
                            <div className="mt-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-[#0071e3] to-[#5856d6] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(contact.count / maxCount) * 100}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1 }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-[#86868b] font-medium tabular-nums shrink-0">{contact.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm card-hover">
                  <p className="text-[13px] text-[#86868b] font-medium mb-4">Email Volume (7 Days)</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data.email.dailyStats}>
                      <defs>
                        <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0071e3" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#0071e3" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34c759" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#34c759" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="dayLabel" tick={{ fontSize: 12, fill: "#86868b" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="received" stroke="#0071e3" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" name="Received" />
                      <Area type="monotone" dataKey="sent" stroke="#34c759" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" name="Sent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Emails + Files */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                    <p className="text-[13px] text-[#86868b] font-medium">Recent Emails</p>
                    <button onClick={() => setTab("email")} className="text-[#0071e3] text-xs font-medium">View All</button>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {data.email.recent.slice(0, 5).map((email) => (
                      <div key={email.id} className="px-5 py-3 hover:bg-[#f9f9f9] transition-colors">
                        <div className="flex items-center gap-2">
                          {email.isUnread && <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3] shrink-0" />}
                          <p className={`text-sm truncate flex-1 ${email.isUnread ? "font-semibold" : "text-[#1d1d1f]/80"}`}>
                            {parseFromName(email.from)}
                          </p>
                          <span className="text-[11px] text-[#86868b] shrink-0">{formatRelative(email.date)}</span>
                        </div>
                        <p className="text-[13px] text-[#1d1d1f]/60 truncate mt-0.5">{email.subject || "(no subject)"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm overflow-hidden card-hover">
                  <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                    <p className="text-[13px] text-[#86868b] font-medium">Recent Files</p>
                    <button onClick={() => setTab("drive")} className="text-[#0071e3] text-xs font-medium">View All</button>
                  </div>
                  <div className="divide-y divide-[#f5f5f5]">
                    {data.drive.recentFiles.slice(0, 5).map((file) => (
                      <a key={file.id} href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                        className="px-5 py-3 flex items-center gap-3 hover:bg-[#f9f9f9] transition-colors block">
                        <div className={`w-2 h-2 rounded-full ${mimeDot(file.mimeType)} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-[11px] text-[#86868b]">{mimeLabel(file.mimeType)} \u00b7 {formatRelative(file.modifiedTime)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
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
            <a
              href="https://x.com/Trace_Cohen"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1d1d1f] transition-colors"
            >
              Twitter
            </a>
            <a
              href="mailto:t@nyvp.com"
              className="hover:text-[#1d1d1f] transition-colors"
            >
              Email
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

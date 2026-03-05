"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
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

interface DashboardData {
  user: { name: string; email: string; photo: string };
  today: {
    events: CalendarEvent[];
    meetingsLeft: number;
    sentEmails: number;
  };
  calendar: {
    upcoming: CalendarEvent[];
    weeklyData: { day: string; meetings: number; hours: number }[];
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
  generatedAt: string;
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

/* ─── Components ─── */
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <p className="text-[13px] text-[#86868b] font-medium">{label}</p>
      <p className={`text-3xl font-bold tracking-tight mt-1 ${accent || ""}`}>
        {value}
      </p>
      {sub && <p className="text-[12px] text-[#86868b] mt-1">{sub}</p>}
    </div>
  );
}

function NextMeetingCard({ event }: { event: CalendarEvent }) {
  const startTime = event.start?.dateTime;
  const attendeeCount = event.attendees?.length || 0;

  return (
    <div className="bg-gradient-to-br from-[#1d1d1f] to-[#2d2d2f] rounded-2xl p-5 text-white shadow-lg">
      <p className="text-[13px] text-white/50 font-medium">Next Meeting</p>
      <p className="text-lg font-semibold mt-2 leading-snug">
        {event.summary || "Untitled"}
      </p>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm text-white/70">
          {startTime ? `${formatTime(startTime)} · ${timeUntil(startTime)}` : "All day"}
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

/* ─── Main ─── */
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "calendar" | "email" | "drive" | "tasks">("overview");

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
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Auto-refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#86868b] text-sm">Loading dashboard...</p>
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

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "calendar" as const, label: "Calendar" },
    { id: "email" as const, label: "Email" },
    { id: "drive" as const, label: "Drive" },
    { id: "tasks" as const, label: "Tasks" },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fafafa]/80 backdrop-blur-xl border-b border-[#e5e5e5]/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {getGreeting()}, {firstName}
              </h1>
              <p className="text-[13px] text-[#86868b]">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
          <nav className="flex gap-1 mt-4 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tab === t.id
                    ? "bg-[#1d1d1f] text-white"
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
        {/* ─── OVERVIEW TAB ─── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Meetings Today"
                value={data.today.meetingsLeft}
                sub={`${data.calendar.totalMeetingsThisWeek} this week`}
              />
              <KpiCard
                label="Unread Emails"
                value={data.email.unreadCount}
                sub={`${data.today.sentEmails} sent today`}
                accent={data.email.unreadCount > 50 ? "text-red-500" : ""}
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
              />
            </div>

            {/* Next Meeting + Today's Agenda */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                {data.today.events.length > 0 ? (
                  <NextMeetingCard event={data.today.events[0]} />
                ) : (
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg">
                    <p className="text-[13px] text-white/50 font-medium">
                      Today
                    </p>
                    <p className="text-lg font-semibold mt-2">No more meetings</p>
                    <p className="text-sm text-white/70 mt-1">
                      You have the rest of the day free
                    </p>
                  </div>
                )}
              </div>
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-[13px] text-[#86868b] font-medium mb-3">
                  Today&apos;s Schedule
                </p>
                {data.today.events.length > 0 ? (
                  <div className="space-y-3">
                    {data.today.events.map((event, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-sm text-[#86868b] w-20 shrink-0 text-right font-mono">
                          {event.start?.dateTime
                            ? formatTime(event.start.dateTime)
                            : "All day"}
                        </span>
                        <div className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {event.summary || "Untitled"}
                          </p>
                          {event.hangoutLink && (
                            <a
                              href={event.hangoutLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0071e3] text-xs font-medium shrink-0 hover:underline"
                            >
                              Join
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#86868b] text-sm py-4 text-center">
                    No events scheduled today
                  </p>
                )}
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Meeting Load */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-[13px] text-[#86868b] font-medium mb-4">
                  Meeting Load This Week
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.calendar.weeklyData}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: "#86868b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#1d1d1f",
                        border: "none",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [
                        name === "hours" ? `${value}h` : value,
                        name === "hours" ? "Hours" : "Meetings",
                      ]}
                    />
                    <Bar
                      dataKey="meetings"
                      fill="#0071e3"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Email Volume */}
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-[13px] text-[#86868b] font-medium mb-4">
                  Email Volume (7 Days)
                </p>
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
                    <XAxis
                      dataKey="dayLabel"
                      tick={{ fontSize: 12, fill: "#86868b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#1d1d1f",
                        border: "none",
                        borderRadius: 10,
                        color: "#fff",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="received"
                      stroke="#0071e3"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorReceived)"
                      name="Received"
                    />
                    <Area
                      type="monotone"
                      dataKey="sent"
                      stroke="#34c759"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSent)"
                      name="Sent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Emails + Files */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <p className="text-[13px] text-[#86868b] font-medium">
                    Recent Emails
                  </p>
                  <button
                    onClick={() => setTab("email")}
                    className="text-[#0071e3] text-xs font-medium"
                  >
                    View All
                  </button>
                </div>
                <div className="divide-y divide-[#f5f5f5]">
                  {data.email.recent.slice(0, 5).map((email) => (
                    <div key={email.id} className="px-5 py-3 hover:bg-[#f9f9f9] transition-colors">
                      <div className="flex items-center gap-2">
                        {email.isUnread && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3] shrink-0" />
                        )}
                        <p
                          className={`text-sm truncate flex-1 ${
                            email.isUnread ? "font-semibold" : "text-[#1d1d1f]/80"
                          }`}
                        >
                          {parseFromName(email.from)}
                        </p>
                        <span className="text-[11px] text-[#86868b] shrink-0">
                          {formatRelative(email.date)}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#1d1d1f]/60 truncate mt-0.5">
                        {email.subject || "(no subject)"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <p className="text-[13px] text-[#86868b] font-medium">
                    Recent Files
                  </p>
                  <button
                    onClick={() => setTab("drive")}
                    className="text-[#0071e3] text-xs font-medium"
                  >
                    View All
                  </button>
                </div>
                <div className="divide-y divide-[#f5f5f5]">
                  {data.drive.recentFiles.slice(0, 5).map((file) => (
                    <a
                      key={file.id}
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-3 flex items-center gap-3 hover:bg-[#f9f9f9] transition-colors block"
                    >
                      <div className={`w-2 h-2 rounded-full ${mimeDot(file.mimeType)} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                          {mimeLabel(file.mimeType)} · {formatRelative(file.modifiedTime)}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── CALENDAR TAB ─── */}
        {tab === "calendar" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard
                label="Meetings This Week"
                value={data.calendar.totalMeetingsThisWeek}
              />
              <KpiCard
                label="Meeting Hours"
                value={`${data.calendar.meetingHoursThisWeek}h`}
              />
              <KpiCard
                label="Avg Per Day"
                value={`${Math.round((data.calendar.meetingHoursThisWeek / 5) * 10) / 10}h`}
                sub="weekdays"
              />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-[13px] text-[#86868b] font-medium mb-4">
                Weekly Meeting Load
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.calendar.weeklyData}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: "#86868b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#86868b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1d1d1f",
                      border: "none",
                      borderRadius: 10,
                      color: "#fff",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      name === "hours" ? `${value}h` : value,
                      name === "hours" ? "Hours" : "Meetings",
                    ]}
                  />
                  <Bar dataKey="meetings" fill="#0071e3" radius={[6, 6, 0, 0]} maxBarSize={40} name="Meetings" />
                  <Bar dataKey="hours" fill="#34c759" radius={[6, 6, 0, 0]} maxBarSize={40} name="Hours" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
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
          </div>
        )}

        {/* ─── EMAIL TAB ─── */}
        {tab === "email" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
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
                  <Tooltip
                    contentStyle={{
                      background: "#1d1d1f",
                      border: "none",
                      borderRadius: 10,
                      color: "#fff",
                      fontSize: 12,
                    }}
                  />
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

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
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
          </div>
        )}

        {/* ─── DRIVE TAB ─── */}
        {tab === "drive" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard label="Recent Files" value={data.drive.recentFiles.length} />
              <KpiCard
                label="Storage Used"
                value={formatBytes(data.drive.storageUsed)}
                sub={
                  data.drive.storageLimit !== "0"
                    ? `${storagePercent}% of ${formatBytes(data.drive.storageLimit)}`
                    : undefined
                }
              />
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-[13px] text-[#86868b] font-medium">Storage</p>
                <div className="mt-3">
                  <div className="w-full bg-[#f0f0f0] rounded-full h-2.5">
                    <div
                      className="bg-[#0071e3] h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(storagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#86868b] mt-2">{storagePercent}% used</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
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
                        {file.shared && " · Shared"}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#86868b] shrink-0">
                      {formatRelative(file.modifiedTime)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TASKS TAB ─── */}
        {tab === "tasks" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
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
              <div key={list.listName} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <p className="text-[13px] text-[#86868b] font-medium">
                    {list.listName}
                  </p>
                  <span className="text-[11px] text-[#86868b]">
                    {list.open.length} open · {list.completedCount} done
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
                                {isOverdue ? "Overdue · " : "Due "}
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
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-[#e5e5e5]/60 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[11px] text-[#86868b]">
          <p>
            Auto-refreshes every 5 min · Last updated{" "}
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

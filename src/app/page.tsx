"use client";

import { useEffect, useState } from "react";

interface CalendarEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  location?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
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
  tasks: TaskItem[];
}

interface DashboardData {
  calendar: CalendarEvent[];
  emails: Email[];
  unreadCount: number;
  files: DriveFile[];
  tasks: TaskList[];
  generatedAt: string;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function mimeIcon(mimeType: string) {
  if (mimeType.includes("spreadsheet")) return "table";
  if (mimeType.includes("document")) return "doc";
  if (mimeType.includes("presentation")) return "slides";
  if (mimeType.includes("folder")) return "folder";
  if (mimeType.includes("form")) return "form";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("image")) return "img";
  return "file";
}

function mimeColor(mimeType: string) {
  if (mimeType.includes("spreadsheet")) return "bg-green-100 text-green-700";
  if (mimeType.includes("document")) return "bg-blue-100 text-blue-700";
  if (mimeType.includes("presentation")) return "bg-yellow-100 text-yellow-700";
  if (mimeType.includes("folder")) return "bg-gray-100 text-gray-600";
  if (mimeType.includes("form")) return "bg-purple-100 text-purple-700";
  return "bg-gray-100 text-gray-600";
}

function parseFromName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.split("@")[0];
}

function groupEventsByDay(events: CalendarEvent[]) {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    const dateStr = event.start?.dateTime || event.start?.date || "";
    const day = formatDate(dateStr);
    if (!groups[day]) groups[day] = [];
    groups[day].push(event);
  }
  return groups;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"calendar" | "email" | "drive" | "tasks">("calendar");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#86868b] text-sm">Loading your workspace...</p>
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
        </div>
      </div>
    );
  }

  if (!data) return null;

  const dayGroups = groupEventsByDay(data.calendar);
  const totalTasks = data.tasks.reduce((sum, l) => sum + l.tasks.length, 0);

  const tabs = [
    { id: "calendar" as const, label: "Calendar", count: data.calendar.length },
    { id: "email" as const, label: "Email", count: data.unreadCount },
    { id: "drive" as const, label: "Drive", count: data.files.length },
    { id: "tasks" as const, label: "Tasks", count: totalTasks },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fafafa]/80 backdrop-blur-xl border-b border-[#e5e5e5]">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
            <p className="text-xs text-[#86868b] mt-0.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data.unreadCount > 0 && (
              <span className="bg-[#ff3b30] text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {data.unreadCount} unread
              </span>
            )}
            <button
              onClick={() => window.location.reload()}
              className="text-[#0071e3] text-sm font-medium hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl p-4 text-left transition-all ${
                activeTab === tab.id
                  ? "bg-[#1d1d1f] text-white shadow-lg scale-[1.02]"
                  : "bg-white text-[#1d1d1f] shadow-sm hover:shadow-md"
              }`}
            >
              <p className={`text-3xl font-bold tracking-tight ${activeTab === tab.id ? "text-white" : ""}`}>
                {tab.count}
              </p>
              <p className={`text-sm mt-1 ${activeTab === tab.id ? "text-white/70" : "text-[#86868b]"}`}>
                {tab.label}
              </p>
            </button>
          ))}
        </div>

        {/* Calendar View */}
        {activeTab === "calendar" && (
          <section>
            <h2 className="text-lg font-semibold mb-4">This Week</h2>
            <div className="space-y-6">
              {Object.entries(dayGroups).map(([day, events]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">{day}</p>
                  <div className="space-y-2">
                    {events.map((event, i) => {
                      const startTime = event.start?.dateTime
                        ? formatTime(event.start.dateTime)
                        : "All day";
                      const endTime = event.end?.dateTime ? formatTime(event.end.dateTime) : "";
                      return (
                        <div
                          key={i}
                          className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{event.summary || "Untitled"}</p>
                              <p className="text-sm text-[#86868b] mt-0.5">
                                {startTime}{endTime ? ` - ${endTime}` : ""}
                              </p>
                              {event.location && (
                                <p className="text-xs text-[#86868b] mt-1 truncate">{event.location}</p>
                              )}
                            </div>
                            {event.hangoutLink && (
                              <a
                                href={event.hangoutLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-3 shrink-0 bg-[#0071e3] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#0077ED] transition-colors"
                              >
                                Join
                              </a>
                            )}
                          </div>
                          {event.attendees && event.attendees.length > 1 && (
                            <div className="flex items-center gap-1 mt-2">
                              <span className="text-xs text-[#86868b]">
                                {event.attendees.length} attendees
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {data.calendar.length === 0 && (
                <p className="text-[#86868b] text-sm text-center py-8">No events this week</p>
              )}
            </div>
          </section>
        )}

        {/* Email View */}
        {activeTab === "email" && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Recent Emails</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#f0f0f0]">
              {data.emails.map((email) => (
                <div
                  key={email.id}
                  className="p-4 hover:bg-[#f9f9f9] transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    {email.isUnread && (
                      <div className="w-2 h-2 rounded-full bg-[#0071e3] mt-2 shrink-0" />
                    )}
                    {!email.isUnread && <div className="w-2 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${email.isUnread ? "font-semibold" : "font-medium text-[#1d1d1f]/80"}`}>
                          {parseFromName(email.from)}
                        </p>
                        <span className="text-xs text-[#86868b] shrink-0">
                          {formatRelative(email.date)}
                        </span>
                      </div>
                      <p className={`text-sm truncate mt-0.5 ${email.isUnread ? "font-medium" : "text-[#1d1d1f]/70"}`}>
                        {email.subject || "(no subject)"}
                      </p>
                      <p className="text-xs text-[#86868b] truncate mt-0.5">
                        {email.snippet}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {data.emails.length === 0 && (
                <p className="text-[#86868b] text-sm text-center py-8">No recent emails</p>
              )}
            </div>
          </section>
        )}

        {/* Drive View */}
        {activeTab === "drive" && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Recent Files</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.files.map((file) => (
                <a
                  key={file.id}
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md shrink-0 ${mimeColor(file.mimeType)}`}
                    >
                      {mimeIcon(file.mimeType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-[#0071e3] transition-colors">
                        {file.name}
                      </p>
                      <p className="text-xs text-[#86868b] mt-1">
                        Modified {formatRelative(file.modifiedTime)}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Tasks View */}
        {activeTab === "tasks" && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Tasks</h2>
            {data.tasks.map((list) => (
              <div key={list.listName} className="mb-6">
                {data.tasks.length > 1 && (
                  <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">
                    {list.listName}
                  </p>
                )}
                {list.tasks.length > 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#f0f0f0]">
                    {list.tasks.map((task) => (
                      <div key={task.id} className="p-4 flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-[#d1d1d6] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{task.title}</p>
                          {task.due && (
                            <p className="text-xs text-[#86868b] mt-0.5">
                              Due {formatDate(task.due)}
                            </p>
                          )}
                          {task.notes && (
                            <p className="text-xs text-[#86868b] mt-0.5 truncate">{task.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#86868b] text-sm text-center py-8 bg-white rounded-2xl">
                    No open tasks
                  </p>
                )}
              </div>
            ))}
            {data.tasks.length === 0 && (
              <p className="text-[#86868b] text-sm text-center py-8">No task lists found</p>
            )}
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-[#e5e5e5] py-6">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-xs text-[#86868b]">
          <p>
            Last updated {new Date(data.generatedAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/Trace_Cohen" target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition-colors">
              Twitter
            </a>
            <a href="mailto:t@nyvp.com" className="hover:text-[#1d1d1f] transition-colors">
              Email
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

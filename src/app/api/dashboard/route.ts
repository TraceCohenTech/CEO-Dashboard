import { NextResponse } from "next/server";
import { getCalendar, getDrive, getGmail, getTasks } from "@/lib/google";

export const dynamic = "force-dynamic";

async function getCalendarEvents() {
  const calendar = getCalendar();
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: weekEnd.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 25,
  });
  return res.data.items || [];
}

async function getRecentEmails() {
  const gmail = getGmail();
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 10,
    q: "is:inbox",
  });

  const messages = list.data.messages || [];
  const details = await Promise.all(
    messages.slice(0, 8).map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = detail.data.payload?.headers || [];
      return {
        id: msg.id,
        from: headers.find((h) => h.name === "From")?.value || "",
        subject: headers.find((h) => h.name === "Subject")?.value || "",
        date: headers.find((h) => h.name === "Date")?.value || "",
        snippet: detail.data.snippet || "",
        isUnread: detail.data.labelIds?.includes("UNREAD") || false,
      };
    })
  );

  const profile = await gmail.users.getProfile({ userId: "me" });
  return { emails: details, totalUnread: profile.data.messagesTotal || 0 };
}

async function getUnreadCount() {
  const gmail = getGmail();
  const res = await gmail.users.labels.get({
    userId: "me",
    id: "UNREAD",
  });
  return res.data.messagesUnread || 0;
}

async function getRecentFiles() {
  const drive = getDrive();
  const res = await drive.files.list({
    pageSize: 8,
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink)",
    q: "trashed = false",
  });
  return res.data.files || [];
}

async function getTaskLists() {
  const tasks = getTasks();
  const res = await tasks.tasklists.list({ maxResults: 10 });
  const lists = res.data.items || [];

  const allTasks = await Promise.all(
    lists.map(async (list) => {
      const taskRes = await tasks.tasks.list({
        tasklist: list.id!,
        maxResults: 10,
        showCompleted: false,
      });
      return {
        listName: list.title,
        tasks: (taskRes.data.items || []).map((t) => ({
          id: t.id,
          title: t.title,
          due: t.due,
          status: t.status,
          notes: t.notes,
        })),
      };
    })
  );
  return allTasks;
}

export async function GET() {
  try {
    const [events, emailData, unreadCount, files, taskLists] =
      await Promise.all([
        getCalendarEvents(),
        getRecentEmails(),
        getUnreadCount(),
        getRecentFiles(),
        getTaskLists(),
      ]);

    return NextResponse.json({
      calendar: events,
      emails: emailData.emails,
      unreadCount,
      files,
      tasks: taskLists,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Dashboard API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

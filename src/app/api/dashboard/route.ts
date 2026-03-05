import { NextResponse } from "next/server";
import { getCalendar, getDrive, getGmail, getTasks } from "@/lib/google";

export const dynamic = "force-dynamic";

async function getTodayEvents() {
  const calendar = getCalendar();
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });
  return res.data.items || [];
}

async function getWeekEvents() {
  const calendar = getCalendar();
  const now = new Date();
  // Start from Monday of current week
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfWeek.toISOString(),
    timeMax: endOfWeek.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });
  return res.data.items || [];
}

async function getUpcomingEvents() {
  const calendar = getCalendar();
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: nextWeek.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });
  return res.data.items || [];
}

async function getEmailStats() {
  const gmail = getGmail();

  // Get counts for the last 7 days
  const dailyCounts = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = `${nextDate.getFullYear()}/${String(nextDate.getMonth() + 1).padStart(2, "0")}/${String(nextDate.getDate()).padStart(2, "0")}`;

      return Promise.all([
        gmail.users.messages.list({
          userId: "me",
          q: `after:${dateStr} before:${nextDateStr}`,
          maxResults: 1,
        }),
        gmail.users.messages.list({
          userId: "me",
          q: `in:sent after:${dateStr} before:${nextDateStr}`,
          maxResults: 1,
        }),
      ]).then(([received, sent]) => ({
        date: date.toISOString().split("T")[0],
        dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
        received: received.data.resultSizeEstimate || 0,
        sent: sent.data.resultSizeEstimate || 0,
      }));
    })
  );

  return dailyCounts;
}

async function getRecentEmails() {
  const gmail = getGmail();
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 12,
    q: "is:inbox",
  });

  const messages = list.data.messages || [];
  const details = await Promise.all(
    messages.slice(0, 10).map(async (msg) => {
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
        labels: detail.data.labelIds || [],
      };
    })
  );

  return details;
}

async function getUnreadCount() {
  const gmail = getGmail();
  const res = await gmail.users.labels.get({
    userId: "me",
    id: "INBOX",
  });
  return {
    unread: res.data.messagesUnread || 0,
    total: res.data.messagesTotal || 0,
  };
}

async function getSentTodayCount() {
  const gmail = getGmail();
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
  const res = await gmail.users.messages.list({
    userId: "me",
    q: `in:sent after:${dateStr}`,
    maxResults: 1,
  });
  return res.data.resultSizeEstimate || 0;
}

async function getRecentFiles() {
  const drive = getDrive();
  const res = await drive.files.list({
    pageSize: 12,
    orderBy: "modifiedTime desc",
    fields:
      "files(id,name,mimeType,modifiedTime,createdTime,webViewLink,iconLink,owners,shared,size)",
    q: "trashed = false",
  });
  return res.data.files || [];
}

async function getDriveStats() {
  const drive = getDrive();
  const about = await drive.about.get({
    fields: "storageQuota,user",
  });
  return {
    storageUsed: about.data.storageQuota?.usage || "0",
    storageLimit: about.data.storageQuota?.limit || "0",
    userName: about.data.user?.displayName || "",
    userEmail: about.data.user?.emailAddress || "",
    userPhoto: about.data.user?.photoLink || "",
  };
}

async function getTaskLists() {
  const tasks = getTasks();
  const res = await tasks.tasklists.list({ maxResults: 10 });
  const lists = res.data.items || [];

  const allTasks = await Promise.all(
    lists.map(async (list) => {
      const [openRes, completedRes] = await Promise.all([
        tasks.tasks.list({
          tasklist: list.id!,
          maxResults: 100,
          showCompleted: false,
        }),
        tasks.tasks.list({
          tasklist: list.id!,
          maxResults: 100,
          showCompleted: true,
          showHidden: true,
        }),
      ]);

      const openTasks = (openRes.data.items || []).filter(
        (t) => t.title && t.title.trim()
      );
      const allTaskItems = (completedRes.data.items || []).filter(
        (t) => t.title && t.title.trim()
      );
      const completedTasks = allTaskItems.filter(
        (t) => t.status === "completed"
      );

      return {
        listName: list.title,
        listId: list.id,
        open: openTasks.map((t) => ({
          id: t.id,
          title: t.title,
          due: t.due,
          status: t.status,
          notes: t.notes,
          updated: t.updated,
        })),
        completedCount: completedTasks.length,
        totalCount: allTaskItems.length,
      };
    })
  );
  return allTasks;
}

export async function GET() {
  try {
    const [
      todayEvents,
      weekEvents,
      upcomingEvents,
      emailStats,
      recentEmails,
      inboxData,
      sentToday,
      files,
      driveStats,
      taskLists,
    ] = await Promise.all([
      getTodayEvents(),
      getWeekEvents(),
      getUpcomingEvents(),
      getEmailStats(),
      getRecentEmails(),
      getUnreadCount(),
      getSentTodayCount(),
      getRecentFiles(),
      getDriveStats(),
      getTaskLists(),
    ]);

    // Calculate meeting hours this week
    const meetingMinutes = weekEvents.reduce((total, event) => {
      const start = event.start?.dateTime;
      const end = event.end?.dateTime;
      if (!start || !end) return total;
      return total + (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    }, 0);

    // Meetings per day this week
    const meetingsByDay: Record<string, number> = {};
    const meetingHoursByDay: Record<string, number> = {};
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    days.forEach((d) => {
      meetingsByDay[d] = 0;
      meetingHoursByDay[d] = 0;
    });
    weekEvents.forEach((event) => {
      const dateStr = event.start?.dateTime || event.start?.date;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const dayName = days[(d.getDay() + 6) % 7]; // Monday = 0
      meetingsByDay[dayName] = (meetingsByDay[dayName] || 0) + 1;
      if (event.start?.dateTime && event.end?.dateTime) {
        const mins =
          (new Date(event.end.dateTime).getTime() -
            new Date(event.start.dateTime).getTime()) /
          60000;
        meetingHoursByDay[dayName] = (meetingHoursByDay[dayName] || 0) + mins / 60;
      }
    });

    const weeklyMeetingData = days.map((day) => ({
      day,
      meetings: meetingsByDay[day] || 0,
      hours: Math.round((meetingHoursByDay[day] || 0) * 10) / 10,
    }));

    // Total open tasks
    const totalOpenTasks = taskLists.reduce(
      (sum, l) => sum + l.open.length,
      0
    );
    const totalCompletedTasks = taskLists.reduce(
      (sum, l) => sum + l.completedCount,
      0
    );

    // Overdue tasks
    const now = new Date();
    const overdueTasks = taskLists
      .flatMap((l) => l.open)
      .filter((t) => t.due && new Date(t.due) < now);

    return NextResponse.json({
      user: {
        name: driveStats.userName,
        email: driveStats.userEmail,
        photo: driveStats.userPhoto,
      },
      today: {
        events: todayEvents,
        meetingsLeft: todayEvents.length,
        sentEmails: sentToday,
      },
      calendar: {
        upcoming: upcomingEvents,
        weeklyData: weeklyMeetingData,
        totalMeetingsThisWeek: weekEvents.length,
        meetingHoursThisWeek: Math.round((meetingMinutes / 60) * 10) / 10,
      },
      email: {
        recent: recentEmails,
        unreadCount: inboxData.unread,
        inboxTotal: inboxData.total,
        dailyStats: emailStats,
      },
      drive: {
        recentFiles: files,
        storageUsed: driveStats.storageUsed,
        storageLimit: driveStats.storageLimit,
      },
      tasks: {
        lists: taskLists,
        totalOpen: totalOpenTasks,
        totalCompleted: totalCompletedTasks,
        overdue: overdueTasks.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Dashboard API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

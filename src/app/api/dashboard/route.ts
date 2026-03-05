import { NextResponse } from "next/server";
import { getCalendar, getDrive, getGmail, getTasks } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

async function countMessages(
  gmail: ReturnType<typeof getGmail>,
  query: string
): Promise<number> {
  let count = 0;
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 500,
      pageToken,
      fields: "nextPageToken,messages(id)",
    });
    count += (res.data.messages || []).length;
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return count;
}

async function getEmailStats() {
  const gmail = getGmail();

  const dailyCounts = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = `${nextDate.getFullYear()}/${String(nextDate.getMonth() + 1).padStart(2, "0")}/${String(nextDate.getDate()).padStart(2, "0")}`;

      return Promise.all([
        countMessages(gmail, `after:${dateStr} before:${nextDateStr}`),
        countMessages(gmail, `in:sent after:${dateStr} before:${nextDateStr}`),
      ]).then(([received, sent]) => ({
        date: date.toISOString().split("T")[0],
        dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
        received,
        sent,
      }));
    })
  );

  return dailyCounts;
}

const EMAIL_CATEGORIES = {
  dealFlow: {
    label: "Deal Flow",
    query: 'subject:(pitch OR deck OR raising OR fundraise OR "seed round" OR "pre-seed" OR "series a" OR "series b" OR startup OR "looking for funding" OR "investment opportunity")',
  },
  intros: {
    label: "Intros",
    query: 'subject:(intro OR introduction OR "want to connect" OR "double opt" OR "warm intro" OR "connecting you")',
  },
  portfolio: {
    label: "Portfolio Updates",
    query: 'subject:("investor update" OR "monthly update" OR "quarterly update" OR "portfolio update" OR "board deck")',
  },
  newsletters: {
    label: "Newsletters",
    query: "has:unsubscribe -subject:(intro OR pitch OR deck OR raising)",
  },
};

async function getEmailCategories() {
  const gmail = getGmail();

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateFilter = `after:${thirtyDaysAgo.getFullYear()}/${String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0")}/${String(thirtyDaysAgo.getDate()).padStart(2, "0")}`;

  const categories = await Promise.all(
    Object.entries(EMAIL_CATEGORIES).map(async ([key, { label, query }]) => {
      const fullQuery = `${query} ${dateFilter}`;
      const count = await countMessages(gmail, fullQuery);

      // Fetch a few recent ones for preview
      const list = await gmail.users.messages.list({
        userId: "me",
        q: fullQuery,
        maxResults: 5,
      });

      const messages = list.data.messages || [];
      const previews = await Promise.all(
        messages.slice(0, 5).map(async (msg) => {
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
          };
        })
      );

      return { key, label, count, previews };
    })
  );

  // Count total inbox last 30 days to calculate "Other/Direct"
  const totalInbox = await countMessages(gmail, `in:inbox ${dateFilter}`);
  const categorizedTotal = categories.reduce((s, c) => s + c.count, 0);

  return {
    categories,
    otherCount: Math.max(0, totalInbox - categorizedTotal),
    totalInbox,
    period: "Last 30 days",
  };
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
  return countMessages(gmail, `in:sent after:${dateStr}`);
}

async function getRecentSent() {
  const gmail = getGmail();
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 8,
    q: "in:sent",
    fields: "messages(id)",
  });
  const messages = list.data.messages || [];
  const details = await Promise.all(
    messages.slice(0, 8).map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["To", "Subject", "Date"],
      });
      const headers = detail.data.payload?.headers || [];
      return {
        id: msg.id,
        to: headers.find((h) => h.name === "To")?.value || "",
        subject: headers.find((h) => h.name === "Subject")?.value || "",
        date: headers.find((h) => h.name === "Date")?.value || "",
        snippet: detail.data.snippet || "",
      };
    })
  );
  return details;
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

async function getTopContacts() {
  const gmail = getGmail();
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 100,
    q: "is:inbox",
    fields: "messages(id)",
  });
  const messages = list.data.messages || [];
  const froms = await Promise.all(
    messages.slice(0, 40).map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From"],
      });
      return detail.data.payload?.headers?.find((h) => h.name === "From")?.value || "";
    })
  );

  const counts: Record<string, { name: string; email: string; count: number }> = {};
  for (const from of froms) {
    const emailMatch = from.match(/<([^>]+)>/);
    const addr = emailMatch ? emailMatch[1].toLowerCase() : from.toLowerCase();
    const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
    const name = nameMatch ? nameMatch[1].trim() : addr.split("@")[0];
    if (!counts[addr]) counts[addr] = { name, email: addr, count: 0 };
    counts[addr].count++;
  }

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

async function getLastWeekStats() {
  const gmail = getGmail();
  const calendar = getCalendar();
  const now = new Date();

  const lwEnd = new Date(now);
  lwEnd.setDate(lwEnd.getDate() - 7);
  const lwStart = new Date(lwEnd);
  lwStart.setDate(lwStart.getDate() - 7);

  const lwStartStr = `${lwStart.getFullYear()}/${String(lwStart.getMonth() + 1).padStart(2, "0")}/${String(lwStart.getDate()).padStart(2, "0")}`;
  const lwEndStr = `${lwEnd.getFullYear()}/${String(lwEnd.getMonth() + 1).padStart(2, "0")}/${String(lwEnd.getDate()).padStart(2, "0")}`;

  const [received, calRes] = await Promise.all([
    countMessages(gmail, `after:${lwStartStr} before:${lwEndStr}`),
    calendar.events.list({
      calendarId: "primary",
      timeMin: lwStart.toISOString(),
      timeMax: lwEnd.toISOString(),
      singleEvents: true,
      maxResults: 200,
      fields: "items(start,end)",
    }),
  ]);

  const events = calRes.data.items || [];
  const meetingMins = events.reduce((total, e) => {
    if (!e.start?.dateTime || !e.end?.dateTime) return total;
    return total + (new Date(e.end.dateTime).getTime() - new Date(e.start.dateTime).getTime()) / 60000;
  }, 0);

  return {
    received,
    meetings: events.filter((e) => e.start?.dateTime).length,
    meetingHours: Math.round((meetingMins / 60) * 10) / 10,
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
      emailCategories,
      topContacts,
      lastWeek,
      recentSent,
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
      getEmailCategories(),
      getTopContacts(),
      getLastWeekStats(),
      getRecentSent(),
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

    const WORK_HOURS = 9; // 9am-6pm
    const weeklyMeetingData = days.map((day) => ({
      day,
      meetings: meetingsByDay[day] || 0,
      hours: Math.round((meetingHoursByDay[day] || 0) * 10) / 10,
      focusHours: Math.round((WORK_HOURS - (meetingHoursByDay[day] || 0)) * 10) / 10,
    }));

    // Busiest hours of the day
    const hourCounts: Record<number, number> = {};
    weekEvents.forEach((event) => {
      if (!event.start?.dateTime) return;
      const hour = new Date(event.start.dateTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const busiestHours = Array.from({ length: 12 }, (_, i) => i + 7).map((hour) => ({
      hour,
      label: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "p" : "a"}`,
      count: hourCounts[hour] || 0,
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
      emailCategories,
      topContacts,
      lastWeek,
      busiestHours,
      recentSent,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Dashboard API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

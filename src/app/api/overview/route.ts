import { NextResponse } from "next/server";
import { getCalendar, getGmail } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

interface AttendeeEmailThread {
  attendeeEmail: string;
  attendeeName: string;
  threads: {
    subject: string;
    snippet: string;
    date: string;
  }[];
}

interface UpcomingEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  location?: string;
  description?: string;
  conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
  }[];
}

async function getNext48HoursEvents(): Promise<UpcomingEvent[]> {
  const calendar = getCalendar();
  const now = new Date();
  const end = new Date(now);
  end.setHours(end.getHours() + 48);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 30,
    fields:
      "items(summary,start,end,hangoutLink,location,description,conferenceData,attendees)",
  });
  return (res.data.items || []) as UpcomingEvent[];
}

async function getAttendeeEmailHistory(
  attendeeEmails: string[],
  userEmail: string
): Promise<AttendeeEmailThread[]> {
  const gmail = getGmail();
  const results: AttendeeEmailThread[] = [];

  // Deduplicate and exclude self
  const uniqueEmails = [
    ...new Set(
      attendeeEmails
        .map((e) => e.toLowerCase())
        .filter((e) => e !== userEmail.toLowerCase())
    ),
  ];

  // Limit to first 10 unique attendees to stay within rate limits
  const emailsToSearch = uniqueEmails.slice(0, 10);

  const searches = await Promise.allSettled(
    emailsToSearch.map(async (email) => {
      const list = await gmail.users.messages.list({
        userId: "me",
        q: `from:${email} OR to:${email}`,
        maxResults: 5,
        fields: "messages(id)",
      });

      const messages = list.data.messages || [];
      if (messages.length === 0) {
        return { attendeeEmail: email, attendeeName: email.split("@")[0], threads: [] };
      }

      const details = await Promise.all(
        messages.slice(0, 3).map(async (msg) => {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"],
          });
          const headers = detail.data.payload?.headers || [];
          return {
            subject: headers.find((h) => h.name === "Subject")?.value || "",
            snippet: detail.data.snippet || "",
            date: headers.find((h) => h.name === "Date")?.value || "",
          };
        })
      );

      return {
        attendeeEmail: email,
        attendeeName: email.split("@")[0],
        threads: details,
      };
    })
  );

  for (const result of searches) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    }
  }

  return results;
}

async function getPendingFollowUps() {
  const gmail = getGmail();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const dateStr = `${sevenDaysAgo.getFullYear()}/${String(sevenDaysAgo.getMonth() + 1).padStart(2, "0")}/${String(sevenDaysAgo.getDate()).padStart(2, "0")}`;
  const threeDaysStr = `${threeDaysAgo.getFullYear()}/${String(threeDaysAgo.getMonth() + 1).padStart(2, "0")}/${String(threeDaysAgo.getDate()).padStart(2, "0")}`;

  // Get sent emails from 3-7 days ago
  const sentList = await gmail.users.messages.list({
    userId: "me",
    q: `in:sent after:${dateStr} before:${threeDaysStr}`,
    maxResults: 20,
    fields: "messages(id,threadId)",
  });

  const sentMessages = sentList.data.messages || [];
  if (sentMessages.length === 0) return [];

  // For each sent message, check if there's a reply in the thread
  const followUps = await Promise.allSettled(
    sentMessages.slice(0, 15).map(async (msg) => {
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: msg.threadId!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
        fields: "messages(id,payload/headers,labelIds)",
      });

      const messages = thread.data.messages || [];
      // Find our sent message index
      const sentIdx = messages.findIndex((m) => m.id === msg.id);
      if (sentIdx === -1) return null;

      // Check if there's any message after ours (a reply)
      const hasReply = messages.slice(sentIdx + 1).length > 0;
      if (hasReply) return null;

      // No reply — this is a pending follow-up
      const headers = messages[sentIdx].payload?.headers || [];
      return {
        id: msg.id,
        to: headers.find((h) => h.name === "To")?.value || "",
        subject: headers.find((h) => h.name === "Subject")?.value || "",
        date: headers.find((h) => h.name === "Date")?.value || "",
      };
    })
  );

  const results: { id: string | null | undefined; to: string; subject: string; date: string }[] = [];
  for (const r of followUps) {
    if (r.status === "fulfilled" && r.value !== null) {
      results.push(r.value);
    }
  }
  return results.slice(0, 8);
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 23000);

    const [events, followUps] = await Promise.all([
      getNext48HoursEvents(),
      getPendingFollowUps().catch(() => []),
    ]);

    // Get attendee emails from next 3 meetings with external attendees
    const meetingsWithAttendees = events
      .filter(
        (e) =>
          e.attendees &&
          e.attendees.filter((a) => !a.self).length > 0
      )
      .slice(0, 3);

    const allAttendeeEmails = meetingsWithAttendees.flatMap(
      (e) =>
        (e.attendees || [])
          .filter((a) => !a.self)
          .map((a) => a.email)
    );

    // Get user email from first event's self attendee
    const userEmail =
      events
        .flatMap((e) => e.attendees || [])
        .find((a) => a.self)?.email || "";

    let attendeeHistory: AttendeeEmailThread[] = [];
    try {
      attendeeHistory = await getAttendeeEmailHistory(
        allAttendeeEmails,
        userEmail
      );
    } catch {
      // Partial data fallback
    }

    clearTimeout(timeout);

    return NextResponse.json({
      upcomingEvents: events,
      meetingPrep: meetingsWithAttendees.map((meeting) => ({
        summary: meeting.summary,
        start: meeting.start,
        end: meeting.end,
        hangoutLink: meeting.hangoutLink,
        location: meeting.location,
        attendees: (meeting.attendees || [])
          .filter((a) => !a.self)
          .map((a) => ({
            email: a.email,
            displayName: a.displayName,
            responseStatus: a.responseStatus,
            emailHistory:
              attendeeHistory.find(
                (h) => h.attendeeEmail === a.email.toLowerCase()
              )?.threads || [],
          })),
      })),
      pendingFollowUps: followUps,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Overview API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

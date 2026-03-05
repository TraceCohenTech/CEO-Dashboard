import { NextResponse } from "next/server";
import { getCalendar, getGmail } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

const START_YEAR = 2020;

function years(): number[] {
  const now = new Date().getFullYear();
  const result: number[] = [];
  for (let y = START_YEAR; y <= now; y++) result.push(y);
  return result;
}

async function countEmails(
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

async function getYearEmailCounts(
  gmail: ReturnType<typeof getGmail>,
  year: number
) {
  const after = `${year}/01/01`;
  const before = `${year + 1}/01/01`;

  const [received, sent] = await Promise.all([
    countEmails(gmail, `after:${after} before:${before}`),
    countEmails(gmail, `in:sent after:${after} before:${before}`),
  ]);

  return { received, sent };
}

async function getYearCalendarStats(
  calendar: ReturnType<typeof getCalendar>,
  year: number
) {
  const timeMin = `${year}-01-01T00:00:00Z`;
  const timeMax = `${year + 1}-01-01T00:00:00Z`;

  let totalEvents = 0;
  let totalMinutes = 0;
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 2500,
      pageToken,
      fields: "nextPageToken,items(start,end,status)",
    });

    for (const event of res.data.items || []) {
      if (event.status === "cancelled") continue;
      totalEvents++;
      if (event.start?.dateTime && event.end?.dateTime) {
        const mins =
          (new Date(event.end.dateTime).getTime() -
            new Date(event.start.dateTime).getTime()) /
          60000;
        totalMinutes += mins;
      }
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return {
    meetings: totalEvents,
    hours: Math.round((totalMinutes / 60) * 10) / 10,
  };
}

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const gmail = getGmail();
    const calendar = getCalendar();
    const allYears = years();

    // Process 2 years at a time to stay within limits
    const yearly: {
      year: number;
      received: number;
      sent: number;
      meetings: number;
      meetingHours: number;
    }[] = [];

    for (let i = 0; i < allYears.length; i += 2) {
      const batch = allYears.slice(i, i + 2);
      const results = await Promise.all(
        batch.map(async (year) => {
          const [email, cal] = await Promise.all([
            getYearEmailCounts(gmail, year),
            getYearCalendarStats(calendar, year),
          ]);
          return {
            year,
            received: email.received,
            sent: email.sent,
            meetings: cal.meetings,
            meetingHours: cal.hours,
          };
        })
      );
      yearly.push(...results);
    }

    yearly.sort((a, b) => a.year - b.year);

    const totalEmails = yearly.reduce((s, y) => s + y.received + y.sent, 0);
    const totalMeetings = yearly.reduce((s, y) => s + y.meetings, 0);
    const totalHours =
      Math.round(yearly.reduce((s, y) => s + y.meetingHours, 0) * 10) / 10;

    const responseData = {
      yearly,
      totalEmails,
      totalMeetings,
      totalMeetingHours: totalHours,
      generatedAt: new Date().toISOString(),
    };

    cache = { data: responseData, timestamp: Date.now() };
    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("History API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

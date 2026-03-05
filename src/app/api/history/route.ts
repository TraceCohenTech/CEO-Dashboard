import { NextResponse } from "next/server";
import { getCalendar, getGmail } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// In-memory cache (persists across warm invocations on Vercel)
let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

function monthRange(startYear: number): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? 1 : 1;
    const mEnd = y === endYear ? endMonth : 12;
    for (let m = mStart; m <= mEnd; m++) {
      months.push({ year: y, month: m });
    }
  }
  return months;
}

function dateStr(y: number, m: number, d: number) {
  return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00Z`;
}

function lastDay(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

async function getEmailCountsForMonth(
  gmail: ReturnType<typeof getGmail>,
  year: number,
  month: number
) {
  const startDate = dateStr(year, month, 1);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = dateStr(nextYear, nextMonth, 1);

  const [receivedRes, sentRes] = await Promise.all([
    gmail.users.messages.list({
      userId: "me",
      q: `after:${startDate} before:${endDate}`,
      maxResults: 1,
    }),
    gmail.users.messages.list({
      userId: "me",
      q: `in:sent after:${startDate} before:${endDate}`,
      maxResults: 1,
    }),
  ]);

  return {
    received: receivedRes.data.resultSizeEstimate || 0,
    sent: sentRes.data.resultSizeEstimate || 0,
  };
}

async function getCalendarCountForMonth(
  calendar: ReturnType<typeof getCalendar>,
  year: number,
  month: number
) {
  const timeMin = isoDate(year, month, 1);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const timeMax = isoDate(nextYear, nextMonth, 1);

  let totalEvents = 0;
  let totalMinutes = 0;
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 250,
      pageToken,
      fields:
        "nextPageToken,items(start,end,status,attendees)",
    });

    const items = res.data.items || [];
    for (const event of items) {
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
  // Return cache if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const gmail = getGmail();
    const calendar = getCalendar();
    const months = monthRange(2020);

    // Process in batches of 6 to avoid rate limits
    const results: {
      year: number;
      month: number;
      label: string;
      received: number;
      sent: number;
      meetings: number;
      meetingHours: number;
    }[] = [];

    const batchSize = 6;
    for (let i = 0; i < months.length; i += batchSize) {
      const batch = months.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async ({ year, month }) => {
          const [emailCounts, calCounts] = await Promise.all([
            getEmailCountsForMonth(gmail, year, month),
            getCalendarCountForMonth(calendar, year, month),
          ]);
          const monthName = new Date(year, month - 1).toLocaleDateString(
            "en-US",
            { month: "short" }
          );
          return {
            year,
            month,
            label: `${monthName} ${year}`,
            received: emailCounts.received,
            sent: emailCounts.sent,
            meetings: calCounts.meetings,
            meetingHours: calCounts.hours,
          };
        })
      );
      results.push(...batchResults);
    }

    // Aggregate by year
    const yearlyData: Record<
      number,
      {
        received: number;
        sent: number;
        meetings: number;
        meetingHours: number;
      }
    > = {};
    for (const r of results) {
      if (!yearlyData[r.year]) {
        yearlyData[r.year] = {
          received: 0,
          sent: 0,
          meetings: 0,
          meetingHours: 0,
        };
      }
      yearlyData[r.year].received += r.received;
      yearlyData[r.year].sent += r.sent;
      yearlyData[r.year].meetings += r.meetings;
      yearlyData[r.year].meetingHours += r.meetingHours;
    }

    const yearly = Object.entries(yearlyData)
      .map(([year, data]) => ({
        year: parseInt(year),
        ...data,
        meetingHours: Math.round(data.meetingHours * 10) / 10,
      }))
      .sort((a, b) => a.year - b.year);

    const responseData = {
      monthly: results,
      yearly,
      totalEmails: results.reduce((s, r) => s + r.received + r.sent, 0),
      totalMeetings: results.reduce((s, r) => s + r.meetings, 0),
      totalMeetingHours: Math.round(
        results.reduce((s, r) => s + r.meetingHours, 0) * 10
      ) / 10,
      periodStart: "2020-01",
      periodEnd: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
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

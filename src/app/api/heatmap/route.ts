import { NextResponse } from "next/server";
import { getCalendar } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const calendar = getCalendar();
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const dailyCounts: Record<string, number> = {};
    let pageToken: string | undefined;

    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: oneYearAgo.toISOString(),
        timeMax: now.toISOString(),
        singleEvents: true,
        maxResults: 2500,
        pageToken,
        fields: "nextPageToken,items(start,status)",
      });

      for (const event of res.data.items || []) {
        if (event.status === "cancelled") continue;
        if (!event.start?.dateTime) continue;
        const date = event.start.dateTime.split("T")[0];
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    // Fill in all dates
    const days: { date: string; count: number }[] = [];
    const d = new Date(oneYearAgo);
    while (d <= now) {
      const dateStr = d.toISOString().split("T")[0];
      days.push({ date: dateStr, count: dailyCounts[dateStr] || 0 });
      d.setDate(d.getDate() + 1);
    }

    return NextResponse.json({ days });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

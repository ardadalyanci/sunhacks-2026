"use client";

import { useState } from "react";
import Mascot from "@/components/Mascot";
import SkyDay from "@/components/SkyDay";
import VoiceBar from "@/components/VoiceBar";
import { runCommand } from "@/components/commands";
import { formatDay, formatTime, parseLocal } from "@/components/time";
import type { DayItem } from "@/lib/types";
import { demoDueSoon, demoHotAlert, demoPicks, demoPlan, demoSetup } from "@/mocks/day";

const KIND: Record<DayItem["kind"], string> = {
  class: "Class",
  study: "Study block",
  event: "Event",
  leave: "Time to leave",
  assignment: "Assignment",
};

function at(item: DayItem) {
  return item.startsAt ?? item.dueAt ?? "";
}

function byTime(a: DayItem, b: DayItem) {
  return at(a).localeCompare(at(b));
}

function arizonaHours() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") + get("minute") / 60;
}

function clock(iso: string) {
  return formatTime(parseLocal(iso).hours);
}

export default function TodayPage() {
  const [items, setItems] = useState<DayItem[]>(demoPlan.items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hotPreview, setHotPreview] = useState(false);

  const heat = hotPreview ? demoHotAlert : demoPlan.heatAlert;
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const assignments = [...items.filter((i) => i.kind === "assignment"), ...demoDueSoon];
  const tonight = demoPicks.filter(
    (p) => p.event.startsAt.startsWith(demoPlan.date) && !items.some((i) => i.title === p.event.title),
  );

  function addEvent(eventId: string) {
    const pick = demoPicks.find((p) => p.event.id === eventId);
    if (!pick || items.some((i) => i.title === pick.event.title)) return;
    const { event } = pick;
    setItems((prev) =>
      [
        ...prev,
        {
          id: `event-${event.id}`,
          kind: "event" as const,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.location,
          url: event.url,
        },
      ].sort(byTime),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedId(null);
  }

  async function onCommand(transcript: string) {
    const result = await runCommand(transcript, {
      briefing: demoPlan.briefing,
      items,
      picks: demoPicks,
      nowHours: arizonaHours(),
    });
    if (result.action === "add_event" && result.id) addEvent(result.id);
    if (result.action === "remove_item" && result.id) removeItem(result.id);
    if (result.action === "next_item" && result.id) setSelectedId(result.id);
    return result;
  }

  return (
    <>
      <p className="text-lg text-ink-soft">{formatDay(demoPlan.date)}</p>
      <h1 className="font-display text-5xl font-bold tracking-tight">Your day, {demoSetup.name}</h1>

      <section className="mt-6 flex flex-col gap-5 rounded-3xl bg-cloud p-5 sm:flex-row sm:items-start sm:p-6">
        <Mascot size={92} hot={Boolean(heat)} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="max-w-prose text-lg leading-relaxed">{demoPlan.briefing}</p>
          <div className="mt-4">
            <VoiceBar briefing={demoPlan.briefing} onCommand={onCommand} />
          </div>
        </div>
      </section>

      {heat && (
        <section role="alert" className="mt-4 rounded-3xl bg-[#ff8a3d] p-5 sm:p-6">
          <p className="font-display text-2xl font-bold">
            Feels like {heat.feelsLikeF}°F at {clock(heat.at)}
          </p>
          <p className="mt-1 max-w-prose text-lg">{heat.message}</p>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <SkyDay items={items} hot={Boolean(heat)} selectedId={selectedId} onSelect={setSelectedId} />
          <label className="mt-3 flex items-center gap-2 text-ink-soft">
            <input
              type="checkbox"
              checked={hotPreview}
              onChange={(e) => setHotPreview(e.target.checked)}
              className="h-4 w-4 accent-[#ff8a3d]"
            />
            Preview a 106°F September day
          </label>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-live="polite">
          {selected ? (
            <section className="rounded-3xl bg-cloud p-5">
              <p className="font-bold text-ink-soft">{KIND[selected.kind]}</p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{selected.title}</h2>
              <p className="mt-2">
                {selected.kind === "assignment" && selected.dueAt && `Due ${clock(selected.dueAt)}`}
                {selected.kind === "leave" && selected.startsAt && `Leave at ${clock(selected.startsAt)}`}
                {selected.startsAt &&
                  selected.endsAt &&
                  `${clock(selected.startsAt)} to ${clock(selected.endsAt)}`}
                {selected.location ? `, ${selected.location}` : ""}
              </p>
              {selected.kind === "leave" && (
                <p className="mt-2">It is a {selected.walkMinutes} minute walk, so you arrive with a few minutes to spare.</p>
              )}
              {selected.kind === "study" && (
                <p className="mt-2">
                  Saved for {assignments.find((a) => a.id === selected.forItemId)?.title ?? "an assignment"}. It
                  usually takes about {selected.estimatedMinutes} minutes.
                </p>
              )}
              {selected.kind === "assignment" && (
                <p className={`mt-2 font-bold ${selected.submitted ? "text-saguaro" : ""}`}>
                  {selected.submitted ? "Turned in" : "Not turned in yet"}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90"
                  >
                    {selected.kind === "event" ? "Open event page" : "Open in Canvas"}
                  </a>
                )}
                {selected.kind === "event" && (
                  <button
                    type="button"
                    onClick={() => removeItem(selected.id)}
                    className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10"
                  >
                    Remove from my day
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full px-4 py-2 font-bold hover:bg-ink/10"
                >
                  Close
                </button>
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-3xl bg-cloud p-5">
                <h2 className="font-display text-2xl font-bold">Due soon</h2>
                <ul className="mt-2">
                  {assignments.map((a) => (
                    <li key={a.id} className="border-t border-ink/10 py-3 first:border-t-0">
                      <p className="font-bold leading-snug">{a.title}</p>
                      <p className="text-ink-soft">
                        {a.course}, due {a.dueAt?.startsWith(demoPlan.date) ? "today" : "tomorrow"} at{" "}
                        {a.dueAt ? clock(a.dueAt) : ""}
                      </p>
                      <p className={`text-sm font-bold ${a.submitted ? "text-saguaro" : "text-ink"}`}>
                        {a.submitted ? "Turned in" : `Not turned in, about ${a.estimatedMinutes} min of work`}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              {tonight.length > 0 && (
                <section className="rounded-3xl bg-sun-soft p-5">
                  <h2 className="font-display text-2xl font-bold">Fits in your day</h2>
                  <ul className="mt-2">
                    {tonight.map(({ event, why }) => (
                      <li key={event.id} className="border-t border-ink/15 py-3 first:border-t-0">
                        <p className="font-bold leading-snug">{event.title}</p>
                        <p className="text-ink-soft">
                          {clock(event.startsAt)}
                          {event.location ? `, ${event.location}` : ""}
                        </p>
                        <p className="mt-1">{why}</p>
                        <button
                          type="button"
                          onClick={() => addEvent(event.id)}
                          className="mt-2 rounded-full bg-ink px-4 py-2 font-bold text-cloud hover:bg-ink/90"
                        >
                          Add to my day
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}

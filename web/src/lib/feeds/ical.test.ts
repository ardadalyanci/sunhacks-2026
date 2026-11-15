import { describe, expect, it } from "vitest";
import { decodeQuotedPrintable, escapeText, foldLine, icsUtc, parseIcs, parseIcsDate, parseLine, unescapeText, unfold } from "./ical";

describe("ical reading", () => {
  it("unfolds continuation lines", () => {
    expect(unfold("SUMMARY:Robotics\r\n  club\r\nURL:x")).toEqual(["SUMMARY:Robotics club", "URL:x"]);
  });

  it("parses parameters, including quoted ones with ; and :", () => {
    const p = parseLine('ORGANIZER;CN="Club; A: B":mailto:a@b.c');
    expect(p).toEqual({ name: "ORGANIZER", params: { CN: "Club; A: B" }, value: "mailto:a@b.c" });
    expect(parseLine("no colon here")).toBeNull();
  });

  it("unescapes text and decodes quoted-printable UTF-8", () => {
    expect(unescapeText("a\\, b\\; c\\nd\\\\e")).toBe("a, b; c\nd\\e");
    expect(decodeQuotedPrintable("Caf=C3=A9 night")).toBe("Café night");
    expect(decodeQuotedPrintable("plain = text")).toBe("plain = text");
  });

  it("reads UTC, floating (Arizona) and all-day dates", () => {
    expect(parseIcsDate({ name: "DTSTART", params: {}, value: "20261116T190000Z" })?.date.toISOString()).toBe("2026-11-16T19:00:00.000Z");
    expect(parseIcsDate({ name: "DTSTART", params: { TZID: "America/Phoenix" }, value: "20261116T120000" })?.date.toISOString()).toBe("2026-11-16T19:00:00.000Z");
    expect(parseIcsDate({ name: "DTSTART", params: { VALUE: "DATE" }, value: "20261116" })).toEqual({ date: new Date("2026-11-16T07:00:00.000Z"), allDay: true });
    expect(parseIcsDate({ name: "DTSTART", params: {}, value: "garbage" })).toBeUndefined();
  });

  it("parses VEVENTs with grouped categories and ignores VALARM contents", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:1",
      "SUMMARY;ENCODING=QUOTED-PRINTABLE:Robotics =E2=80=94 build night",
      "CATEGORIES;X-CG-CATEGORY=club_acronym:RSA",
      "CATEGORIES;X-CG-CATEGORY=event_tags:Tempe Campus,In-Person Event",
      "DTSTART:20261116T230000Z",
      "DTEND:20261117T003000Z",
      "BEGIN:VALARM",
      "DESCRIPTION:should be ignored",
      "END:VALARM",
      "DESCRIPTION:Bring a laptop\\, please",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Broken",
      "END:VCALENDAR",
    ].join("\r\n");
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: "1",
      summary: "Robotics — build night",
      description: "Bring a laptop, please",
      categories: { club_acronym: ["RSA"], event_tags: ["Tempe Campus", "In-Person Event"] },
    });
    expect(events[0].end?.toISOString()).toBe("2026-11-17T00:30:00.000Z");
  });
});

describe("ical writing", () => {
  it("escapes text so it reads back the same", () => {
    const text = "Leave at 1:12 PM; bring water, hat\nand shade";
    expect(unescapeText(escapeText(text))).toBe(text);
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const line = `DESCRIPTION:${"é".repeat(60)}`;
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(unfold(folded).join("")).toBe(line);
  });

  it("formats UTC timestamps", () => {
    expect(icsUtc(new Date("2026-11-16T13:30:00-07:00"))).toBe("20261116T203000Z");
  });
});

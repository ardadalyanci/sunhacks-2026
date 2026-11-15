// The interests a student can pick, in the words students use. Keys are what gets saved and matched against event
// tags (lib/feeds/interests.ts tags events with the same keys); labels are only what the chips say. A label uses
// the key's own word, because Sol's reasons name the key ("You picked software.") and the chip must match.
export const INTEREST_CHIPS: { key: string; label: string }[] = [
  { key: "free food", label: "Free food" },
  { key: "robotics", label: "Robotics" },
  { key: "software", label: "Software" },
  { key: "hackathons", label: "Hackathons" },
  { key: "career", label: "Career" },
  { key: "startups", label: "Startups" },
  { key: "cultural", label: "Cultural nights" },
  { key: "music", label: "Music" },
  { key: "arts", label: "Arts" },
  { key: "sports", label: "Sports" },
  { key: "soccer", label: "Soccer" },
  { key: "gaming", label: "Gaming" },
  { key: "volunteering", label: "Volunteering" },
];

const LABELS = new Map(INTEREST_CHIPS.map((c) => [c.key, c.label]));

/** "Software" for "software"; an unknown interest reads as itself with a capital letter. */
export function interestLabel(key: string): string {
  return LABELS.get(key.toLowerCase()) ?? key.charAt(0).toUpperCase() + key.slice(1);
}

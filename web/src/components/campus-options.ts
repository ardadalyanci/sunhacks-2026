// What the setup screen offers per campus: where a day can start (building ids the planner knows, from
// lib/buildings.json for Tempe and lib/campus-buildings.json for the others) and hints for the room field.
import { CAMPUSES, CAMPUS_INFO } from "@/lib/campuses";
import type { CampusId, CommuteBy } from "@/lib/types";

export const CAMPUS_CHOICES: { id: CampusId; label: string }[] = CAMPUSES.map((id) => ({ id, label: CAMPUS_INFO[id].name }));

export const STARTS: Record<CampusId, { id: string; label: string }[]> = {
  tempe: [
    { id: "TOOKR", label: "Tooker House" },
    { id: "MANZ", label: "Manzanita (Manzy)" },
    { id: "SNPBL", label: "San Pablo" },
    { id: "BARRETT", label: "Barrett" },
    { id: "MU", label: "Memorial Union (MU)" },
  ],
  downtown: [
    { id: "downtown-university-center", label: "University Center" },
    { id: "downtown-mercado-c", label: "Mercado" },
    { id: "downtown-walter-cronkite-school-of-journalism", label: "Cronkite" },
  ],
  polytechnic: [
    { id: "polytechnic-century-hall", label: "Century Hall" },
    { id: "polytechnic-falcon-residence-hall", label: "Falcon Hall" },
    { id: "polytechnic-eagle-residence-hall", label: "Eagle Hall" },
    { id: "polytechnic-arizona-state-university-student-union", label: "Student Union" },
  ],
  west: [
    { id: "west-university-center-building", label: "University Center" },
    { id: "west-fletcher-library", label: "Fletcher Library" },
  ],
};

// Hints for the "Building and room" field; the planner matches "BYENG 210" or "Santan Hall 120" on the class's campus.
export const BUILDING_HINTS: Record<CampusId, string[]> = {
  tempe: ["BYENG", "COOR", "ECG", "ISTB4", "LL", "MU", "PSH", "SDFC", "WXLR", "Hayden Library"],
  downtown: ["Cronkite", "University Center", "Mercado", "Nursing and Healthcare Innovation", "Health North"],
  polytechnic: ["Santan Hall", "Peralta Hall", "Sutton Hall", "Century Hall", "Wanner Hall", "ISTB 12", "Technology Center"],
  west: ["Sands", "Kiva", "FAB", "Fletcher Library", "University Center"],
};

export const COMMUTE_CHOICES: { by: CommuteBy; label: string }[] = [
  { by: "walk", label: "Walk" },
  { by: "bike", label: "Bike" },
  { by: "scooter", label: "Scooter" },
  { by: "drive", label: "Car" },
  { by: "bus", label: "Bus or light rail" },
];

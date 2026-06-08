import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  BookOpen,
  ClipboardList,
  FileStack,
  FlaskConical,
  Grid3X3,
  ScrollText,
} from "lucide-react";

/** Database `notes_listings.category` values — must match upload-notes options. */
export const NOTES_SELL_CATEGORIES = [
  "Handwritten Notes",
  "Previous Year Questions (PYQs)",
  "Cheat Sheets",
  "Textbooks",
  "Lab Material",
  "Exam Kits",
] as const;

export const NOTES_RENT_CATEGORIES = [
  "Handwritten Notes",
  "Textbooks",
  "Lab Material",
  "Exam Kits",
] as const;

export type NotesCategoryKey =
  | (typeof NOTES_SELL_CATEGORIES)[number]
  | (typeof NOTES_RENT_CATEGORIES)[number];

export type NotesCategoryOption = {
  key: NotesCategoryKey;
  label: string;
  icon: LucideIcon;
  color: string;
};

export const NOTES_CATEGORY_OPTIONS: NotesCategoryOption[] = [
  {
    key: "Handwritten Notes",
    label: "Class Notes",
    icon: FileStack,
    color: "bg-orange-100 text-orange-600",
  },
  {
    key: "Lab Material",
    label: "Lab Records",
    icon: FlaskConical,
    color: "bg-sky-100 text-sky-600",
  },
  {
    key: "Previous Year Questions (PYQs)",
    label: "Previous Year Questions",
    icon: ClipboardList,
    color: "bg-amber-100 text-amber-700",
  },
  {
    key: "Cheat Sheets",
    label: "Cheat Sheets",
    icon: ScrollText,
    color: "bg-violet-100 text-violet-600",
  },
  {
    key: "Textbooks",
    label: "Core Textbooks",
    icon: BookOpen,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "Exam Kits",
    label: "Exam Kits",
    icon: BookMarked,
    color: "bg-rose-100 text-rose-600",
  },
];

export function getNotesCategoriesForTab(tab: "sell" | "rent"): NotesCategoryOption[] {
  const allowed =
    tab === "sell" ? new Set<string>(NOTES_SELL_CATEGORIES) : new Set<string>(NOTES_RENT_CATEGORIES);
  return NOTES_CATEGORY_OPTIONS.filter((c) => allowed.has(c.key));
}

export function getNotesCategoryLabel(key: string): string {
  return NOTES_CATEGORY_OPTIONS.find((c) => c.key === key)?.label ?? key;
}

export const NOTES_ALL_CATEGORY_ICON = Grid3X3;

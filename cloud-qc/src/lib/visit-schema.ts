import { z } from "zod";

export const VISIT_STATUSES = ["ON_TRACK", "NEEDS_FOLLOWUP", "URGENT"] as const;
export type VisitStatusValue = (typeof VISIT_STATUSES)[number];

const rating = z.number().int().min(1).max(5).nullable();
const smallInt = z.number().int().min(0).max(100000).nullable();

// The client sends a clean, typed object (not FormData).
export const visitInputSchema = z.object({
  neighbornetId: z.string().min(1, "Pick a neighbornet"),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  groupSize: smallInt,
  avgAge: smallInt,
  coVisitorIds: z.array(z.string().min(1)).max(20),
  foodRating: rating,
  leadershipRating: rating,
  halaqahRating: rating,
  status: z.enum(VISIT_STATUSES).nullable(),
  notes: z.string().trim().min(1, "The feedback paragraph is required").max(5000),
});

export type VisitInput = z.infer<typeof visitInputSchema>;

export const EMPTY_VISIT_INPUT: VisitInput = {
  neighbornetId: "",
  visitDate: "",
  groupSize: null,
  avgAge: null,
  coVisitorIds: [],
  foodRating: null,
  leadershipRating: null,
  halaqahRating: null,
  status: null,
  notes: "",
};

export type DuplicateInfo = {
  visitId: string;
  submittedByName: string;
  neighbornetName: string;
  visitDate: string;
};

export type SubmitResult =
  | { ok: true; visitId: string }
  | { ok: false; error: string }
  | { ok: false; duplicate: DuplicateInfo };

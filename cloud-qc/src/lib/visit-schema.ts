import { z } from "zod";

export const VISIT_STATUSES = ["ON_TRACK", "NEEDS_FOLLOWUP", "URGENT"] as const;
export type VisitStatusValue = (typeof VISIT_STATUSES)[number];

export const EVENT_TYPES = ["VISIT", "BASH", "SR_EVENT"] as const;
export type EventTypeValue = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABEL: Record<EventTypeValue, string> = {
  VISIT: "Regular visit",
  BASH: "Bash",
  SR_EVENT: "SR event",
};

const rating = z.number().int().min(1).max(5).nullable();
const smallInt = z.number().int().min(0).max(100000).nullable();

// The client sends a clean, typed object (not FormData).
export const visitInputSchema = z
  .object({
    // Required (>=1) for a VISIT — one point regardless of how many NNs it's
    // tagged to, real credit on each one. Optional for BASH/SR_EVENT, where
    // any picked here are purely informational (see subRegion below).
    neighbornetIds: z
      .array(z.string().min(1))
      .max(30, "That's a lot of neighbornets for one event — split it up"),
    eventType: z.enum(EVENT_TYPES),
    // BASH/SR_EVENT only: which sub-region the event was for.
    subRegion: z.string().trim().max(80).optional(),
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
    groupSize: smallInt,
    avgAge: smallInt,
    coVisitorIds: z.array(z.string().min(1)).max(20),
    foodRating: rating,
    leadershipRating: rating,
    halaqahRating: rating,
    status: z.enum(VISIT_STATUSES).nullable(),
    notes: z.string().trim().min(1, "The feedback paragraph is required").max(5000),
  })
  .refine((d) => d.eventType !== "VISIT" || d.neighbornetIds.length > 0, {
    message: "Pick at least one neighbornet",
    path: ["neighbornetIds"],
  })
  .refine((d) => d.eventType === "VISIT" || Boolean(d.subRegion), {
    message: "Pick which sub-region this was for",
    path: ["subRegion"],
  });

export type VisitInput = z.infer<typeof visitInputSchema>;

export const EMPTY_VISIT_INPUT: VisitInput = {
  neighbornetIds: [],
  eventType: "VISIT",
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
  neighbornetId: string;
  submittedByName: string;
  neighbornetName: string;
  visitDate: string;
  /** True when the current user is already named as a participant on this
   *  visit (the other submitter claimed they were there). Changes both the
   *  confirm prompt's wording and what "No" does — see resolveJointDuplicates. */
  alreadyClaimed: boolean;
};

export type SubmitResult =
  | { ok: true; visitId: string }
  | { ok: false; error: string }
  // One entry per selected neighbornet that already has a visit logged —
  // usually just one, but a joint-event submission can hit several at once.
  | { ok: false; duplicates: DuplicateInfo[] };

import { z } from "zod";

import { STATE_CODES } from "@/lib/us-states";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** Validates create/edit input for a neighbornet. `stateCode` is required and
 *  must be one of the real US codes; everything but name/region is optional. */
export const neighbornetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  city: z.preprocess(emptyToUndef, z.string().trim().max(120).optional()),
  region: z.string().trim().min(1, "Region is required").max(80),
  subArea: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  stateCode: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z
      .string({ error: "Pick a state" })
      .refine((c) => STATE_CODES.includes(c), {
        message: "Pick a valid US state",
      }),
  ),
  latitude: z.preprocess(
    emptyToUndef,
    z.coerce.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    emptyToUndef,
    z.coerce.number().min(-180).max(180).optional(),
  ),
  contactEmail: z.preprocess(
    emptyToUndef,
    z.string().trim().email("Not a valid email").optional(),
  ),
  instagram: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
});

export type NeighbornetInput = z.infer<typeof neighbornetSchema>;

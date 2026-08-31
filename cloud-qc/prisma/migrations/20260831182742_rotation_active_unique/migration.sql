-- At most one *active* rotation assignment (endedOn IS NULL) per
-- (neighbornet, member). Historical/ended rows are unconstrained.
-- Prisma can't express partial unique indexes, so this is hand-written.
CREATE UNIQUE INDEX "RotationAssignment_active_unique"
  ON "RotationAssignment" ("neighbornetId", "userId")
  WHERE "endedOn" IS NULL;

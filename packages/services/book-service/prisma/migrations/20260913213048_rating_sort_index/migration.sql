-- DropIndex
DROP INDEX "Book_reviewsAvgRating_idx";

-- CreateIndex
--
-- HAND-EDITED: Prisma generated this line without `NULLS LAST`. Its @@index
-- attribute can express sort direction (`sort: Desc`) but has no way to express
-- null ordering, so the generated index would be DESC NULLS FIRST.
--
-- That matters, and not subtly. The query asks for `DESC NULLS LAST` (unrated
-- books sort below the lowest-rated, not above the highest). An index stores
-- one order and can only be read forward or backward:
--     forward  -> ASC  NULLS LAST
--     backward -> DESC NULLS FIRST
-- `DESC NULLS LAST` is neither, so with the generated version Postgres cannot
-- use this index for ordering at all and falls back to a full sort of every
-- matching row. Measured before this change: seq scan + quicksort of 259 rows.
--
-- Keep the two in step: prisma/schema.prisma must say
--   @@index([status, reviewsAvgRating(sort: Desc), id])
-- and this file must say DESC NULLS LAST. Regenerating the migration will drop
-- the NULLS LAST again.
CREATE INDEX "Book_status_reviewsAvgRating_id_idx" ON "Book"("status", "reviewsAvgRating" DESC NULLS LAST, "id");

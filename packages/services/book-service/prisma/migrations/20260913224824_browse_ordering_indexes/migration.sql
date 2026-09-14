-- Indexes for the named orderings in BookSortValues: newest, top-rated, a-z.
-- (top-rated's index was added in 20260913213048_rating_sort_index.)
--
-- Book_title_idx is replaced rather than kept: it lacked `status`, so the
-- catalogue's a-z query fetched drafts only to discard them, and it lacked `id`,
-- so tied titles needed a fixup sort.

-- DropIndex
DROP INDEX "Book_title_idx";

-- CreateIndex
--
-- HAND-EDITED: `NULLS LAST` added. Prisma's @@index can express sort direction
-- but not null placement, so it generated DESC (which means DESC NULLS FIRST).
--
-- `publishedAt` is nullable and the query asks for DESC NULLS LAST — unpublished
-- dates sort last, not first. An index stores exactly one order and can only be
-- read forwards or backwards:
--     forward  -> ASC  NULLS LAST
--     backward -> DESC NULLS FIRST
-- DESC NULLS LAST is neither, so the generated version cannot serve this
-- ordering at all and Postgres falls back to a full sort of every published row.
-- A partial mismatch costs the whole index, not part of it.
--
-- Keep in step: schema.prisma says @@index([status, publishedAt(sort: Desc), id])
-- and this file says DESC NULLS LAST. Regenerating drops the NULLS LAST again,
-- and nothing will report it — `migrate diff` does not model null ordering, so
-- there is no drift warning. The symptom is a silently slower query.
CREATE INDEX "Book_status_publishedAt_id_idx" ON "Book"("status", "publishedAt" DESC NULLS LAST, "id");

-- CreateIndex
-- `title` is NOT NULL, so no null placement to get wrong. One index serves both
-- directions: forward is a-z, backward would be z-a with a cheap fixup on ties.
CREATE INDEX "Book_status_title_id_idx" ON "Book"("status", "title", "id");

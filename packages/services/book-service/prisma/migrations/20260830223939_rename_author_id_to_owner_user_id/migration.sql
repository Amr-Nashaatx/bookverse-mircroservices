-- Rename Book.authorId -> Book.ownerUserId and IdempotencyKey.authorId -> IdempotencyKey.ownerUserId.
--
-- Hand-written on purpose. Prisma cannot detect a rename: from the schema diff it
-- sees one column removed and another added, and generates DROP COLUMN + ADD COLUMN,
-- which throws the data away (and fails outright on a non-empty table, since the new
-- column is NOT NULL with no default). RENAME COLUMN preserves every row.
--
-- Postgres does not rename a column's indexes with it, so those are renamed
-- explicitly to the names Prisma derives from the new field names -- otherwise the
-- next `migrate dev` reports drift and tries to recreate them.

ALTER TABLE "Book" RENAME COLUMN "authorId" TO "ownerUserId";
ALTER INDEX "Book_authorId_idx" RENAME TO "Book_ownerUserId_idx";

ALTER TABLE "IdempotencyKey" RENAME COLUMN "authorId" TO "ownerUserId";
ALTER INDEX "IdempotencyKey_authorId_key_key" RENAME TO "IdempotencyKey_ownerUserId_key_key";

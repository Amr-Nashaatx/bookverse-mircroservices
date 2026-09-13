-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "reviewsAvgRating" DOUBLE PRECISION,
ADD COLUMN     "reviewsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewsLastRefresh" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "Book_reviewsAvgRating_idx" ON "Book"("reviewsAvgRating");

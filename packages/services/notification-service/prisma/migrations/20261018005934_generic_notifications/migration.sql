/*
  Warnings:

  - You are about to drop the column `bookId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `bookTitle` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `reviewId` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `data` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "bookId",
DROP COLUMN "bookTitle",
DROP COLUMN "rating",
DROP COLUMN "reviewId",
ADD COLUMN     "data" JSONB NOT NULL,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

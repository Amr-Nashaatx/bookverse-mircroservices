/*
  Warnings:

  - You are about to drop the column `resBody` on the `IdempotencyKey` table. All the data in the column will be lost.
  - You are about to drop the column `resStatus` on the `IdempotencyKey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "IdempotencyKey" DROP COLUMN "resBody",
DROP COLUMN "resStatus";

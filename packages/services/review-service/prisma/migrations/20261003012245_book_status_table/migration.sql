-- CreateTable
CREATE TABLE "BookStatus" (
    "bookId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "BookStatus_pkey" PRIMARY KEY ("bookId")
);

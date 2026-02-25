/*
  Warnings:

  - A unique constraint covering the columns `[projectId,sellerId]` on the table `Bid` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "videoLink" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Bid_projectId_sellerId_key" ON "Bid"("projectId", "sellerId");

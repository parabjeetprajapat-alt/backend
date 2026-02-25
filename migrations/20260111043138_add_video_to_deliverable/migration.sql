/*
  Warnings:

  - You are about to drop the column `videoLink` on the `Bid` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `Bid` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Bid_projectId_sellerId_key";

-- AlterTable
ALTER TABLE "Bid" DROP COLUMN "videoLink",
DROP COLUMN "videoUrl";

-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "videoLink" TEXT,
ADD COLUMN     "videoUrl" TEXT;

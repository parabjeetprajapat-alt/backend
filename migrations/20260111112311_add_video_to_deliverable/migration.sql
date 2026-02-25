/*
  Warnings:

  - You are about to drop the column `fileType` on the `Deliverable` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `Deliverable` table. All the data in the column will be lost.
  - You are about to drop the column `link` on the `Deliverable` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Deliverable" DROP COLUMN "fileType",
DROP COLUMN "fileUrl",
DROP COLUMN "link",
ADD COLUMN     "pdfLink" TEXT,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "zipLink" TEXT,
ADD COLUMN     "zipUrl" TEXT;

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const users = await prisma.user.findMany()
    console.log("✅ Connection Successful! Users found:", users.length)
  } catch (e) {
    console.error("❌ Connection Failed:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
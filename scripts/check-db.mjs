import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const u = await prisma.user.findFirst({
    where: { email: "daniel.cocu4@gmail.com" },
    select: { id: true, email: true, role: true, isActive: true },
  });
  console.log(JSON.stringify({ user: u }, null, 2));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}


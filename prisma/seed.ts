import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const danielEmail = "daniel.cocu4@gmail.com";
  const danielPassword = "12345678";

  const adminEmail = "admin@blindhat.com";
  const adminPassword = "Admin1234!";

  const danielPasswordHash = await bcrypt.hash(danielPassword, 12);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  // Daniel is the CAREGIVER account for development
  await prisma.user.upsert({
    where: { email: danielEmail },
    update: {
      name: "Daniel Cocu",
      role: "CAREGIVER",
      isActive: true,
      passwordHash: danielPasswordHash,
    },
    create: {
      name: "Daniel Cocu",
      email: danielEmail,
      role: "CAREGIVER",
      isActive: true,
      passwordHash: danielPasswordHash,
    },
  });

  // Keep a separate ADMIN account for managing the platform
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Platform Admin",
      role: "ADMIN",
      isActive: true,
      passwordHash: adminPasswordHash,
    },
    create: {
      name: "Platform Admin",
      email: adminEmail,
      role: "ADMIN",
      isActive: true,
      passwordHash: adminPasswordHash,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


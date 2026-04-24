"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("BLIND_USER"),
    name: z.string().min(2),
    phone: z.string().min(3).optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
  }),
  z.object({
    role: z.union([z.literal("ADMIN"), z.literal("CAREGIVER")]),
    name: z.string().min(2),
    email: z.string().trim().email(),
    password: z.string().min(8),
    phone: z.string().min(3).optional().or(z.literal("")),
  }),
]);

export async function createUserAction(input: unknown) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["ADMIN"]);

  const parsed = createUserSchema.parse(input);

  if (parsed.role === "BLIND_USER") {
    const user = await prisma.user.create({
      data: {
        role: "BLIND_USER",
        name: parsed.name,
        phone: parsed.phone || null,
        notes: parsed.notes || null,
        email: null,
        passwordHash: null,
        isActive: true,
      },
      select: { id: true },
    });
    return { ok: true, id: user.id };
  }

  const email = parsed.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const user = await prisma.user.create({
    data: {
      role: parsed.role,
      name: parsed.name,
      email,
      phone: parsed.phone || null,
      passwordHash,
      isActive: true,
    },
    select: { id: true },
  });

  return { ok: true, id: user.id };
}


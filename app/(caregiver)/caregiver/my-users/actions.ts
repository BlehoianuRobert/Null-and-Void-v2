"use server";

import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const addPatientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function addPatientAction(input: unknown) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  try {
    const { name, phone, notes } = addPatientSchema.parse(input);

    const blindUser = await prisma.user.create({
      data: {
        role: "BLIND_USER",
        name,
        phone: phone || null,
        notes: notes || null,
        email: null,
        passwordHash: null,
        isActive: true,
      },
      select: { id: true },
    });

    await prisma.careRelationship.create({
      data: {
        caregiverId,
        blindUserId: blindUser.id,
        isActive: true,
        assignedAt: new Date(),
      },
      select: { id: true },
    });

    revalidatePath("/caregiver/my-users");
    redirect("/caregiver/my-users");
  } catch (e) {
    console.error("ADD_PATIENT_ERROR", e);
    redirect("/caregiver/my-users?error=add-patient");
  }
}

const registerDeviceSchema = z.object({
  blindUserId: z.string().min(1),
  serialNumber: z.string().min(3),
  label: z.string().min(2),
});

export async function registerDeviceForPatientAction(input: unknown) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  try {
    const { blindUserId, serialNumber, label } = registerDeviceSchema.parse(input);

    // Ensure caregiver is assigned to this blind user
    const rel = await prisma.careRelationship.findFirst({
      where: {
        caregiverId,
        blindUserId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!rel) throw new Error("Not assigned to this patient.");

    const device = await prisma.device.upsert({
      where: { serialNumber },
      update: {
        label,
        ownerId: blindUserId,
        isOnline: false,
      },
      create: {
        serialNumber,
        label,
        ownerId: blindUserId,
        isOnline: false,
      },
      select: { id: true },
    });

    revalidatePath("/caregiver/my-users");
    redirect("/caregiver/my-users");
  } catch (e) {
    console.error("REGISTER_DEVICE_ERROR", e);
    redirect("/caregiver/my-users?error=register-device");
  }
}


"use server";

import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";

const addPatientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  deviceMac: z.string().optional().or(z.literal("")),
  deviceLabel: z.string().optional().or(z.literal("")),
});

export async function addPatientAction(input: unknown) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  try {
    const { name, phone, notes, deviceMac, deviceLabel } = addPatientSchema.parse(input);

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

    const mac = (deviceMac || "").trim();
    if (mac) {
      await prisma.device.upsert({
        where: { serialNumber: mac },
        update: {
          ownerId: blindUser.id,
          label: (deviceLabel || "").trim() || "Hat device",
          isOnline: false,
        },
        create: {
          serialNumber: mac,
          ownerId: blindUser.id,
          label: (deviceLabel || "").trim() || "Hat device",
          isOnline: false,
        },
      });
    }

    revalidatePath("/caregiver/my-users");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    console.error("ADD_PATIENT_ERROR", e);
    redirect("/caregiver/my-users?error=add-patient");
  }
  redirect("/caregiver/my-users");
}

const registerDeviceSchema = z.object({
  blindUserId: z.string().min(1),
  serialNumber: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length >= 1, { message: "MAC / serial is required" }),
  label: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || "Hat device"),
});

const removePatientSchema = z.object({
  blindUserId: z.string().min(1),
});

export async function removePatientAction(input: unknown) {
  const session = await getServerSession(authOptions);
  requireRole(session, ["CAREGIVER"]);
  const caregiverId = session!.user.id;

  try {
    const { blindUserId } = removePatientSchema.parse(input);

    await prisma.careRelationship.updateMany({
      where: { caregiverId, blindUserId, isActive: true },
      data: { isActive: false },
    });

    revalidatePath("/caregiver/my-users");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    console.error("REMOVE_PATIENT_ERROR", e);
    redirect("/caregiver/my-users?error=remove-patient");
  }
  redirect("/caregiver/my-users");
}

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
  } catch (e) {
    if (isRedirectError(e)) throw e;
    console.error("REGISTER_DEVICE_ERROR", e);
    redirect("/caregiver/my-users?error=register-device");
  }
  redirect("/caregiver/my-users");
}


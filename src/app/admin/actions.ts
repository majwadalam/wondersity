"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, setRole } from "@/lib/admin";

// Granting and removing the admin role from a learner's page. Only an admin
// can, and never on themselves, so the last admin can't lock everyone out.

export async function changeRole(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const grant = formData.get("grant") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || userId === admin.id) return;
  await setRole(userId, grant ? "admin" : null, admin.id);
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

import { STAFF_EMAILS } from "../config/staff";

type StaffCandidate = {
  app_metadata?: Record<string, unknown> | null;
  email?: string | null;
};

export function isStaffUser(
  user: StaffCandidate | null | undefined,
  staffEmails = process.env.ALFI_STAFF_EMAILS ?? "",
): boolean {
  if (!user) return false;
  if (user.app_metadata?.alfi_role === "staff") return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  const allowed = new Set(
    [...STAFF_EMAILS, ...staffEmails.split(",")]
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.has(email);
}

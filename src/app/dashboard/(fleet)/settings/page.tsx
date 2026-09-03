import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isStaffUser } from "@/lib/staff";
import { SettingsView } from "@/components/SettingsView";

export default async function Page() {
  const { user } = await getSession();
  if (!user || !isStaffUser(user)) redirect("/dashboard");
  return <SettingsView />;
}

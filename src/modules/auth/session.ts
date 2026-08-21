import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import {
  canAccessStaffRoute,
  isStaffRole,
  type StaffRole,
  type StaffRoute,
} from "@/modules/auth/roles";
import { createServerSupabaseClient } from "@/shared/supabase/server";

export type StaffSession = {
  user: User;
  displayName: string;
  role: StaffRole;
};

export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("display_name, role, enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.enabled || !isStaffRole(profile.role)) return null;

  return {
    user,
    displayName: profile.display_name,
    role: profile.role,
  };
}

export async function requireStaffSession(requestedRoute: StaffRoute): Promise<StaffSession> {
  const session = await getStaffSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(requestedRoute)}`);
  }

  if (!canAccessStaffRoute(session.role, requestedRoute)) {
    redirect("/unauthorized");
  }

  return session;
}

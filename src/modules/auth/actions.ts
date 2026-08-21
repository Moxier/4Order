"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  canAccessStaffRoute,
  defaultRouteForRole,
  isStaffRole,
  parseStaffRoute,
} from "@/modules/auth/roles";
import { createServerSupabaseClient } from "@/shared/supabase/server";

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

export async function loginAction(formData: FormData): Promise<never> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!result.success) redirect("/login?error=invalid_input");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error || !data.user) redirect("/login?error=invalid_credentials");

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("role, enabled")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profileError || !profile?.enabled || !isStaffRole(profile.role)) {
    await supabase.auth.signOut();
    redirect("/login?error=staff_access_required");
  }

  const requestedRoute = parseStaffRoute(result.data.next);
  const destination =
    requestedRoute && canAccessStaffRoute(profile.role, requestedRoute)
      ? requestedRoute
      : defaultRouteForRole(profile.role);

  redirect(destination);
}

export async function logoutAction(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

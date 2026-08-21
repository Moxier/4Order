import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_STAFF_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !password) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DEMO_STAFF_PASSWORD are required.",
  );
}

const hostname = new URL(supabaseUrl).hostname;
const isLocal = hostname === "127.0.0.1" || hostname === "localhost";

if (!isLocal && process.env.ALLOW_REMOTE_DEMO_SEED !== "true") {
  throw new Error(
    "Refusing to provision demo accounts on a remote project. Set ALLOW_REMOTE_DEMO_SEED=true only for an intentional non-production demo project.",
  );
}

if (password.length < 12) {
  throw new Error("DEMO_STAFF_PASSWORD must contain at least 12 characters.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const demoStaff = [
  { email: "kitchen@4order.local", displayName: "ครัว (Demo)", role: "KITCHEN" },
  { email: "cashier@4order.local", displayName: "แคชเชียร์ (Demo)", role: "CASHIER" },
  { email: "admin@4order.local", displayName: "ผู้ดูแล (Demo)", role: "ADMIN" },
];

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const match = data.users.find((user) => user.email === email);
    if (match) return match;
    if (data.users.length < 100) return null;
  }

  throw new Error("Could not finish scanning Auth users after 10 pages.");
}

for (const staff of demoStaff) {
  const existing = await findUserByEmail(staff.email);
  let userId;

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: staff.email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error: profileError } = await supabase.from("staff_profiles").upsert(
    {
      user_id: userId,
      display_name: staff.displayName,
      role: staff.role,
      enabled: true,
    },
    { onConflict: "user_id" },
  );

  if (profileError) throw profileError;
  console.log(`Provisioned ${staff.email} (${staff.role})`);
}

console.log("Demo staff provisioning complete. The password was not printed.");

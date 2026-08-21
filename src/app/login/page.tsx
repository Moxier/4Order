import type { Metadata } from "next";

import { loginAction } from "@/modules/auth/actions";
import { parseStaffRoute } from "@/modules/auth/roles";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบพนักงาน",
};

const errorMessages: Record<string, string> = {
  invalid_input: "กรุณาตรวจสอบอีเมลและรหัสผ่าน",
  invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  staff_access_required: "บัญชีนี้ไม่มีสิทธิ์ใช้งานหน้าพนักงาน",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const parameters = await searchParams;
  const errorCode = typeof parameters.error === "string" ? parameters.error : "";
  const nextRoute = parseStaffRoute(parameters.next);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
      <section className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold text-[var(--brand)]">4Order</p>
        <h1 className="mt-2 text-3xl font-bold">เข้าสู่ระบบพนักงาน</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          สำหรับครัว แคชเชียร์ และผู้ดูแลระบบ
        </p>

        {errorMessages[errorCode] ? (
          <p
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errorMessages[errorCode]}
          </p>
        ) : null}

        <form action={loginAction} className="mt-7 space-y-5">
          {nextRoute ? <input name="next" type="hidden" value={nextRoute} /> : null}
          <label className="block">
            <span className="text-sm font-semibold">อีเมล</span>
            <input
              autoComplete="username"
              className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4"
              inputMode="email"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">รหัสผ่าน</span>
            <input
              autoComplete="current-password"
              className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="min-h-12 w-full rounded-xl bg-[var(--brand)] px-5 font-semibold text-white hover:bg-[var(--brand-dark)]"
            type="submit"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </section>
    </main>
  );
}

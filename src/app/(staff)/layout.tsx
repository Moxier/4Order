import Link from "next/link";

import { logoutAction } from "@/modules/auth/actions";

export const dynamic = "force-dynamic";

export default function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link className="text-lg font-bold text-[var(--brand)]" href="/">
            4Order
          </Link>
          <form action={logoutAction}>
            <button
              className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-stone-50"
              type="submit"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

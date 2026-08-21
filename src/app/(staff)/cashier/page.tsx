import type { Metadata } from "next";

import { requireStaffSession } from "@/modules/auth/session";

export const metadata: Metadata = { title: "แคชเชียร์" };

export default async function CashierPage() {
  const session = await requireStaffSession("/cashier");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-sm font-semibold text-[var(--brand)]">เข้าสู่ระบบในชื่อ {session.displayName}</p>
      <h1 className="mt-2 text-3xl font-bold">แคชเชียร์</h1>
      <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Phase 1 เตรียมสิทธิ์การเข้าถึงแล้ว ขั้นตอนคิดราคาและชำระเงินจะพัฒนาใน Phase 4
      </p>
    </main>
  );
}

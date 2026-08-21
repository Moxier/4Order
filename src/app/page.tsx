import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
          Phase 1
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">4Order</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          โครงสร้างพื้นฐานของระบบพร้อมสำหรับการพัฒนาทีละขั้นตอน
        </p>
        <Link
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--brand)] px-5 font-semibold text-white hover:bg-[var(--brand-dark)]"
          href="/login"
        >
          เข้าสู่ระบบพนักงาน
        </Link>
      </div>
    </main>
  );
}

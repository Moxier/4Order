import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-10">
      <section className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <p className="text-5xl" aria-hidden="true">
          🔒
        </p>
        <h1 className="mt-5 text-2xl font-bold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">โปรดใช้บัญชีพนักงานที่มีสิทธิ์ตรงกับหน้าที่</p>
        <Link
          className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[var(--brand)] px-5 font-semibold text-white"
          href="/login"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </section>
    </main>
  );
}

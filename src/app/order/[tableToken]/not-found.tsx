import Link from "next/link";

export default function CustomerTableNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-10">
      <section className="w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center shadow-sm">
        <p className="text-sm font-semibold text-[var(--brand)]">4Order</p>
        <h1 className="mt-3 text-2xl font-bold">ไม่พบโต๊ะนี้</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">
          QR อาจถูกเปลี่ยนหรือโต๊ะยังไม่เปิดใช้งาน กรุณาสแกน QR ที่โต๊ะอีกครั้ง
          หรือติดต่อพนักงาน
        </p>
        <Link
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] px-5 font-semibold text-[var(--foreground)]"
          href="/"
        >
          กลับหน้าแรก
        </Link>
      </section>
    </main>
  );
}

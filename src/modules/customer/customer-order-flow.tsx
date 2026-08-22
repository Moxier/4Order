"use client";

import { useEffect, useRef, useState } from "react";

import {
  customerOrderInputSchema,
  customerOrderTextSchema,
} from "@/modules/customer/schema";
import {
  loadCustomerDraft,
  removeCustomerDraft,
  saveCustomerDraft,
  type DraftStorageLevel,
} from "@/modules/customer/draft-storage";
import {
  CustomerSubmissionError,
  type OrderResult,
  submitCustomerOrderRequest,
} from "@/modules/customer/submission";

type CustomerOrderFlowProps = {
  tableName: string;
  tableToken: string;
};

export function CustomerOrderFlow({
  tableName,
  tableToken,
}: CustomerOrderFlowProps) {
  const storageKey = `4order:customer-draft:${tableToken}`;
  const [screen, setScreen] = useState<"confirm" | "edit" | "success">("edit");
  const [originalText, setOriginalText] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageLevel, setStorageLevel] =
    useState<DraftStorageLevel>("local");
  const [result, setResult] = useState<OrderResult | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    const restoredDraft = loadCustomerDraft(window, storageKey);

    const restoredInput = customerOrderInputSchema.safeParse({
      tableToken,
      originalText: restoredDraft?.originalText ?? "",
      idempotencyKey: restoredDraft?.idempotencyKey,
    });

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      if (restoredInput.success) {
        setOriginalText(restoredInput.data.originalText);
        setIdempotencyKey(restoredInput.data.idempotencyKey);
      } else {
        setIdempotencyKey(createIdempotencyKey());
      }

      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, [storageKey, tableToken]);

  useEffect(() => {
    if (!hydrated || !idempotencyKey || screen === "success") {
      return;
    }

    const level = saveCustomerDraft(window, storageKey, {
      idempotencyKey,
      originalText,
    });
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setStorageLevel(level);
      }
    });
    return () => {
      active = false;
    };
  }, [hydrated, idempotencyKey, originalText, screen, storageKey]);

  function reviewOrder() {
    const parsedText = customerOrderTextSchema.safeParse(originalText);
    if (!parsedText.success) {
      setErrorMessage(parsedText.error.issues[0]?.message ?? "กรุณาตรวจสอบรายการ");
      return;
    }

    setErrorMessage(null);
    setScreen("confirm");
  }

  async function submitOrder() {
    if (inFlight.current) {
      return;
    }

    const parsedInput = customerOrderInputSchema.safeParse({
      idempotencyKey,
      originalText,
      tableToken,
    });

    if (!parsedInput.success) {
      setErrorMessage(parsedInput.error.issues[0]?.message ?? "กรุณาตรวจสอบรายการ");
      setScreen("edit");
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      let payload: OrderResult;
      try {
        payload = await submitCustomerOrderRequest(parsedInput.data);
      } catch (error) {
        if (
          !(error instanceof CustomerSubmissionError) ||
          error.code !== "IDEMPOTENCY_CONFLICT"
        ) {
          throw error;
        }

        // A persisted key can outlive the text it originally represented when
        // browser storage partially fails. Rotate only the conflicting key,
        // preserve the exact text, persist the repaired draft when possible,
        // and retry once through the normal timeout/retry path.
        const recoveredKey = createIdempotencyKey();
        setIdempotencyKey(recoveredKey);
        setStorageLevel(
          saveCustomerDraft(window, storageKey, {
            idempotencyKey: recoveredKey,
            originalText,
          }),
        );
        payload = await submitCustomerOrderRequest({
          ...parsedInput.data,
          idempotencyKey: recoveredKey,
        });
      }

      setResult(payload);
      setScreen("success");
      removeCustomerDraft(window, storageKey);
    } catch (error) {
      setErrorMessage(
        error instanceof CustomerSubmissionError
          ? error.message
          : "การเชื่อมต่อขัดข้อง รายการของคุณยังอยู่ กรุณาลองอีกครั้ง",
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function beginAdditionalOrder() {
    const nextKey = createIdempotencyKey();
    setOriginalText("");
    setIdempotencyKey(nextKey);
    setResult(null);
    setErrorMessage(null);
    setScreen("edit");
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-5 sm:px-6 sm:py-8">
      <header className="rounded-3xl bg-[var(--brand)] px-6 py-5 text-white shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-emerald-100">4Order</p>
        <h1 className="mt-1 text-3xl font-bold">{tableName}</h1>
        <p className="mt-2 text-sm leading-6 text-emerald-50">
          พิมพ์รายการอาหารทีละบรรทัด ไม่ต้องสมัครสมาชิก
        </p>
      </header>

      <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
        {storageLevel !== "local" && screen !== "success" ? (
          <p
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
            role="status"
          >
            {storageLevel === "session"
              ? "อุปกรณ์นี้บันทึกรายการได้เฉพาะแท็บนี้ กรุณาอย่าปิดแท็บจนกว่าจะส่งสำเร็จ"
              : "อุปกรณ์นี้ปิดการบันทึกข้อมูล รายการยังอยู่ในหน้านี้ กรุณาอย่าปิดหรือรีเฟรชจนกว่าจะส่งสำเร็จ"}
          </p>
        ) : null}
        {screen === "edit" ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-bold">กรุณาพิมพ์รายการอาหาร</h2>
              <span className="shrink-0 text-xs text-[var(--muted)]">
                {originalText.length}/8,000
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              ระบุจำนวนและรายละเอียด เช่น เผ็ดน้อย หรือ ไม่ใส่ผัก
            </p>
            <textarea
              aria-describedby="order-example order-error"
              className="mt-4 min-h-64 w-full resize-y rounded-2xl border border-[var(--border)] bg-white p-4 text-lg leading-8 text-[var(--foreground)] shadow-inner placeholder:text-slate-400"
              disabled={!hydrated}
              maxLength={8000}
              onChange={(event) => {
                setOriginalText(event.target.value);
                setErrorMessage(null);
              }}
              placeholder={"ข้าวหมกไก่ 2\nซุปหางวัว 1\nกะเพราเนื้อ 1 เผ็ดน้อย"}
              value={originalText}
            />
            <p id="order-example" className="mt-2 text-xs leading-5 text-[var(--muted)]">
              ระบบจะเก็บข้อความตามที่คุณพิมพ์และส่งให้ร้านโดยตรง
            </p>
            <OrderError message={errorMessage} />
            <button
              className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-5 text-lg font-bold text-white hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hydrated || submitting}
              onClick={reviewOrder}
              type="button"
            >
              ตรวจสอบรายการ
            </button>
          </>
        ) : null}

        {screen === "confirm" ? (
          <>
            <p className="text-sm font-semibold text-[var(--brand)]">ตรวจสอบก่อนส่ง</p>
            <h2 className="mt-1 text-2xl font-bold">{tableName}</h2>
            <pre className="mt-5 whitespace-pre-wrap break-words rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 font-sans text-lg leading-8 text-[var(--foreground)]">
              {originalText}
            </pre>
            <OrderError message={errorMessage} />
            <div className="mt-5 grid gap-3">
              <button
                className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--brand)] px-5 text-lg font-bold text-white hover:bg-[var(--brand-dark)] disabled:cursor-wait disabled:opacity-60"
                disabled={submitting}
                onClick={submitOrder}
                type="button"
              >
                {submitting
                  ? "กำลังส่งออเดอร์..."
                  : errorMessage
                    ? "ลองส่งออเดอร์เดิมอีกครั้ง"
                    : "ยืนยันส่งออเดอร์"}
              </button>
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--border)] px-5 font-semibold text-[var(--foreground)] disabled:opacity-50"
                disabled={submitting}
                onClick={() => {
                  setErrorMessage(null);
                  setScreen("edit");
                }}
                type="button"
              >
                แก้ไขรายการ
              </button>
            </div>
          </>
        ) : null}

        {screen === "success" && result ? (
          <div className="text-center" aria-live="polite">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-[var(--brand)]">
              ✓
            </div>
            <p className="mt-5 text-sm font-semibold text-[var(--brand)]">ส่งออเดอร์แล้ว</p>
            <h2 className="mt-1 text-3xl font-bold">Order #{result.orderNumber}</h2>
            <p className="mt-2 text-lg font-semibold">{result.tableName}</p>
            <p className="mt-4 leading-7 text-[var(--muted)]">
              ร้านได้รับรายการของคุณเรียบร้อยแล้ว
              {result.duplicate ? " คำขอนี้เป็นการลองส่งซ้ำ จึงไม่มีออเดอร์เพิ่ม" : ""}
            </p>
            <button
              className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--brand)] px-5 text-lg font-bold text-white hover:bg-[var(--brand-dark)]"
              onClick={beginAdditionalOrder}
              type="button"
            >
              สั่งเพิ่ม
            </button>
          </div>
        ) : null}
      </section>

      <p className="px-3 py-5 text-center text-xs leading-5 text-[var(--muted)]">
        หากส่งไม่สำเร็จ ข้อความจะยังอยู่ในอุปกรณ์นี้และสามารถลองส่งซ้ำได้
      </p>
    </main>
  );
}

function createIdempotencyKey(): string {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function OrderError({ message }: { message: string | null }) {
  return (
    <p
      aria-live="polite"
      className={
        message
          ? "mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          : "sr-only"
      }
      id="order-error"
    >
      {message ?? ""}
    </p>
  );
}

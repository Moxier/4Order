"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchKitchenOrders } from "@/modules/kitchen/data";
import {
  findNewOrderIds,
  getNextKitchenStatus,
  groupKitchenOrders,
  type KitchenOrder,
  type KitchenOrderStatus,
} from "@/modules/kitchen/model";
import { createBrowserSupabaseClient } from "@/shared/supabase/browser";

const soundStorageKey = "4order:kitchen-sound-enabled";
const authoritativeRefreshIntervalMs = 30_000;

type ConnectionState = "CONNECTING" | "CONNECTED" | "RECONNECTING" | "OFFLINE";

type KitchenBoardProps = {
  initialOrders: KitchenOrder[];
  staffDisplayName: string;
};

const timeFormatter = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

const statusLabels: Record<KitchenOrderStatus, string> = {
  NEW: "ออเดอร์ใหม่",
  ACKNOWLEDGED: "รับออเดอร์แล้ว",
  PREPARING: "กำลังทำ",
  DONE: "เสร็จแล้ว",
  CANCELLED: "ยกเลิก",
};

const actionLabels: Partial<Record<KitchenOrderStatus, string>> = {
  NEW: "รับออเดอร์",
  ACKNOWLEDGED: "เริ่มทำ",
  PREPARING: "ทำเสร็จแล้ว",
};

const connectionLabels: Record<ConnectionState, string> = {
  CONNECTING: "กำลังเชื่อมต่อ…",
  CONNECTED: "เชื่อมต่อแล้ว",
  RECONNECTING: "การเชื่อมต่อขัดข้อง — กำลังเชื่อมต่อใหม่…",
  OFFLINE: "อุปกรณ์ออฟไลน์ — รอสัญญาณอินเทอร์เน็ต…",
};

function playKitchenChime(audioContext: AudioContext) {
  const startAt = audioContext.currentTime;

  for (const [offset, frequency] of [
    [0, 880],
    [0.16, 1174],
  ] as const) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt + offset);
    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(0.22, startAt + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.13);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.14);
  }
}

function statusErrorMessage(message: string) {
  if (message.includes("kitchen_order_status_conflict")) {
    return "สถานะออเดอร์ถูกเปลี่ยนจากอุปกรณ์อื่นแล้ว ระบบกำลังโหลดข้อมูลล่าสุด";
  }
  if (message.includes("kitchen_order_forbidden")) {
    return "บัญชีนี้ไม่มีสิทธิ์เปลี่ยนสถานะออเดอร์ครัว";
  }
  if (message.includes("kitchen_order_invalid_transition")) {
    return "ไม่สามารถข้ามลำดับสถานะออเดอร์ได้";
  }
  return "เปลี่ยนสถานะไม่สำเร็จ กรุณาลองอีกครั้ง";
}

function KitchenOrderCard({
  order,
  pending,
  onAdvance,
}: {
  order: KitchenOrder;
  pending: boolean;
  onAdvance: (order: KitchenOrder) => void;
}) {
  const actionLabel = actionLabels[order.status];
  const isNew = order.status === "NEW";

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        isNew
          ? "border-orange-400 ring-2 ring-orange-100"
          : order.status === "PREPARING"
            ? "border-blue-300"
            : "border-[var(--border)]"
      }`}
      data-order-id={order.id}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold">{order.tableName}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            Order #{order.orderNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold">{timeFormatter.format(new Date(order.createdAt))}</p>
          <p
            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
              isNew
                ? "bg-orange-100 text-orange-900"
                : order.status === "PREPARING"
                  ? "bg-blue-100 text-blue-900"
                  : order.status === "DONE"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-stone-100 text-stone-700"
            }`}
          >
            {statusLabels[order.status]}
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-3 border-y border-stone-100 py-4">
        {order.lines.map((line) => (
          <li className="whitespace-pre-wrap text-lg font-medium leading-7" key={line.id}>
            {line.originalText}
          </li>
        ))}
      </ol>

      {actionLabel ? (
        <button
          className="mt-5 min-h-12 w-full rounded-xl bg-[var(--brand)] px-4 font-bold text-white hover:bg-[var(--brand-dark)] disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
          onClick={() => onAdvance(order)}
          type="button"
        >
          {pending ? "กำลังบันทึก…" : actionLabel}
        </button>
      ) : null}
    </article>
  );
}

function OrderSection({
  title,
  description,
  orders,
  pendingOrderId,
  onAdvance,
  emptyText,
}: {
  title: string;
  description: string;
  orders: KitchenOrder[];
  pendingOrderId: string | null;
  onAdvance: (order: KitchenOrder) => void;
  emptyText: string;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <span className="rounded-full bg-stone-200 px-3 py-1 text-sm font-bold">
          {orders.length}
        </span>
      </div>

      {orders.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <KitchenOrderCard
              key={order.id}
              onAdvance={onAdvance}
              order={order}
              pending={pendingOrderId === order.id}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-8 text-center text-sm text-[var(--muted)]">
          {emptyText}
        </p>
      )}
    </section>
  );
}

export function KitchenBoard({ initialOrders, staffDisplayName }: KitchenBoardProps) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [orders, setOrders] = useState(initialOrders);
  const [connection, setConnection] = useState<ConnectionState>("CONNECTING");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundArmed, setSoundArmed] = useState(false);
  const [soundStorageAvailable, setSoundStorageAvailable] = useState(true);
  const knownOrderIds = useRef(new Set(initialOrders.map((order) => order.id)));
  const refreshSequence = useRef(0);
  const realtimeSubscribed = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const soundArmedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const remembered = window.localStorage.getItem(soundStorageKey) === "true";
        setSoundEnabled(remembered);
        soundEnabledRef.current = remembered;
      } catch {
        setSoundStorageAvailable(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    soundArmedRef.current = soundArmed;
  }, [soundArmed, soundEnabled]);

  useEffect(
    () => () => {
      void audioContext.current?.close();
    },
    [],
  );

  const notifyForNewOrders = useCallback((count: number) => {
    if (
      count > 0 &&
      soundEnabledRef.current &&
      soundArmedRef.current &&
      audioContext.current
    ) {
      playKitchenChime(audioContext.current);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    setRefreshing(true);

    try {
      const nextOrders = await fetchKitchenOrders(supabase);
      if (sequence !== refreshSequence.current) return;

      const newOrderIds = findNewOrderIds(knownOrderIds.current, nextOrders);
      for (const order of nextOrders) knownOrderIds.current.add(order.id);
      setOrders(nextOrders);
      setErrorMessage(null);
      if (navigator.onLine && realtimeSubscribed.current) {
        setConnection("CONNECTED");
      }
      notifyForNewOrders(newOrderIds.length);
    } catch {
      if (sequence !== refreshSequence.current) return;
      setErrorMessage("โหลดข้อมูลล่าสุดไม่สำเร็จ ระบบจะลองเชื่อมต่อใหม่อัตโนมัติ");
      setConnection(navigator.onLine ? "RECONNECTING" : "OFFLINE");
    } finally {
      if (sequence === refreshSequence.current) setRefreshing(false);
    }
  }, [notifyForNewOrders, supabase]);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: RealtimeChannel | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refreshOrders(), 150);
    };
    const handleOffline = () => {
      realtimeSubscribed.current = false;
      setConnection("OFFLINE");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshOrders();
    };
    const handleFocus = () => void refreshOrders();

    async function subscribeToChanges() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;

      // Realtime RLS needs the staff JWT before the channel joins. Waiting for
      // it here avoids an initial anonymous subscription race after SSR login.
      await supabase.realtime.setAuth(session?.access_token ?? null);
      if (!active) return;

      channel = supabase
        .channel("kitchen-order-refresh")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "order_lines" },
          scheduleRefresh,
        )
        .subscribe((status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") {
            realtimeSubscribed.current = true;
            setConnection("CONNECTED");
            void refreshOrders();
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            realtimeSubscribed.current = false;
            setConnection(navigator.onLine ? "RECONNECTING" : "OFFLINE");
          }
        });
    }

    async function restartRealtime() {
      realtimeSubscribed.current = false;
      const staleChannel = channel;
      channel = null;
      if (staleChannel) await supabase.removeChannel(staleChannel);
      if (active) await subscribeToChanges();
    }

    const handleOnline = () => {
      setConnection("RECONNECTING");
      void refreshOrders();
      void restartRealtime();
    };

    void subscribeToChanges();

    const interval = window.setInterval(
      () => void refreshOrders(),
      authoritativeRefreshIntervalMs,
    );
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      realtimeSubscribed.current = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshOrders, supabase]);

  const armSound = useCallback(async () => {
    try {
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      await context.resume();
      playKitchenChime(context);
      setSoundEnabled(true);
      setSoundArmed(true);
      soundEnabledRef.current = true;
      soundArmedRef.current = true;
      try {
        window.localStorage.setItem(soundStorageKey, "true");
      } catch {
        setSoundStorageAvailable(false);
      }
    } catch {
      setErrorMessage("เบราว์เซอร์ไม่อนุญาตให้เปิดเสียง กรุณาตรวจการตั้งค่าเสียงของอุปกรณ์");
    }
  }, []);

  const disableSound = useCallback(() => {
    void audioContext.current?.close();
    audioContext.current = null;
    setSoundEnabled(false);
    setSoundArmed(false);
    soundEnabledRef.current = false;
    soundArmedRef.current = false;
    try {
      window.localStorage.setItem(soundStorageKey, "false");
    } catch {
      setSoundStorageAvailable(false);
    }
  }, []);

  const advanceOrder = useCallback(
    async (order: KitchenOrder) => {
      const targetStatus = getNextKitchenStatus(order.status);
      if (!targetStatus) return;

      setPendingOrderId(order.id);
      setErrorMessage(null);
      const { error } = await supabase.rpc("transition_kitchen_order_status", {
        p_order_id: order.id,
        p_expected_status: order.status,
        p_target_status: targetStatus,
      });

      if (error) setErrorMessage(statusErrorMessage(error.message));
      await refreshOrders();
      setPendingOrderId(null);
    },
    [refreshOrders, supabase],
  );

  const groupedOrders = useMemo(() => groupKitchenOrders(orders), [orders]);
  const activeCount =
    groupedOrders.newOrders.length +
    groupedOrders.acknowledgedOrders.length +
    groupedOrders.preparingOrders.length;
  const connectionIsHealthy = connection === "CONNECTED";

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-3xl bg-[#173f2c] p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-200">
              เข้าสู่ระบบในชื่อ {staffDisplayName}
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">หน้าจอครัว</h1>
            <p className="mt-2 text-sm text-emerald-100">ออเดอร์ที่ต้องจัดการ {activeCount} รายการ</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-11 rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-bold hover:bg-white/20"
              disabled={refreshing}
              onClick={() => void refreshOrders()}
              type="button"
            >
              {refreshing ? "กำลังซิงก์…" : "โหลดข้อมูลล่าสุด"}
            </button>
            {soundEnabled && soundArmed ? (
              <button
                className="min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-[#173f2c]"
                onClick={disableSound}
                type="button"
              >
                🔊 เสียงเปิดอยู่
              </button>
            ) : (
              <button
                className="min-h-11 rounded-xl bg-amber-300 px-4 text-sm font-bold text-amber-950"
                onClick={() => void armSound()}
                type="button"
              >
                🔔 {soundEnabled ? "แตะเพื่อเปิดเสียง" : "เปิดเสียงแจ้งเตือน"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div
        className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
          connectionIsHealthy
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-300 bg-amber-50 text-amber-950"
        }`}
        role={connectionIsHealthy ? "status" : "alert"}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{connectionLabels[connection]}</span>
          {!soundStorageAvailable ? (
            <span className="font-normal">การตั้งค่าเสียงจะไม่ถูกจำหลังปิดหน้านี้</span>
          ) : soundEnabled && !soundArmed ? (
            <span className="font-normal">เบราว์เซอร์ต้องให้คุณแตะปุ่มเสียงหนึ่งครั้ง</span>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <OrderSection
        description="ออเดอร์ที่เพิ่งเข้ามาและยังไม่มีใครรับ"
        emptyText="ยังไม่มีออเดอร์ใหม่"
        onAdvance={advanceOrder}
        orders={groupedOrders.newOrders}
        pendingOrderId={pendingOrderId}
        title="ออเดอร์ใหม่"
      />
      <OrderSection
        description="รับออเดอร์แล้ว รอเริ่มทำ"
        emptyText="ไม่มีออเดอร์ที่รอเริ่มทำ"
        onAdvance={advanceOrder}
        orders={groupedOrders.acknowledgedOrders}
        pendingOrderId={pendingOrderId}
        title="รับแล้ว"
      />
      <OrderSection
        description="กำลังเตรียมอาหารให้ลูกค้า"
        emptyText="ยังไม่มีออเดอร์ที่กำลังทำ"
        onAdvance={advanceOrder}
        orders={groupedOrders.preparingOrders}
        pendingOrderId={pendingOrderId}
        title="กำลังทำ"
      />
      <OrderSection
        description="20 รายการล่าสุดที่เสร็จหรือถูกยกเลิก"
        emptyText="ยังไม่มีออเดอร์ที่เสร็จแล้ว"
        onAdvance={advanceOrder}
        orders={groupedOrders.completedOrders}
        pendingOrderId={pendingOrderId}
        title="เสร็จล่าสุด"
      />
    </main>
  );
}

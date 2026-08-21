import { CustomerOrderError, submitCustomerOrder } from "@/modules/customer/data";
import {
  acceptsJsonRequest,
  isSameOriginRequest,
} from "@/modules/customer/request-security";
import { customerOrderInputSchema } from "@/modules/customer/schema";

const maximumRequestBytes = 12_000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonError(403, "FORBIDDEN", "คำขอนี้ไม่ได้มาจากหน้า 4Order");
  }

  if (!acceptsJsonRequest(request)) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "รูปแบบคำขอไม่ถูกต้อง");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return jsonError(413, "ORDER_TOO_LARGE", "รายการอาหารยาวเกินไป");
  }

  let untrustedInput: unknown;
  try {
    untrustedInput = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "ไม่สามารถอ่านรายการอาหารได้");
  }

  const parsedInput = customerOrderInputSchema.safeParse(untrustedInput);
  if (!parsedInput.success) {
    return jsonError(
      400,
      "INVALID_ORDER",
      parsedInput.error.issues[0]?.message ?? "กรุณาตรวจสอบรายการอาหาร",
    );
  }

  try {
    const order = await submitCustomerOrder(parsedInput.data);

    return Response.json(order, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof CustomerOrderError) {
      switch (error.code) {
        case "INVALID_TABLE":
          return jsonError(404, error.code, "ลิงก์โต๊ะนี้ไม่พร้อมใช้งาน");
        case "RATE_LIMITED":
          return jsonError(
            429,
            error.code,
            "มีการส่งรายการถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง",
            { "Retry-After": "60" },
          );
        case "IDEMPOTENCY_CONFLICT":
          return jsonError(
            409,
            error.code,
            "รายการนี้อาจถูกส่งแล้ว กรุณาใช้ข้อความเดิมเพื่อลองอีกครั้งหรือแจ้งพนักงาน",
          );
        case "INVALID_ORDER":
          return jsonError(400, error.code, "กรุณาตรวจสอบรายการอาหาร");
        case "UNAVAILABLE":
          break;
      }
    }

    return jsonError(
      503,
      "ORDER_UNAVAILABLE",
      "ยังส่งออเดอร์ไม่ได้ รายการของคุณยังอยู่ในเครื่อง กรุณาลองอีกครั้ง",
    );
  }
}

function jsonError(
  status: number,
  error: string,
  message: string,
  headers?: HeadersInit,
) {
  return Response.json(
    { error, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    },
  );
}

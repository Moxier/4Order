import { z } from "zod";

export const tableTokenSchema = z
  .string()
  .regex(/^t_[A-Za-z0-9_-]{20,}$/);

export const customerOrderTextSchema = z
  .string()
  .max(8000, "รายการอาหารยาวเกินไป")
  .superRefine((value, context) => {
    if (!/\S/u.test(value)) {
      context.addIssue({
        code: "custom",
        message: "กรุณาพิมพ์รายการอาหารอย่างน้อย 1 รายการ",
      });
      return;
    }

    if (
      value
        .split("\n")
        .some((line) => /\S/u.test(line) && line.length > 1000)
    ) {
      context.addIssue({
        code: "custom",
        message: "แต่ละบรรทัดต้องไม่เกิน 1,000 ตัวอักษร",
      });
    }
  });

export const customerOrderInputSchema = z.object({
  tableToken: tableTokenSchema,
  originalText: customerOrderTextSchema,
  idempotencyKey: z.uuid("รหัสการส่งรายการไม่ถูกต้อง"),
});

export type CustomerOrderInput = z.infer<typeof customerOrderInputSchema>;

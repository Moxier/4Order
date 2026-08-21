import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerOrderFlow } from "@/modules/customer/customer-order-flow";
import { getPublicOrderTable } from "@/modules/customer/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "สั่งอาหาร",
  description: "พิมพ์รายการอาหารและส่งตรงถึงร้าน",
};

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ tableToken: string }>;
}) {
  const { tableToken } = await params;
  const table = await getPublicOrderTable(tableToken);

  if (!table) {
    notFound();
  }

  return <CustomerOrderFlow tableName={table.name} tableToken={tableToken} />;
}

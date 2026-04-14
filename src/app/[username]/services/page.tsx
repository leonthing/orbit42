import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listMyMenus } from "@/lib/menus";
import ServicesManager from "./ServicesManager";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function MenusPage({
  params,
}: {
  params: { username: string };
}) {
  const session = await getSession();
  if (!session || session.username !== params.username) {
    redirect(`/${params.username}`);
  }
  const menus = await listMyMenus();
  return <ServicesManager initial={menus} />;
}

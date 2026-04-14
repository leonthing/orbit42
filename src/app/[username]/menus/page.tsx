import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listMyMenus } from "@/lib/menus";
import MenusManager from "./MenusManager";

export const metadata: Metadata = { title: "Menus" };
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
  return <MenusManager initial={menus} />;
}

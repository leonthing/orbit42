import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserId } from "@/lib/db";
import { getPersonDetail } from "@/lib/people";
import { PersonDetail } from "./PersonDetail";

export const metadata: Metadata = { title: "오르빗" };
export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: { username: string; id: string };
}) {
  const session = await getSession();
  if (session?.username !== params.username) redirect(`/${params.username}`);
  const userId = await getUserId();
  if (!userId) notFound();
  const detail = await getPersonDetail(userId, params.id);
  if (!detail) notFound();
  return <PersonDetail username={params.username} detail={detail} />;
}

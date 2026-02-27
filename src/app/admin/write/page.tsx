import { redirect } from "next/navigation";
import { isAuthenticated } from "../actions";
import { PostEditor } from "./PostEditor";

export const dynamic = "force-dynamic";

export default async function WritePage() {
  const authed = await isAuthenticated();
  if (!authed) redirect("/admin");

  return <PostEditor />;
}

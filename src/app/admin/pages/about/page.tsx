import { redirect } from "next/navigation";
import { isAuthenticated } from "../../actions";
import { AboutEditor } from "./AboutEditor";

export const dynamic = "force-dynamic";

export default async function AboutEditorPage() {
  const authed = await isAuthenticated();
  if (!authed) redirect("/admin");

  return <AboutEditor />;
}

import { redirect } from "next/navigation";
import { isAuthenticated } from "../../actions";
import { HomeEditor } from "./HomeEditor";

export const dynamic = "force-dynamic";

export default async function HomeEditorPage() {
  const authed = await isAuthenticated();
  if (!authed) redirect("/admin");

  return <HomeEditor />;
}

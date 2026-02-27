import { redirect } from "next/navigation";
import { isAuthenticated } from "../../actions";
import { CategoriesEditor } from "./CategoriesEditor";

export const dynamic = "force-dynamic";

export default async function CategoriesEditorPage() {
  const authed = await isAuthenticated();
  if (!authed) redirect("/admin");

  return <CategoriesEditor />;
}

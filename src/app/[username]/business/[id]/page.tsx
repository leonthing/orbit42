import { notFound } from "next/navigation";
import { getBusiness } from "../actions";
import { getProjectsByBusiness } from "../project-actions";
import BusinessDetail from "./BusinessDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { username: string; id: string } }) {
  const business = await getBusiness(params.id);
  if (!business) notFound();

  const projects = await getProjectsByBusiness(params.id).catch(() => []);

  return <BusinessDetail business={business} projects={projects} username={params.username} />;
}

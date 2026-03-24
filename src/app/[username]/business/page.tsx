import type { Metadata } from "next";
import { getBusinesses } from "./actions";
import BusinessPage from "./BusinessPageClient";

export const metadata: Metadata = { title: "Business" };

export default async function Page() {
  const businesses = await getBusinesses();

  return <BusinessPage businesses={businesses} />;
}

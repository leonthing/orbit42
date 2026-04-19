import { redirect } from "next/navigation";

// The standalone login page has been folded into the landing page's
// AuthCard (which supports Google sign-in + tab toggle). All inbound
// /login links now land on the hero with the Sign in tab pre-selected.
export default function LoginRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams({ mode: "signin" });
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
  }
  redirect(`/?${qs.toString()}#auth`);
}

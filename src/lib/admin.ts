import { getSession } from "@/lib/auth";

function adminList(): string[] {
  const raw = process.env.ADMIN_USERNAMES || "leokim5854";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return adminList().includes(session.username.toLowerCase());
}

export async function requireAdmin(): Promise<{ username: string } | null> {
  const session = await getSession();
  if (!session) return null;
  if (!adminList().includes(session.username.toLowerCase())) return null;
  return session;
}

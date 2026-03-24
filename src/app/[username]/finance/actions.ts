"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

// ---------- Transactions ----------

export async function getTransactions(month?: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  let query = db
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (month) {
    // month format: YYYY-MM
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const end = new Date(y, m, 0); // last day of month
    const endStr = `${y}-${String(m).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    query = query.gte("date", start).lte("date", endStr);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTransaction(input: {
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  date: string;
  business_id?: string | null;
}) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("transactions")
    .insert({
      user_id: userId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      category: input.category,
      date: input.date,
      business_id: input.business_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTransaction(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

// ---------- Assets ----------

export async function getAssets() {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAsset(input: {
  name: string;
  type: "cash" | "bank" | "investment" | "real_estate" | "other";
  value: number;
  memo?: string;
}) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("assets")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      value: input.value,
      memo: input.memo ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateAsset(
  id: string,
  input: {
    name?: string;
    type?: "cash" | "bank" | "investment" | "real_estate" | "other";
    value?: number;
    memo?: string;
  },
) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("assets")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAsset(id: string) {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

// ---------- Summary ----------

export async function getFinanceSummary() {
  const userId = await requireUserId();
  const db = getAdminClient();

  // Total assets
  const { data: assets } = await db
    .from("assets")
    .select("value")
    .eq("user_id", userId);

  const totalAssets = (assets ?? []).reduce(
    (sum, a) => sum + Number(a.value),
    0,
  );

  // Current month transactions
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: txns } = await db
    .from("transactions")
    .select("type, amount")
    .eq("user_id", userId)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  let monthIncome = 0;
  let monthExpense = 0;
  for (const t of txns ?? []) {
    if (t.type === "income") monthIncome += Number(t.amount);
    else monthExpense += Number(t.amount);
  }

  return { totalAssets, monthIncome, monthExpense };
}

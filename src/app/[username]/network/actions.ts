"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import { getAuthenticatedPeopleApi } from "@/lib/google";

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  memo: string | null;
  last_contact_at: string | null;
  business_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ContactInput = {
  name: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  memo?: string | null;
  last_contact_at?: string | null;
  business_id?: string | null;
};

export async function getContacts(search?: string): Promise<Contact[]> {
  const userId = await requireUserId();
  const db = getAdminClient();

  let query = db
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},company.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

export async function getContact(id: string): Promise<Contact | null> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data as Contact;
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("contacts")
    .insert({
      user_id: userId,
      name: input.name,
      company: input.company || null,
      role: input.role || null,
      email: input.email || null,
      phone: input.phone || null,
      tags: input.tags ?? [],
      memo: input.memo || null,
      last_contact_at: input.last_contact_at || null,
      business_id: input.business_id || null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function updateContact(
  id: string,
  input: Partial<ContactInput>
): Promise<Contact> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("contacts")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function syncGoogleContacts(): Promise<{ created: number; updated: number; error?: string }> {
  const userId = await requireUserId();

  let people;
  try {
    people = await getAuthenticatedPeopleApi(userId);
  } catch {
    return { created: 0, updated: 0, error: "google_not_connected" };
  }

  if (!people) {
    return { created: 0, updated: 0, error: "google_not_connected" };
  }

  const db = getAdminClient();
  let created = 0;
  let updated = 0;
  let nextPageToken: string | undefined;

  try {
    // Test API access — catches missing contacts scope
    await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 1,
      personFields: "names",
    });
  } catch {
    return { created: 0, updated: 0, error: "google_not_connected" };
  }

  // Fetch all Google contacts first
  const allContacts: { googleContactId: string; name: string; email: string | null; phone: string | null; company: string | null; role: string | null }[] = [];

  do {
    const res = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 1000,
      personFields: "names,emailAddresses,phoneNumbers,organizations",
      pageToken: nextPageToken,
    });

    for (const person of res.data.connections ?? []) {
      const name = person.names?.[0]?.displayName;
      if (!name || !person.resourceName) continue;
      const org = person.organizations?.[0];
      allContacts.push({
        googleContactId: person.resourceName,
        name,
        email: person.emailAddresses?.[0]?.value ?? null,
        phone: person.phoneNumbers?.[0]?.value ?? null,
        company: org?.name ?? null,
        role: org?.title ?? null,
      });
    }
    nextPageToken = res.data.nextPageToken ?? undefined;
  } while (nextPageToken);

  if (allContacts.length === 0) return { created: 0, updated: 0 };

  // Fetch all existing synced contacts in one query
  const { data: existing } = await db
    .from("contacts")
    .select("id, google_contact_id")
    .eq("user_id", userId)
    .not("google_contact_id", "is", null);

  const existingMap = new Map((existing ?? []).map((c) => [c.google_contact_id, c.id]));
  const now = new Date().toISOString();

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

  for (const c of allContacts) {
    const existingId = existingMap.get(c.googleContactId);
    if (existingId) {
      toUpdate.push({ id: existingId, data: { name: c.name, email: c.email, phone: c.phone, company: c.company, role: c.role, updated_at: now } });
    } else {
      toInsert.push({ user_id: userId, google_contact_id: c.googleContactId, name: c.name, email: c.email, phone: c.phone, company: c.company, role: c.role, tags: [], created_at: now, updated_at: now });
    }
  }

  // Batch insert
  if (toInsert.length > 0) {
    const { error } = await db.from("contacts").insert(toInsert);
    if (!error) created = toInsert.length;
  }

  // Batch update (supabase doesn't support bulk update, so batch in parallel)
  if (toUpdate.length > 0) {
    const chunks = [];
    for (let i = 0; i < toUpdate.length; i += 50) {
      chunks.push(toUpdate.slice(i, i + 50));
    }
    for (const chunk of chunks) {
      await Promise.all(chunk.map((u) => db.from("contacts").update(u.data).eq("id", u.id)));
    }
    updated = toUpdate.length;
  }

  return { created, updated };
}

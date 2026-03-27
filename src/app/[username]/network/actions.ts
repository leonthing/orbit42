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
  const people = await getAuthenticatedPeopleApi(userId);

  if (!people) {
    return { created: 0, updated: 0, error: "google_not_connected" };
  }

  const db = getAdminClient();
  let created = 0;
  let updated = 0;
  let nextPageToken: string | undefined;

  try {
    // Test API access first
    await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 1,
      personFields: "names",
    });
  } catch {
    // Token exists but lacks contacts scope — need re-auth
    return { created: 0, updated: 0, error: "google_not_connected" };
  }

  do {
    const res = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 200,
      personFields: "names,emailAddresses,phoneNumbers,organizations",
      pageToken: nextPageToken,
    });

    const connections = res.data.connections ?? [];
    nextPageToken = res.data.nextPageToken ?? undefined;

    for (const person of connections) {
      const name = person.names?.[0]?.displayName;
      if (!name) continue;

      const googleContactId = person.resourceName ?? null;
      const email = person.emailAddresses?.[0]?.value ?? null;
      const phone = person.phoneNumbers?.[0]?.value ?? null;
      const org = person.organizations?.[0];
      const company = org?.name ?? null;
      const role = org?.title ?? null;

      if (googleContactId) {
        // Check if already synced
        const { data: existing } = await db
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("google_contact_id", googleContactId)
          .maybeSingle();

        const now = new Date().toISOString();

        if (existing) {
          await db
            .from("contacts")
            .update({ name, email, phone, company, role, updated_at: now })
            .eq("id", existing.id);
          updated++;
        } else {
          await db.from("contacts").insert({
            user_id: userId,
            google_contact_id: googleContactId,
            name,
            email,
            phone,
            company,
            role,
            tags: [],
            created_at: now,
            updated_at: now,
          });
          created++;
        }
      }
    }
  } while (nextPageToken);

  return { created, updated };
}

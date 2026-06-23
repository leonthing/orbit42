"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";
import { getAuthenticatedPeopleApi } from "@/lib/google";
import { extractCardFields } from "@/lib/card-ocr";
import type { ScanCardResult } from "@/lib/card-ocr-types";

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
  linked_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedMember {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

// Find an orbit42 member by email (case-insensitive; users.email is stored
// lowercased with a unique index). Never links a contact back to the owner.
async function findMemberByEmail(
  email: string,
  excludeUserId: string,
): Promise<LinkedMember | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id, username, display_name, avatar_url")
    .ilike("email", normalized)
    .maybeSingle();
  if (!data || data.id === excludeUserId) return null;
  return data as LinkedMember;
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

  // Auto-link to an orbit42 member if the email matches one.
  const linkedUserId = input.email
    ? (await findMemberByEmail(input.email, userId))?.id ?? null
    : null;

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
      linked_user_id: linkedUserId,
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

const onlyDigits = (v: string) => v.replace(/\D/g, "");

/**
 * Scan a business-card photo (base64) and return extracted fields plus any
 * existing contact that matches by email or phone. Does NOT save — the client
 * shows the result in the contact form for the user to review and confirm.
 */
export async function scanBusinessCard(
  base64Data: string,
  mediaType: string,
): Promise<ScanCardResult> {
  const userId = await requireUserId();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { fields: null, duplicateId: null, duplicateName: null, error: "no_api_key" };
  }

  let fields;
  try {
    fields = await extractCardFields(base64Data, mediaType);
  } catch (e) {
    console.error("Business card scan failed:", e);
    return { fields: null, duplicateId: null, duplicateName: null, error: "extract_failed" };
  }

  if (!fields) {
    return { fields: null, duplicateId: null, duplicateName: null, error: "no_text" };
  }

  // Dedup against existing contacts by normalized email / phone.
  let duplicateId: string | null = null;
  let duplicateName: string | null = null;

  if (fields.email || fields.phone) {
    const db = getAdminClient();
    const { data: existing } = await db
      .from("contacts")
      .select("id, name, email, phone")
      .eq("user_id", userId);

    const email = fields.email?.toLowerCase().trim() ?? null;
    const phone = fields.phone ? onlyDigits(fields.phone) : null;

    const match = (existing ?? []).find((c) => {
      const ce = c.email?.toLowerCase().trim();
      const cp = c.phone ? onlyDigits(c.phone) : "";
      return (email && ce === email) || (phone && phone.length >= 9 && cp === phone);
    });

    if (match) {
      duplicateId = match.id;
      duplicateName = match.name;
    }
  }

  return { fields, duplicateId, duplicateName };
}

/** Resolve a linked member's public profile (for rendering the member card). */
export async function getLinkedMember(memberId: string): Promise<LinkedMember | null> {
  await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("users")
    .select("id, username, display_name, avatar_url")
    .eq("id", memberId)
    .maybeSingle();
  return (data as LinkedMember) ?? null;
}

/**
 * Re-run member matching for an existing contact (e.g. a Google-synced one)
 * using its current email, and persist the result. Returns the matched member.
 */
export async function matchContactByEmail(
  contactId: string,
): Promise<{ member: LinkedMember | null }> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data: contact } = await db
    .from("contacts")
    .select("id, email")
    .eq("id", contactId)
    .eq("user_id", userId)
    .single();

  if (!contact?.email) return { member: null };

  const member = await findMemberByEmail(contact.email, userId);
  await db
    .from("contacts")
    .update({ linked_user_id: member?.id ?? null, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("user_id", userId);

  return { member };
}

/** Remove a contact's member link (keeps the contact itself). */
export async function unlinkContactMember(contactId: string): Promise<void> {
  const userId = await requireUserId();
  const db = getAdminClient();
  await db
    .from("contacts")
    .update({ linked_user_id: null, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("user_id", userId);
}

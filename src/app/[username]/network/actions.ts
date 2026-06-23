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
  google_contact_id: string | null;
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

export interface ContactMatch {
  member: LinkedMember;
  /** How this person is saved in the user's Google contacts. */
  contactName: string | null;
  isFollowing: boolean;
}

/**
 * Privacy-first "find friends": read the user's Google contacts transiently,
 * match their emails against existing orbit42 members, and return ONLY the
 * matches. The raw address book is never written to our database — everything
 * that isn't already an orbit42 user is discarded.
 */
export async function findMembersFromContacts(): Promise<{
  matches: ContactMatch[];
  scanned: number;
  error?: string;
}> {
  const userId = await requireUserId();

  let people;
  try {
    people = await getAuthenticatedPeopleApi(userId);
  } catch {
    return { matches: [], scanned: 0, error: "google_not_connected" };
  }
  if (!people) return { matches: [], scanned: 0, error: "google_not_connected" };

  // Collect contact emails (with a display name for context). Not persisted.
  const nameByEmail = new Map<string, string>();
  let nextPageToken: string | undefined;
  try {
    do {
      const res = await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 1000,
        personFields: "names,emailAddresses",
        pageToken: nextPageToken,
      });
      for (const person of res.data.connections ?? []) {
        const nm = person.names?.[0]?.displayName ?? "";
        for (const e of person.emailAddresses ?? []) {
          const v = e.value?.toLowerCase().trim();
          if (v && !nameByEmail.has(v)) nameByEmail.set(v, nm);
        }
      }
      nextPageToken = res.data.nextPageToken ?? undefined;
    } while (nextPageToken);
  } catch {
    return { matches: [], scanned: 0, error: "google_not_connected" };
  }

  const emails = Array.from(nameByEmail.keys());
  const scanned = emails.length;
  if (scanned === 0) return { matches: [], scanned: 0 };

  const db = getAdminClient();

  // Match emails → orbit42 users in chunks. Only matched users are kept.
  const foundById = new Map<string, { user: LinkedMember; email: string }>();
  for (let i = 0; i < emails.length; i += 300) {
    const chunk = emails.slice(i, i + 300);
    const { data } = await db
      .from("users")
      .select("id, username, display_name, avatar_url, email")
      .in("email", chunk);
    for (const u of (data ?? []) as Array<LinkedMember & { email: string | null }>) {
      if (u.id === userId || foundById.has(u.id)) continue;
      foundById.set(u.id, {
        user: {
          id: u.id,
          username: u.username,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
        },
        email: (u.email ?? "").toLowerCase(),
      });
    }
  }
  if (foundById.size === 0) return { matches: [], scanned };

  // Mark who the user already follows.
  const { data: myFollows } = await db
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  const followingSet = new Set(
    (myFollows ?? []).map((f) => f.following_id as string),
  );

  const matches: ContactMatch[] = Array.from(foundById.values()).map(
    ({ user, email }) => ({
      member: user,
      contactName: nameByEmail.get(email) || null,
      isFollowing: followingSet.has(user.id),
    }),
  );

  // Not-yet-followed first, then alphabetical.
  matches.sort((a, b) => {
    if (a.isFollowing !== b.isFollowing) return a.isFollowing ? 1 : -1;
    return (a.member.display_name || a.member.username).localeCompare(
      b.member.display_name || b.member.username,
      "ko",
    );
  });

  return { matches, scanned };
}

/** Delete contacts that were bulk-imported from Google (google_contact_id set). */
export async function purgeSyncedContacts(): Promise<{ deleted: number }> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .not("google_contact_id", "is", null)
    .select("id");
  return { deleted: data?.length ?? 0 };
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

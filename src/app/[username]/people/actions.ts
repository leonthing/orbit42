"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/db";
import {
  addPerson,
  deleteMeeting,
  logMeeting,
  resolveSuggestions,
  setPeopleImport,
  syncPeople,
  updatePerson,
  type PersonPatch,
} from "@/lib/people";

type Result = { ok: true } | { ok: false; error: string };

async function run(fn: (userId: string) => Promise<unknown>): Promise<Result> {
  try {
    const userId = await requireUserId();
    await fn(userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "처리하지 못했어요." };
  }
}

export async function syncPeopleAction(force = false) {
  return run((userId) => syncPeople(userId, { force }));
}

export async function setPeopleImportAction(enabled: boolean) {
  const r = await run((userId) => setPeopleImport(userId, enabled));
  revalidatePath("/[username]/people", "page");
  return r;
}

export async function resolveSuggestionsAction(ids: string[], action: "accept" | "dismiss") {
  return run((userId) => resolveSuggestions(userId, ids, action));
}

export async function addPersonAction(input: {
  name: string;
  email?: string;
  company?: string;
  role?: string;
  memo?: string;
}) {
  let id = "";
  const r = await run(async (userId) => {
    id = await addPerson(userId, input);
  });
  return r.ok ? { ok: true as const, id } : r;
}

export async function updatePersonAction(personId: string, patch: PersonPatch) {
  return run((userId) => updatePerson(userId, personId, patch));
}

export async function logMeetingAction(
  personId: string,
  input: { title?: string; at?: string; minutes?: number },
) {
  return run((userId) => logMeeting(userId, personId, input));
}

export async function deleteMeetingAction(meetingId: string) {
  return run((userId) => deleteMeeting(userId, meetingId));
}

"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export interface Place {
  id: string;
  user_id: string;
  name: string;
  country_code: string;
  country_name: string;
  city: string | null;
  type: "visited" | "wishlist";
  visit_date: string | null;
  memo: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export type PlaceInput = {
  name: string;
  country_code: string;
  country_name: string;
  city?: string | null;
  type: "visited" | "wishlist";
  visit_date?: string | null;
  memo?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export interface MapStats {
  visitedCount: number;
  wishlistCount: number;
  visitedCountries: string[];
  wishlistCountries: string[];
}

export async function getPlaces(): Promise<Place[]> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("places")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Place[];
}

export async function addPlace(input: PlaceInput): Promise<Place> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("places")
    .insert({
      user_id: userId,
      name: input.name,
      country_code: input.country_code,
      country_name: input.country_name,
      city: input.city || null,
      type: input.type,
      visit_date: input.visit_date || null,
      memo: input.memo || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Place;
}

export async function updatePlace(
  id: string,
  input: Partial<PlaceInput>
): Promise<Place> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("places")
    .update(input)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Place;
}

export async function deletePlace(id: string): Promise<void> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { error } = await db
    .from("places")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function getMapStats(): Promise<MapStats> {
  const userId = await requireUserId();
  const db = getAdminClient();

  const { data, error } = await db
    .from("places")
    .select("country_code, type")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const places = data ?? [];
  const visitedSet = new Set<string>();
  const wishlistSet = new Set<string>();

  for (const p of places) {
    if (p.type === "visited") visitedSet.add(p.country_code);
    else if (p.type === "wishlist") wishlistSet.add(p.country_code);
  }

  return {
    visitedCount: visitedSet.size,
    wishlistCount: wishlistSet.size,
    visitedCountries: Array.from(visitedSet),
    wishlistCountries: Array.from(wishlistSet),
  };
}

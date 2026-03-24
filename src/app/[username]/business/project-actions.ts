"use server";

import { getAdminClient } from "@/lib/supabase";
import { requireUserId } from "@/lib/db";

export type Project = {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  local_path: string | null;
  git_url: string | null;
  status: string;
  tech_stack: string[];
  last_activity: string | null;
  last_commit_msg: string | null;
  last_commit_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectInput = {
  business_id?: string | null;
  name: string;
  description?: string;
  local_path?: string;
  git_url?: string;
  status?: string;
  tech_stack?: string[];
  last_activity?: string;
  last_commit_msg?: string;
  last_commit_at?: string;
};

export async function getProjectsByBusiness(businessId: string): Promise<Project[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("status", { ascending: true })
    .order("last_commit_at", { ascending: false, nullsFirst: false });
  return (data || []) as Project[];
}

export async function getAllProjects(): Promise<Project[]> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("last_commit_at", { ascending: false, nullsFirst: false });
  return (data || []) as Project[];
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data, error } = await db
    .from("projects")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<Project> {
  const userId = await requireUserId();
  const db = getAdminClient();
  const { data, error } = await db
    .from("projects")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const userId = await requireUserId();
  const db = getAdminClient();
  await db.from("projects").delete().eq("id", id).eq("user_id", userId);
}

export async function syncProjectsFromLocal(
  businessId: string,
  projects: Array<{
    name: string;
    local_path: string;
    last_commit_msg?: string;
    last_commit_at?: string;
    last_activity?: string;
    git_url?: string;
  }>
): Promise<{ created: number; updated: number }> {
  const userId = await requireUserId();
  const db = getAdminClient();

  let created = 0;
  let updated = 0;

  for (const p of projects) {
    // Check if project already exists by local_path
    const { data: existing } = await db
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .eq("local_path", p.local_path)
      .single();

    if (existing) {
      await db
        .from("projects")
        .update({
          last_commit_msg: p.last_commit_msg || null,
          last_commit_at: p.last_commit_at || null,
          last_activity: p.last_activity || null,
          git_url: p.git_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      updated++;
    } else {
      await db.from("projects").insert({
        user_id: userId,
        business_id: businessId,
        name: p.name,
        local_path: p.local_path,
        last_commit_msg: p.last_commit_msg || null,
        last_commit_at: p.last_commit_at || null,
        last_activity: p.last_activity || null,
        git_url: p.git_url || null,
        status: "active",
        tech_stack: [],
      });
      created++;
    }
  }

  return { created, updated };
}

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

// Only works locally — scans a directory for git projects
export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { dirPath } = await request.json();

  if (!dirPath || !existsSync(dirPath)) {
    return NextResponse.json({ error: "Directory not found" }, { status: 400 });
  }

  const projects: Array<{
    name: string;
    local_path: string;
    has_git: boolean;
    last_commit_msg?: string;
    last_commit_at?: string;
    last_activity?: string;
    git_url?: string;
  }> = [];

  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const hasGit = existsSync(join(fullPath, ".git"));
    const project: (typeof projects)[number] = {
      name: entry,
      local_path: fullPath,
      has_git: hasGit,
    };

    if (hasGit) {
      try {
        const logOutput = execSync(
          `git -C "${fullPath}" log -1 --format="%aI|||%s"`,
          { timeout: 5000, encoding: "utf-8" }
        ).trim();
        const [dateStr, msg] = logOutput.split("|||");
        project.last_commit_at = dateStr;
        project.last_commit_msg = msg;

        // Relative time
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (days === 0) project.last_activity = "오늘";
        else if (days === 1) project.last_activity = "어제";
        else if (days < 7) project.last_activity = `${days}일 전`;
        else if (days < 30) project.last_activity = `${Math.floor(days / 7)}주 전`;
        else if (days < 365) project.last_activity = `${Math.floor(days / 30)}개월 전`;
        else project.last_activity = `${Math.floor(days / 365)}년 전`;

        // Git remote URL
        try {
          const remote = execSync(
            `git -C "${fullPath}" remote get-url origin`,
            { timeout: 3000, encoding: "utf-8" }
          ).trim();
          project.git_url = remote;
        } catch {
          // No remote
        }
      } catch {
        // Git log failed
      }
    }

    projects.push(project);
  }

  return NextResponse.json({ projects });
}

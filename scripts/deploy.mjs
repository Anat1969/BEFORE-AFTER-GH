// פריסה: מעתיק את dist לענף gh-pages דרך worktree זמני, מוחק נכסים ישנים, ודוחף.
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sh = (c, o = {}) => execSync(c, { stdio: "inherit", ...o });
const dir = mkdtempSync(join(tmpdir(), "gh-pages-"));
try {
  sh("git fetch origin gh-pages");
  sh(`git worktree add -f "${dir}" origin/gh-pages --detach`);
  for (const f of readdirSync(dir)) if (f !== ".git") rmSync(join(dir, f), { recursive: true, force: true });
  cpSync("dist", dir, { recursive: true });
  sh("git add -A", { cwd: dir });
  sh(`git commit -m "Deploy ${new Date().toISOString()}" --allow-empty`, { cwd: dir });
  sh("git push origin HEAD:gh-pages", { cwd: dir });
} finally {
  sh(`git worktree remove --force "${dir}"`);
}

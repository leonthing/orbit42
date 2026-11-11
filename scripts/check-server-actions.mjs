// 빌드 전에 도는 검사(보안-6). "use server" 파일의 모든 export 는 누구나 POST 로 부를 수 있는
// 서버 액션이 된다. 그래서 파일 맨 위의 "use server" 는 *actions.ts 에만 둔다.
// 내부용 함수(로그인 처리·알림 만들기 등)는 일반 서버 모듈에 두고, 클라이언트가 부르는 것만
// *-actions.ts 에서 세션·소유 확인을 거쳐 낸다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");
// 예외: 로그인 확인이 있는 클라이언트 전용 업로드 액션(동적 import)
const ALLOW = new Set(["src/lib/slot-media.ts"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const bad = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const head = readFileSync(file, "utf8").replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  if (!/^["']use server["']/.test(head)) continue;
  if (/actions\.ts$/.test(rel) || ALLOW.has(rel)) continue;
  bad.push(rel);
}

if (bad.length) {
  console.error(
    `\n✗ "use server" 는 *actions.ts 에만 둘 수 있어요(보안-6). 아래 파일의 export 가 모두 공개 서버 액션이 됩니다:\n` +
      bad.map((b) => `  - ${b}`).join("\n") +
      `\n  내부용이면 지시어를 빼고, 클라이언트가 부르는 함수만 *-actions.ts 에서 세션·소유 확인 후 내보내세요.\n`,
  );
  process.exit(1);
}
console.log(`✓ server actions: "use server" 는 *actions.ts 에만 있어요`);

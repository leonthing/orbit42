/**
 * 구글 토큰 일괄 변환 (PO 11/16) — 값은 출력하지 않고 행 수만.
 *
 *   세기만(기본):  npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/google-tokens-convert.ts
 *   암호화 적용:   ... scripts/google-tokens-convert.ts --apply
 *   되돌리기(평문): ... scripts/google-tokens-convert.ts --open [--apply]
 *
 * GOOGLE_TOKEN_KEY 는 실행하는 셸 env 로만 준다(파일에 적지 않는다). 운영 적용은 PO 승인 뒤.
 */
import { convertAllGoogleTokens, googleTokenEncryptionOn } from "@/lib/google-tokens";

(async () => {
  const apply = process.argv.includes("--apply");
  const mode = process.argv.includes("--open") ? "open" : "seal";
  console.log(`mode=${mode} apply=${apply} key=${googleTokenEncryptionOn() ? "있음" : "없음"}`);
  const report = await convertAllGoogleTokens(mode, apply);
  console.table(report);
  if (!apply) console.log("dry-run: 바뀐 것 없음. changed = 바꿀 행 수");
})().catch((e) => {
  console.error("실패:", (e as Error).message);
  process.exit(1);
});

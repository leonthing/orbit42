// Serialize JSON-LD safely for embedding in an inline <script>. JSON.stringify
// does NOT escape `<`, `>`, `&`, or the U+2028/U+2029 line separators, so
// user-controlled fields (display name, bio, blog/slot titles) could otherwise
// break out of the <script> tag with `</script>` → stored XSS. Escaping these
// as unicode code points keeps the JSON valid while making breakout impossible.
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

function serialize(data: object | object[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEP)
    .join("\\u2028")
    .split(PARA_SEP)
    .join("\\u2029");
}

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}

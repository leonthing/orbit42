/**
 * Thin structured logger. Prints JSON in production so Vercel Logs /
 * any future log pipeline can parse; human-readable in dev. Swap the
 * implementation here to adopt Sentry/DataDog later without touching
 * every call site.
 */
type Extra = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", msg: string, extra?: Extra) {
  if (process.env.NODE_ENV === "production") {
    const line = JSON.stringify({
      level,
      msg,
      ...extra,
      ts: new Date().toISOString(),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${level}] ${msg}`, extra ?? "");
  }
}

export const log = {
  info: (msg: string, extra?: Extra) => emit("info", msg, extra),
  warn: (msg: string, extra?: Extra) => emit("warn", msg, extra),
  error: (msg: string, extra?: Extra) => emit("error", msg, extra),
};

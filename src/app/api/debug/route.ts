import { NextResponse } from "next/server";

export async function GET() {
  const pw = process.env.ADMIN_PASSWORD;
  return NextResponse.json({
    hasPassword: !!pw,
    passwordLength: pw?.length ?? 0,
    passwordFirst3: pw?.slice(0, 3) ?? "undefined",
    nodeEnv: process.env.NODE_ENV,
  });
}

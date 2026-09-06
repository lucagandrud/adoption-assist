import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED = new Set([
  "rfa-application-rivera.pdf",
  "home-safety-assessment-conflict.pdf",
  "home-safety-assessment-corrected.pdf",
  "health-screening-rivera.pdf",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
  }
  const bytes = await readFile(path.join(process.cwd(), "demo", "documents", name));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

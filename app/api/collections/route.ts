import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const collectionsPath = path.join(process.cwd(), "data", "collections.json");

function ensureFile() {
  const dir = path.dirname(collectionsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(collectionsPath)) {
    fs.writeFileSync(collectionsPath, "[]");
  }
}

export async function GET() {
  try {
    ensureFile();
    const raw = fs.readFileSync(collectionsPath, "utf-8");
    const data = JSON.parse(raw || "[]");
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Collections GET error", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    ensureFile();
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Expected an array" }, { status: 400 });
    }
    // Normalize shape: {id, name, order}
    const normalized = body
      .filter((c) => c && typeof c.id === "string" && typeof c.name === "string")
      .map((c, i) => ({
        id: c.id,
        name: c.name,
        order: typeof c.order === "number" ? c.order : i,
      }));
    fs.writeFileSync(collectionsPath, JSON.stringify(normalized, null, 2));
    return NextResponse.json({ success: true, collections: normalized });
  } catch (error) {
    console.error("Collections POST error", error);
    return NextResponse.json({ error: "Failed to save collections" }, { status: 500 });
  }
}

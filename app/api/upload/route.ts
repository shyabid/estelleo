import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { writeFile } from "fs/promises";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const type = formData.get("type") as string || "all"; // 'all' (default gallery) or 'featured'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Determine directory
    const uploadDir = type === "featured" 
      ? path.join(process.cwd(), "public", "imgs", "featured")
      : path.join(process.cwd(), "public", "imgs");

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uploadedFilenames = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Sanitize filename
      const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
      const filePath = path.join(uploadDir, filename);

      await writeFile(filePath, buffer);
      uploadedFilenames.push(filename);
    }

    return NextResponse.json({ success: true, filenames: uploadedFilenames });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const dataPath = path.join(process.cwd(), "data", "images.json");

export async function POST(request: Request) {
  try {
    const { filename, type } = await request.json();
    
    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    // Determine directory
    const uploadDir = type === "featured" 
      ? path.join(process.cwd(), "public", "imgs", "featured")
      : path.join(process.cwd(), "public", "imgs");

    // Delete file
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from metadata
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, "utf-8");
      const data = JSON.parse(fileContent);
      
      if (data[filename]) {
        delete data[filename];
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";
  
  const imgsDir = type === "featured" 
    ? path.join(process.cwd(), "public", "imgs", "featured")
    : path.join(process.cwd(), "public", "imgs");
  
  try {
    const files = fs.readdirSync(imgsDir);
    const images = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      // Skip directories (like 'featured' folder when reading main imgs)
      const fullPath = path.join(imgsDir, file);
      if (fs.statSync(fullPath).isDirectory()) return false;
      return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
    });
    
    return NextResponse.json(images);
  } catch {
    return NextResponse.json([]);
  }
}

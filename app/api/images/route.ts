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
    let images = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      // Skip directories (like 'featured' folder when reading main imgs)
      const fullPath = path.join(imgsDir, file);
      if (fs.statSync(fullPath).isDirectory()) return false;
      return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
    });

    // Sort by order if available
    const dataPath = path.join(process.cwd(), "data", "images.json");
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, "utf-8");
      const data = JSON.parse(fileContent);
      
      images.sort((a, b) => {
        const orderA = data[a]?.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = data[b]?.order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
    }
    
    return NextResponse.json(images);
  } catch {
    return NextResponse.json([]);
  }
}

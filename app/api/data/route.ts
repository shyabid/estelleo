import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const dataPath = path.join(process.cwd(), "data", "images.json");
const imgsDir = path.join(process.cwd(), "public", "imgs");

export async function GET() {
  try {
    let data: any = {};
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, "utf-8");
      data = JSON.parse(fileContent);
    }

    // Check for missing metadata and backfill
    if (fs.existsSync(imgsDir)) {
      const files = fs.readdirSync(imgsDir);
      let hasChanges = false;

      for (const file of files) {
        // Skip directories and non-image files
        const fullPath = path.join(imgsDir, file);
        if (fs.statSync(fullPath).isDirectory()) continue;
        if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) continue;

        // If missing color or blurDataUrl
        if (!data[file] || !data[file].color || !data[file].blurDataUrl) {
          try {
            const buffer = fs.readFileSync(fullPath);
            const image = sharp(buffer);
            const { dominant } = await image.stats();
            const color = `rgb(${dominant.r},${dominant.g},${dominant.b})`;
            
            const blurBuffer = await image
              .resize(20, 20, { fit: 'inside' })
              .toBuffer();
            
            // Determine mime type
            const ext = path.extname(file).toLowerCase().slice(1);
            const mimeType = ext === 'jpg' ? 'jpeg' : ext;
            const blurDataUrl = `data:image/${mimeType};base64,${blurBuffer.toString("base64")}`;

            data[file] = {
              ...(data[file] || {}),
              color,
              blurDataUrl,
              // Ensure other fields exist
              title: data[file]?.title || file.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
              description: data[file]?.description || "",
              date: data[file]?.date || ""
            };
            hasChanges = true;
          } catch (err) {
            console.error(`Failed to process ${file}`, err);
          }
        }
      }

      if (hasChanges) {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Data fetch error", error);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    fs.writeFileSync(dataPath, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}

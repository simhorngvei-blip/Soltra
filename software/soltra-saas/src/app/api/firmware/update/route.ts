import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

// Handles OTA Firmware update requests from Soltra Hardware
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceType = searchParams.get("type"); // e.g., 'master-hub', 'sensor-node'
  const currentVersion = searchParams.get("version");

  // Basic validation
  if (!deviceType) {
    return NextResponse.json({ error: "Missing device type" }, { status: 400 });
  }

  // In a real production system, you'd check the database for the latest version
  // and compare it to `currentVersion`. Here, we just serve the latest .bin
  // located in the public/firmware directory.

  const firmwareFileName = `soltra_${deviceType}_latest.bin`;
  const filePath = path.join(process.cwd(), "public", "firmware", firmwareFileName);

  if (!existsSync(filePath)) {
    return new NextResponse("Firmware not found or no update available", { status: 404 });
  }

  try {
    const fileBuffer = readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${firmwareFileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error serving firmware:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

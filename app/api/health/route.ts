import { NextResponse } from "next/server";

/**
 * Health check endpoint for monitoring services like UptimeKuma.
 * Returns a simple status and timestamp.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    },
    { status: 200 }
  );
}

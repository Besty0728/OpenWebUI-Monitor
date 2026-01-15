import { NextRequest, NextResponse } from "next/server";
import { getAllProviders } from "@/lib/db/providers";
import { Provider } from "@/lib/providers";

// GET all providers (Sanitized for public status page)
export async function GET() {
  try {
    const providers = await getAllProviders();
    
    // Sanitize providers: remove config
    const sanitizedProviders = providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      sortOrder: p.sortOrder,
      icon: p.icon,
      enabled: p.enabled,
      // No config field here!
    }));

    // Filter only enabled providers
    const enabledProviders = sanitizedProviders.filter(p => p.enabled);

    return NextResponse.json({ success: true, data: enabledProviders });
  } catch (error: any) {
    console.error("Error fetching status providers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}

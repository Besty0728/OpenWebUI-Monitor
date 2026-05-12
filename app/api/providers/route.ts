import { NextRequest, NextResponse } from "next/server";
import { getAllProviders, getProviderById, createProvider, updateProvider, deleteProvider } from "@/lib/db/providers";
import { ProviderType, ProviderConfig, maskProvider, MASKED_SECRET } from "@/lib/providers";

// GET all providers (with secrets masked)
export async function GET() {
  try {
    const providers = await getAllProviders();
    return NextResponse.json({ success: true, data: providers.map(maskProvider) });
  } catch (error: any) {
    console.error("Error fetching providers:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch providers" },
      { status: 500 }
    );
  }
}

// POST create a new provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, config, icon } = body as {
      name: string;
      type: ProviderType;
      config: ProviderConfig;
      icon?: string;
    };

    if (!name || !type || !config) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, type, config" },
        { status: 400 }
      );
    }

    if (!["newapi", "openrouter", "deepseek"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid provider type. Must be 'newapi', 'openrouter', or 'deepseek'" },
        { status: 400 }
      );
    }

    const provider = await createProvider(name, type, config, icon);
    return NextResponse.json({ success: true, data: maskProvider(provider) });
  } catch (error: any) {
    console.error("Error creating provider:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create provider" },
      { status: 500 }
    );
  }
}

// PUT update a provider
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing provider ID" },
        { status: 400 }
      );
    }

    // If client sent masked placeholders for secrets, preserve the existing values.
    if (updates.config) {
      const existing = await getProviderById(id);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Provider not found" },
          { status: 404 }
        );
      }
      const incoming = updates.config as ProviderConfig;
      const merged: ProviderConfig = { ...incoming };
      if (merged.apiToken === MASKED_SECRET) merged.apiToken = existing.config.apiToken;
      if (merged.apiKey === MASKED_SECRET) merged.apiKey = existing.config.apiKey;
      updates.config = merged;
    }

    const provider = await updateProvider(id, updates);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: maskProvider(provider) });
  } catch (error: any) {
    console.error("Error updating provider:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update provider" },
      { status: 500 }
    );
  }
}

// DELETE a provider
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing provider ID" },
        { status: 400 }
      );
    }

    const deleted = await deleteProvider(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting provider:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete provider" },
      { status: 500 }
    );
  }
}

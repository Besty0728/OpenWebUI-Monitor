import { NextRequest, NextResponse } from "next/server";
import { getAllProviders, createProvider, updateProvider, deleteProvider } from "@/lib/db/providers";
import { ProviderType, ProviderConfig } from "@/lib/providers";

// GET all providers
export async function GET() {
  try {
    const providers = await getAllProviders();
    return NextResponse.json({ success: true, data: providers });
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
    return NextResponse.json({ success: true, data: provider });
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

    const provider = await updateProvider(id, updates);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Provider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: provider });
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

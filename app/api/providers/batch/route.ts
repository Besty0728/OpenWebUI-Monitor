import { NextRequest, NextResponse } from "next/server";
import { updateProviderOrder } from "@/lib/db/providers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: { id: string; sortOrder: number }[] };

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const success = await updateProviderOrder(items);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update order" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating provider order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update order" },
      { status: 500 }
    );
  }
}

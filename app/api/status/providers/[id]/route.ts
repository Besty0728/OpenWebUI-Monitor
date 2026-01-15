import { NextRequest, NextResponse } from "next/server";
// Re-export the GET handler from existing route, but we need to ensure it's safe.
// Actually, the existing route expects 'params' which contains ID.
// We can reuse the logic but we need to ensure permissions.
// Since existing route checks for 'enabled' provider, we can wrap it.
// BUT, existing route doesn't have auth check INSIDE the handler (it relies on middleware).
// So we can import the handler from the other file? No, Next.js app router doesn't easily allow importing handlers like that due to context.
// Better to proxy or duplicate the minimal logic safely.

import { getProviderById } from "@/lib/db/providers";

// Reuse fetch functions is hard if they are not exported.
// Let's refactor the existing route to export the fetch functions or copy them.
// Copying is safer to modify independently for public view (maybe less detail).
// For now, I'll copy the logic to ensure we don't break the admin route.

// COPY OF FETCH LOGIC FROM app/api/providers/[id]/route.ts
// ... (with Auth Removed from logic if any, but added check for public visibility if we had one)
// Since this IS the public route, we just need to ensure we don't leak secrets.
// The existing logic returns Balance info, which is generally safe (quota, usage). 
// It does NOT return keys.

// Fetch balance for a specific provider
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (!provider.enabled) {
      return NextResponse.json(
        { error: "Provider is disabled" },
        { status: 400 }
      );
    }

    // Fetch balance based on provider type
    if (provider.type === "newapi") {
      return await fetchNewAPIBalance(provider.config, provider.name);
    } else if (provider.type === "openrouter") {
      return await fetchOpenRouterBalance(provider.config);
    } else if (provider.type === "deepseek") {
      return await fetchDeepSeekBalance(provider.config);
    }

    return NextResponse.json(
      { error: "Unknown provider type" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error fetching provider balance:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Fetch balance from NewAPI provider
async function fetchNewAPIBalance(config: any, providerName: string) {
  const { apiUrl, apiToken, userId } = config;

  if (!apiToken || !userId || !apiUrl) {
    return NextResponse.json(
      { error: "Configuration Error" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
        "New-Api-User": userId,
        },
    });

    if (!response.ok) {
        return NextResponse.json(
        { error: "Provider Error" },
        { status: response.status }
        );
    }

    const json = await response.json();

    if (json.success && json.data) {
        return NextResponse.json({
        ...json.data,
        providerName,
        isRawUSD: false,
        });
    } else {
        return NextResponse.json(
        { error: "Provider Error" },
        { status: 500 }
        );
    }
  } catch (e) {
      return NextResponse.json({ error: "Network Error" }, { status: 500 });
  }
}

// Fetch balance from OpenRouter provider
async function fetchOpenRouterBalance(config: any) {
  const { apiKey } = config;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Configuration Error" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
        method: "GET",
        headers: {
        Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        return NextResponse.json(
        { error: "Provider Error" },
        { status: response.status }
        );
    }

    const json = await response.json();
    const credits = json.data;
    const remainingBalance = credits.total_credits - credits.total_usage;

    return NextResponse.json({
        id: 0,
        username: "OpenRouter",
        display_name: "OpenRouter",
        status: 1,
        quota: remainingBalance,
        used_quota: credits.total_usage,
        request_count: 0,
        isRawUSD: true,
    });
  } catch (e) {
      return NextResponse.json({ error: "Network Error" }, { status: 500 });
  }
}

// Fetch balance from DeepSeek provider
async function fetchDeepSeekBalance(config: any) {
  const { apiKey } = config;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Configuration Error" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch("https://api.deepseek.com/user/balance", {
        method: "GET",
        headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        return NextResponse.json(
        { error: "Provider Error" },
        { status: response.status }
        );
    }

    const json = await response.json();
    
    const cnyBalance = json.balance_infos?.find((b: any) => b.currency === "CNY");
    const balanceInfo = cnyBalance || json.balance_infos?.[0];
    
    if (!balanceInfo) {
        return NextResponse.json(
        { error: "No balance info" },
        { status: 500 }
        );
    }

    const totalBalance = parseFloat(balanceInfo.total_balance) || 0;
    const grantedBalance = parseFloat(balanceInfo.granted_balance) || 0;
    const toppedUpBalance = parseFloat(balanceInfo.topped_up_balance) || 0;

    return NextResponse.json({
        id: 0,
        username: "DeepSeek",
        display_name: "DeepSeek",
        status: json.is_available ? 1 : 0,
        quota: totalBalance,
        used_quota: 0,
        request_count: 0,
        isRawCNY: balanceInfo.currency === "CNY",
        isRawUSD: balanceInfo.currency === "USD",
        granted_balance: grantedBalance,
        topped_up_balance: toppedUpBalance,
        currency: balanceInfo.currency,
    });
  } catch (e) {
      return NextResponse.json({ error: "Network Error" }, { status: 500 });
  }
}

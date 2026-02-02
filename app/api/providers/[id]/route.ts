import { NextRequest, NextResponse } from "next/server";
import { getProviderById } from "@/lib/db/providers";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Referer": "https://google.com",
};

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
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Fetch balance from NewAPI provider
async function fetchNewAPIBalance(config: any, providerName: string) {
  const { apiUrl, apiToken, userId } = config;

  if (!apiToken || !userId || !apiUrl) {
    return NextResponse.json(
      { error: "Missing NewAPI config: apiUrl, apiToken, or userId" },
      { status: 500 }
    );
  }

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      ...BROWSER_HEADERS,
      Authorization: `Bearer ${apiToken}`,
      "New-Api-User": userId,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `API responded with status ${response.status}: ${errorText}` },
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
      { error: json.message || "Unknown error from NewAPI" },
      { status: 500 }
    );
  }
}

// Fetch balance from OpenRouter provider
async function fetchOpenRouterBalance(config: any) {
  const { apiKey } = config;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OpenRouter API key" },
      { status: 500 }
    );
  }

  const response = await fetch("https://openrouter.ai/api/v1/credits", {
    method: "GET",
    headers: {
      ...BROWSER_HEADERS,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      return NextResponse.json(
        { error: "Unauthorized. Check your OpenRouter API Key." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: `API responded with status ${response.status}: ${errorText}` },
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
}

// Fetch balance from DeepSeek provider
async function fetchDeepSeekBalance(config: any) {
  const { apiKey } = config;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DeepSeek API key" },
      { status: 500 }
    );
  }

  const response = await fetch("https://api.deepseek.com/user/balance", {
    method: "GET",
    headers: {
      ...BROWSER_HEADERS,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      return NextResponse.json(
        { error: "Unauthorized. Check your DeepSeek API Key." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: `API responded with status ${response.status}: ${errorText}` },
      { status: response.status }
    );
  }

  const json = await response.json();
  
  // DeepSeek returns { is_available, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
  // We prefer CNY if available, otherwise use the first currency
  const cnyBalance = json.balance_infos?.find((b: any) => b.currency === "CNY");
  const balanceInfo = cnyBalance || json.balance_infos?.[0];
  
  if (!balanceInfo) {
    return NextResponse.json(
      { error: "No balance information returned from DeepSeek" },
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
    used_quota: 0, // DeepSeek doesn't provide used quota in this endpoint
    request_count: 0,
    isRawCNY: balanceInfo.currency === "CNY",
    isRawUSD: balanceInfo.currency === "USD",
    granted_balance: grantedBalance,
    topped_up_balance: toppedUpBalance,
    currency: balanceInfo.currency,
  });
}

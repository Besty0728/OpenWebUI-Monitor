"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Provider {
  id: string;
  name: string;
  type: "newapi" | "openrouter" | "deepseek";
  icon?: string;
  enabled: boolean;
  sortOrder: number;
}

interface ProviderBalance {
  id: number;
  username: string;
  display_name: string;
  status: number;
  quota: number;
  used_quota: number;
  request_count: number;
  isRawUSD?: boolean;
  isRawCNY?: boolean;
  currency?: string;
}

interface ProviderWithBalance {
  provider: Provider;
  balance: ProviderBalance | null;
  error: string;
  loading: boolean;
}

export default function StatusPage() {
  const { t } = useTranslation("common");
  const [providers, setProviders] = useState<ProviderWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch all providers and their balances
  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      // Fetch public provider list
      const res = await fetch("/api/status/providers");
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Failed to fetch providers");
      }

      const providerList: Provider[] = json.data;
      
      // Sort client-side just in case server sort is not relied upon, but server sorts by sort_order
      // providerList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      // Fetch balances for each provider via public proxy
      const providersWithBalances = await Promise.all(
        providerList.map(async (provider) => {
          try {
            const balanceRes = await fetch(`/api/status/providers/${provider.id}?t=${Date.now()}`);
            if (balanceRes.ok) {
              const balance = await balanceRes.json();
              return { provider, balance, error: "", loading: false };
            } else {
              const errData = await balanceRes.json();
              return { provider, balance: null, error: errData.error || "Failed to fetch", loading: false };
            }
          } catch (err: any) {
            return { provider, balance: null, error: err.message || "Network error", loading: false };
          }
        })
      );

      // We maintain the order from providerList because map preserves order
      setProviders(providersWithBalances);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number, isRaw: boolean = false, currency: string = "USD") => {
    const value = isRaw ? amount : amount / 500000;
    
    if (currency === "CNY") {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };

  const getProviderIcon = (provider: Provider, size: number = 20) => {
    if (provider.type === "newapi") {
      return (
        <>
          <img src="/icons/newapi-light.svg" alt="NewAPI" width={size} height={size} className="dark:hidden" />
          <img src="/icons/newapi-dark.svg" alt="NewAPI" width={size} height={size} className="hidden dark:block" />
        </>
      );
    }
    if (provider.type === "openrouter") {
      return (
        <>
          <img src="/icons/openrouter-light.svg" alt="OpenRouter" width={size} height={size} className="dark:hidden" />
          <img src="/icons/openrouter-dark.svg" alt="OpenRouter" width={size} height={size} className="hidden dark:block" />
        </>
      );
    }
    return <img src="/icons/deepseek.svg" alt="DeepSeek" width={size} height={size} />;
  };

  const renderProviderCard = (item: ProviderWithBalance) => {
    const { provider, balance, error: cardError, loading: cardLoading } = item;
    const isRaw = balance?.isRawUSD || balance?.isRawCNY || provider.type === "openrouter" || provider.type === "deepseek";
    const currency = balance?.currency || (provider.type === "deepseek" ? "CNY" : "USD");

    if (cardLoading) {
      return (
        <Card key={provider.id} className="flex flex-col justify-between h-[280px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getProviderIcon(provider)}
              {provider.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      );
    }

    if (cardError) {
      return (
        <Card key={provider.id} className="flex flex-col justify-between h-[280px] border-red-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-red-500 flex items-center gap-2">
              {getProviderIcon(provider)}
              {provider.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center items-center flex-1 text-center p-4">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-muted-foreground mb-4">{cardError}</p>
          </CardContent>
        </Card>
      );
    }

    if (!balance) return null;

    const theme = {
        deepseek: {
            gradient: "from-blue-50/50 dark:from-blue-950/20",
            iconBg: "bg-blue-100 dark:bg-blue-900/30",
            textColor: "text-blue-600 dark:text-blue-400",
        },
        newapi: {
            gradient: "from-purple-50/50 dark:from-purple-950/20",
            iconBg: "bg-purple-100 dark:bg-purple-900/30",
            textColor: "text-purple-600 dark:text-purple-400",
        },
        openrouter: {
            gradient: "from-gray-50/50 dark:from-gray-950/20",
            iconBg: "bg-gray-100 dark:bg-gray-800",
            textColor: "text-gray-700 dark:text-gray-300",
        }
    }[provider.type] || { gradient: "", iconBg: "", textColor: "" };

    const officialUrl = provider.type === "deepseek" ? "https://platform.deepseek.com" : provider.type === "openrouter" ? "https://openrouter.ai" : null;

    return (
      <div key={provider.id} className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md h-[280px] flex flex-col">
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} via-transparent to-transparent opacity-50`} />
        
        <div className="p-6 flex flex-col h-full relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 ${theme.iconBg} rounded-lg`}>
                {getProviderIcon(provider, 28)}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{provider.name}</h3>
                <p className="text-xs text-muted-foreground">{balance.username}</p>
              </div>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${balance.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {balance.status === 1 ? 'Active' : 'Inactive'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("globalai.totalQuota")}</p>
              <div className={`text-2xl font-bold tracking-tight ${theme.textColor}`}>
                {formatCurrency(balance.quota, isRaw, currency)}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("globalai.usedQuota")}</p>
              <div className="text-2xl font-bold tracking-tight">
                {formatCurrency(balance.used_quota, isRaw, currency)}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span>{t("globalai.requests")}: {balance.request_count}</span>
            </div>
            <div className="flex items-center gap-2">
              {officialUrl && (
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs px-2 py-0.5 rounded hover:underline ${theme.textColor}`}
                >
                  {t("apiBalance.official")}
                </a>
              )}
              <div className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                {provider.type === "newapi" ? "NewAPI" : provider.type === "openrouter" ? "OpenRouter" : "DeepSeek"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8 mt-4 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("globalai.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("globalai.description")}
          </p>
        </div>
        <div className="flex gap-2">
           <Button 
            variant="outline" 
            onClick={fetchData} 
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("globalai.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading && providers.length === 0 ? (
          <Card className="flex flex-col justify-between h-[280px]">
            <CardContent className="flex justify-center items-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <>
            {providers.map((item) => renderProviderCard(item))}
          </>
        )}
      </div>
    </div>
  );
}

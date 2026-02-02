"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, RefreshCw, Wallet, Activity, Plus, Database, Globe, Trash2, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Provider {
  id: string;
  name: string;
  type: "newapi" | "openrouter" | "deepseek";
  icon?: string;
  config: any;
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

interface ProviderForm {
  name: string;
  type: "newapi" | "openrouter" | "deepseek";
  icon: string;
  config: {
    apiUrl: string;
    apiToken: string;
    userId: string;
    apiKey: string;
  };
}

const ProviderDialogContent = ({
  isEdit,
  providerForm,
  setProviderForm,
  onCancel,
  onSubmit,
  t
}: {
  isEdit: boolean;
  providerForm: ProviderForm;
  setProviderForm: (form: ProviderForm) => void;
  onCancel: () => void;
  onSubmit: () => void;
  t: any;
}) => (
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>{isEdit ? t("common.edit") : t("globalai.addProvider")}</DialogTitle>
      <DialogDescription className="sr-only">
        {isEdit ? "Edit provider configuration" : "Add a new API provider configuration"}
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name">{t("apiBalance.providerName")}</Label>
        <Input
          id="name"
          value={providerForm.name}
          onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
          placeholder="e.g. GlobalAI"
        />
      </div>
      <div className="grid gap-2">
        <Label>{t("apiBalance.providerType")}</Label>
        <Select
          value={providerForm.type}
          onValueChange={(value: "newapi" | "openrouter" | "deepseek") => setProviderForm({ ...providerForm, type: value })}
          disabled={isEdit} // Disable type change on edit
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newapi">NewAPI</SelectItem>
            <SelectItem value="openrouter">OpenRouter</SelectItem>
            <SelectItem value="deepseek">DeepSeek</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {providerForm.type === "newapi" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="apiUrl">API URL</Label>
            <Input
              id="apiUrl"
              value={providerForm.config.apiUrl}
              onChange={(e) => setProviderForm({
                ...providerForm,
                config: { ...providerForm.config, apiUrl: e.target.value }
              })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apiToken">API Token</Label>
            <Input
              id="apiToken"
              type="password"
              value={providerForm.config.apiToken}
              onChange={(e) => setProviderForm({
                ...providerForm,
                config: { ...providerForm.config, apiToken: e.target.value }
              })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={providerForm.config.userId}
              onChange={(e) => setProviderForm({
                ...providerForm,
                config: { ...providerForm.config, userId: e.target.value }
              })}
            />
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={providerForm.config.apiKey}
            onChange={(e) => setProviderForm({
              ...providerForm,
              config: { ...providerForm.config, apiKey: e.target.value }
            })}
          />
        </div>
      )}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
      <Button onClick={onSubmit}>{t("common.save")}</Button>
    </DialogFooter>
  </DialogContent>
);

// Sortable Item Component
const SortableProviderCard = ({ 
  item, 
  onEdit, 
  onDelete, 
  renderCard 
}: { 
  item: ProviderWithBalance; 
  onEdit: (provider: Provider) => void;
  onDelete: (id: string) => void;
  renderCard: (item: ProviderWithBalance, listeners?: any, attributes?: any, style?: any) => React.ReactNode 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.provider.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderCard(item, listeners, attributes)}
    </div>
  );
};

export default function APIBalancePage() {
  const { t } = useTranslation("common");
  const [providers, setProviders] = useState<ProviderWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Form state for adding/editing provider
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderForm>({
    name: "",
    type: "newapi" as "newapi" | "openrouter" | "deepseek",
    icon: "",
    config: {
      apiUrl: "",
      apiToken: "",
      userId: "",
      apiKey: "",
    },
  });

  // Fetch all providers and their balances
  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/providers");
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Failed to fetch providers");
      }

      const providerList: Provider[] = json.data;

      // Fetch balances for each provider
      const providersWithBalances = await Promise.all(
        providerList.map(async (provider) => {
          try {
            const balanceRes = await fetch(`/api/providers/${provider.id}?t=${Date.now()}`);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setProviders((items) => {
        const oldIndex = items.findIndex((item) => item.provider.id === active.id);
        const newIndex = items.findIndex((item) => item.provider.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save new order to backend
        const orderUpdates = newItems.map((item, index) => ({
          id: item.provider.id,
          sortOrder: index,
        }));
        
        // Optimistic update done, now sync with server
        fetch("/api/providers/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: orderUpdates }),
        }).catch(err => {
          console.error("Failed to save order:", err);
          // Revert or show toast on error (optional)
        });

        return newItems;
      });
    }
  };

  // Open Edit Dialog
  const handleEdit = (provider: Provider) => {
    setEditingProviderId(provider.id);
    let config = { apiUrl: "", apiToken: "", userId: "", apiKey: "" };
    
    // Polyfill or spread existing config correctly based on type
    if (provider.type === "newapi") {
      config = { ...config, ...provider.config };
    } else {
      config = { ...config, apiKey: provider.config.apiKey };
    }

    setProviderForm({
      name: provider.name,
      type: provider.type,
      icon: provider.icon || "",
      config,
    });
    setIsEditDialogOpen(true);
  };

  // Submit Handler (Add or Edit)
  const handleSubmitProvider = async (isEdit: boolean) => {
    try {
      const configToSave = providerForm.type === "newapi" 
        ? { apiUrl: providerForm.config.apiUrl, apiToken: providerForm.config.apiToken, userId: providerForm.config.userId }
        : { apiKey: providerForm.config.apiKey };

      const url = isEdit ? "/api/providers" : "/api/providers";
      const method = isEdit ? "PUT" : "POST";
      const body: any = {
        name: providerForm.name,
        type: providerForm.type,
        icon: providerForm.icon || undefined,
        config: configToSave,
      };

      if (isEdit && editingProviderId) {
        body.id = editingProviderId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      // Reset form
      setEditingProviderId(null);
      setProviderForm({ name: "", type: "newapi", icon: "", config: { apiUrl: "", apiToken: "", userId: "", apiKey: "" } });
      fetchData();
    } catch (err: any) {
      alert(`Failed to ${isEdit ? 'update' : 'add'} provider: ` + err.message);
    }
  };

  // Delete a provider
  const handleDeleteProvider = async (id: string) => {
    if (!confirm(t("apiBalance.confirmDelete"))) return;

    try {
      const res = await fetch(`/api/providers?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      fetchData();
    } catch (err: any) {
      alert("Failed to delete provider: " + err.message);
    }
  };

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

  const renderProviderCard = (item: ProviderWithBalance, listeners?: any, attributes?: any) => {
    const { provider, balance, error: cardError, loading: cardLoading } = item;
    const isRaw = balance?.isRawUSD || balance?.isRawCNY || provider.type === "openrouter" || provider.type === "deepseek";
    const currency = balance?.currency || (provider.type === "deepseek" ? "CNY" : "USD");

    // Common card props with drag listeners attached to the whole card or a handle
    // Attaching to whole card for now, but adding class 'cursor-move'
    const cardProps = { ...listeners, ...attributes };

    if (cardLoading) {
      return (
        <Card className="flex flex-col justify-between h-[280px]">
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
        <Card className="flex flex-col justify-between h-[280px] border-red-200">
           {/* Add drag handle or make header draggable */}
          <div className="absolute top-2 right-2 flex gap-1 z-20">
             <Button variant="ghost" size="icon" onClick={() => handleEdit(provider)}>
                <Settings className="w-4 h-4 text-gray-400" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDeleteProvider(provider.id)}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
          </div>
          
          <div {...cardProps} className="cursor-grab active:cursor-grabbing h-full flex flex-col justify-between">
             <CardHeader className="flex flex-row items-center justify-between pointer-events-none"> {/* Disable pointer events on children to ensure drag works smooth on header if needed */}
                <CardTitle className="text-red-500 flex items-center gap-2">
                {getProviderIcon(provider)}
                {provider.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-center items-center flex-1 text-center p-4">
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-sm text-muted-foreground mb-4">{cardError}</p>
            </CardContent>
          </div>
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
      <div className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md h-[280px] flex flex-col group">
        <div {...cardProps} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/5 transition-colors" /> {/* Drag area layer */}
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} via-transparent to-transparent opacity-50 pointer-events-none`} />
        
        {/* Controls Layer - High Z-index */}
        <div className="absolute top-4 right-4 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/50 backdrop-blur-sm hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40" onClick={(e) => { e.stopPropagation(); handleEdit(provider); }}>
                <Settings className="w-4 h-4 text-gray-500" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/50 backdrop-blur-sm hover:bg-red-50 dark:bg-black/20 dark:hover:bg-red-900/40" onClick={(e) => { e.stopPropagation(); handleDeleteProvider(provider.id); }}>
                <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
        </div>
        
        <div className="p-6 flex flex-col h-full relative z-10 pointer-events-none"> {/* Content is not draggable, but clicks pass through if needed, but we put drag layer behind */}
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

          <div className="mt-auto pt-4 border-t flex items-center justify-between text-sm text-muted-foreground pointer-events-auto"> {/* Enable pointer events for links */}
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
                 onClick={(e) => e.stopPropagation()} // Prevent drag when clicking link
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
    <div className="container mx-auto py-8 space-y-8 mt-16 px-4 sm:px-6">
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
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t("globalai.addProvider")}
              </Button>
            </DialogTrigger>
            <ProviderDialogContent 
              isEdit={false} 
              providerForm={providerForm}
              setProviderForm={setProviderForm}
              onCancel={() => setIsAddDialogOpen(false)}
              onSubmit={() => handleSubmitProvider(false)}
              t={t}
            />
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
             <ProviderDialogContent 
              isEdit={true} 
              providerForm={providerForm}
              setProviderForm={setProviderForm}
              onCancel={() => setIsEditDialogOpen(false)}
              onSubmit={() => handleSubmitProvider(true)}
              t={t}
            />
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading && providers.length === 0 ? (
            <Card className="flex flex-col justify-between h-[280px]">
              <CardContent className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <SortableContext 
              items={providers.map(p => p.provider.id)}
              strategy={rectSortingStrategy}
            >
              {providers.map((item) => (
                <SortableProviderCard 
                  key={item.provider.id} 
                  item={item} 
                  onEdit={handleEdit}
                  onDelete={handleDeleteProvider}
                  renderCard={renderProviderCard}
                />
              ))}
            </SortableContext>
          )}

           {/* Add Provider Card - moved outside SortableContext if we want it fixed, or keep inside if sortable. 
               Usually 'Add' button is fixed at the end. */}
            <div 
              className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center justify-center text-center h-[280px] hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
              onClick={() => {
                  setProviderForm({ name: "", type: "newapi", icon: "", config: { apiUrl: "", apiToken: "", userId: "", apiKey: "" } });
                  setIsAddDialogOpen(true);
              }}
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{t("globalai.addProvider")}</h3>
              <p className="text-sm text-muted-foreground max-w-[200px]">
                {t("apiBalance.addProviderDesc")}
              </p>
            </div>
        </div>
      </DndContext>
    </div>
  );
}

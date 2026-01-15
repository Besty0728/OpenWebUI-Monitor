// Provider type definitions for API Balance monitoring

export type ProviderType = "newapi" | "openrouter" | "deepseek";

export interface ProviderConfig {
  // NewAPI config
  apiUrl?: string;
  apiToken?: string;
  userId?: string;
  // OpenRouter config
  apiKey?: string;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  icon?: string; // Custom icon URL or icon name
  config: ProviderConfig;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProviderBalance {
  id: number;
  username: string;
  displayName: string;
  status: number;
  quota: number;
  usedQuota: number;
  requestCount: number;
}

// Default icons for provider types
export const DEFAULT_PROVIDER_ICONS: Record<ProviderType, string> = {
  newapi: "Database",    // Lucide icon name
  openrouter: "Globe",   // Lucide icon name
  deepseek: "Sparkles",  // Lucide icon name
};

// Convert database row to Provider object
export function rowToProvider(row: any): Provider {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ProviderType,
    icon: row.icon || undefined,
    config: typeof row.config === "string" ? JSON.parse(row.config) : row.config,
    enabled: row.enabled,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

// Convert Provider to database insert values
export function providerToRow(provider: Omit<Provider, "id" | "createdAt" | "updatedAt">) {
  return {
    name: provider.name,
    type: provider.type,
    icon: provider.icon || null,
    config: JSON.stringify(provider.config),
    enabled: provider.enabled,
  };
}

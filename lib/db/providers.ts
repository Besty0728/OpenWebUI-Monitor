import { Provider, ProviderConfig, ProviderType, rowToProvider } from "../providers";
import { randomUUID } from "crypto";

// In-memory storage for mock mode
let mockProviders: Provider[] = [];

// Check if we're in mock mode
const isMockMode = () => process.env.MOCK_DB === "true";

// Ensure api_providers table exists (no-op in mock mode)
export async function ensureProvidersTableExists() {
  if (isMockMode()) {
    console.log("[MOCK] Providers table initialized (in-memory)");
    return;
  }
  
  const { query } = await import("./client");
  await query(`
    CREATE TABLE IF NOT EXISTS api_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('newapi', 'openrouter', 'deepseek')),
      icon TEXT,
      config JSONB NOT NULL DEFAULT '{}',
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Get all providers
export async function getAllProviders(): Promise<Provider[]> {
  if (isMockMode()) {
    return mockProviders;
  }
  
  const { query } = await import("./client");
  const result = await query(`SELECT * FROM api_providers ORDER BY created_at ASC`);
  return result.rows.map(rowToProvider);
}

// Get provider by ID
export async function getProviderById(id: string): Promise<Provider | null> {
  if (isMockMode()) {
    return mockProviders.find(p => p.id === id) || null;
  }
  
  const { query } = await import("./client");
  const result = await query(`SELECT * FROM api_providers WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return rowToProvider(result.rows[0]);
}

// Create a new provider
export async function createProvider(
  name: string,
  type: ProviderType,
  config: ProviderConfig,
  icon?: string
): Promise<Provider> {
  if (isMockMode()) {
    const newProvider: Provider = {
      id: randomUUID(),
      name,
      type,
      config,
      icon,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockProviders.push(newProvider);
    return newProvider;
  }
  
  const { query } = await import("./client");
  const result = await query(
    `INSERT INTO api_providers (name, type, config, icon, enabled) 
     VALUES ($1, $2, $3, $4, true) 
     RETURNING *`,
    [name, type, JSON.stringify(config), icon || null]
  );
  return rowToProvider(result.rows[0]);
}

// Update a provider
export async function updateProvider(
  id: string,
  updates: Partial<Omit<Provider, "id" | "createdAt">>
): Promise<Provider | null> {
  if (isMockMode()) {
    const index = mockProviders.findIndex(p => p.id === id);
    if (index === -1) return null;
    mockProviders[index] = {
      ...mockProviders[index],
      ...updates,
      updatedAt: new Date(),
    };
    return mockProviders[index];
  }
  
  const { query } = await import("./client");
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.type !== undefined) {
    setClauses.push(`type = $${paramIndex++}`);
    values.push(updates.type);
  }
  if (updates.icon !== undefined) {
    setClauses.push(`icon = $${paramIndex++}`);
    values.push(updates.icon);
  }
  if (updates.config !== undefined) {
    setClauses.push(`config = $${paramIndex++}`);
    values.push(JSON.stringify(updates.config));
  }
  if (updates.enabled !== undefined) {
    setClauses.push(`enabled = $${paramIndex++}`);
    values.push(updates.enabled);
  }

  if (setClauses.length === 0) return null;

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query(
    `UPDATE api_providers SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return rowToProvider(result.rows[0]);
}

// Delete a provider
export async function deleteProvider(id: string): Promise<boolean> {
  if (isMockMode()) {
    const index = mockProviders.findIndex(p => p.id === id);
    if (index === -1) return false;
    mockProviders.splice(index, 1);
    return true;
  }
  
  const { query } = await import("./client");
  const result = await query(`DELETE FROM api_providers WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

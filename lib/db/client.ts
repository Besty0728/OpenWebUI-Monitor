import {
  db,
  QueryResult as VercelQueryResult,
} from "@vercel/postgres";
import { Pool, PoolClient } from "pg";

const isVercel = process.env.VERCEL === "1";

let pgPool: Pool | null = null;

function getClient() {
  if (isVercel) {
    return null;
  } else {
    if (!pgPool) {
      const config = {
        host: process.env.POSTGRES_HOST || "db",
        user: process.env.POSTGRES_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE || "openwebui_monitor",
        port: parseInt(process.env.POSTGRES_PORT || "5432"),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
        statement_timeout: 30000,
      };

      if (process.env.POSTGRES_URL) {
        pgPool = new Pool({
          connectionString: process.env.POSTGRES_URL,
          ssl: {
            rejectUnauthorized: false,
          },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 30000,
          statement_timeout: 30000,
        });
      } else {
        pgPool = new Pool(config);
      }

      pgPool.on("error", (err) => {
        console.error("Unexpected error on idle client", err);
        process.exit(-1);
      });
    }
    return pgPool;
  }
}

type CommonQueryResult<T = any> = {
  rows: T[];
  rowCount: number;
};

// --- MOCK DB IMPLEMENTATION ---
const IS_MOCK = process.env.MOCK_DB === "true";

const mockStore = {
  users: new Map([
    ["default", { id: "default", name: "Mock User", email: "mock@local", balance: 100.0, role: "user" }]
  ]),
  modelPrices: new Map(),
  usageRecords: [] as any[],
  providers: [] as any[]
};

if (IS_MOCK) {
  console.log("⚠️ RUNNING IN MOCK DB MODE");
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<CommonQueryResult<T>> {
  if (IS_MOCK) {
    const normalizedText = text.toLowerCase().trim();

    if (normalizedText === "begin" || normalizedText === "commit" || normalizedText === "rollback") {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedText.includes("from model_prices") && normalizedText.includes("where id = $1")) {
      const modelId = params?.[0] || "default-model";
      const model = mockStore.modelPrices.get(modelId);
      if (model) return { rows: [model], rowCount: 1 };
      
      return {
        rows: [{
          id: modelId,
          name: modelId,
          base_model_id: null,
          input_price: 60,
          output_price: 60,
          per_msg_price: -1,
          threshold: 1.0,
          updated_at: new Date()
        }] as any,
        rowCount: 1
      };
    }

    if (normalizedText.includes("update users") && normalizedText.includes("returning balance")) {
      const userId = params?.[1]; 
      const cost = params?.[0];

      const user = mockStore.users.get(userId) || mockStore.users.get("default")!;
      let newBalance = Number(user.balance) - Number(cost);
      if (newBalance < 0) newBalance = 0;

      mockStore.users.set(user.id, { ...user, balance: newBalance });

      return {
        rows: [{ balance: newBalance }] as any,
        rowCount: 1
      };
    }

    if (normalizedText.includes("insert into user_usage_records")) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedText.includes("information_schema")) {
      return { rows: [{ exists: true }] as any, rowCount: 1 };
    }

    if (normalizedText.includes("from users")) {
      return {
        rows: Array.from(mockStore.users.values()) as any,
        rowCount: mockStore.users.size
      };
    }

    if (normalizedText.includes("update model_prices") && normalizedText.includes("returning *")) {
      const id = params?.[0];
      const input = params?.[1];
      const output = params?.[2];
      const per_msg = params?.[3];
      const threshold = params?.[4];

      const model = {
        id,
        model_name: "Mock Model",
        input_price: input,
        output_price: output,
        per_msg_price: per_msg,
        threshold: threshold || 1.0,
        updated_at: new Date()
      };
      
      mockStore.modelPrices.set(id, model);

      return {
        rows: [model] as any,
        rowCount: 1
      };
    }
    
    // API Providers Mock
    if (normalizedText.includes("from api_providers")) {
        // Simple mock for providers
        return { rows: [], rowCount: 0 };
    }

    // console.log("[MockDB] Unhandled query:", text);
    return { rows: [], rowCount: 0 };
  }

  try {
    if (isVercel) {
      // Use @vercel/postgres 'db' which uses a pool
      const result = await db.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } else {
      const client = getClient() as Pool;
      const result = await client.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    }
  } catch (error) {
    console.error("[DB Query Error]", error);
    throw error;
  }
}

if (typeof window === "undefined" && !IS_MOCK) {
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing database connections");
    if (pgPool) {
      await pgPool.end();
    }
    // Vercel db pool handles itself
  });
}

export { getClient };

export async function updateModelPrice(
  id: string,
  input_price: number,
  output_price: number,
  per_msg_price: number,
  threshold: number
): Promise<ModelPrice | null> {
  try {
    const result = await query(
      `UPDATE model_prices 
       SET 
         input_price = CAST($2 AS NUMERIC(10,6)),
         output_price = CAST($3 AS NUMERIC(10,6)),
         per_msg_price = CAST($4 AS NUMERIC(10,6)),
         threshold = CAST($5 AS NUMERIC(10,6)),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, input_price, output_price, per_msg_price, threshold]
    );

    if (result.rows[0]) {
      return {
        id: result.rows[0].id,
        name: result.rows[0].model_name,
        input_price: Number(result.rows[0].input_price),
        output_price: Number(result.rows[0].output_price),
        per_msg_price: Number(result.rows[0].per_msg_price),
        threshold: Number(result.rows[0].threshold || 1.0),
        updated_at: result.rows[0].updated_at,
      };
    }
    return null;
  } catch (error) {
    console.error("Error updating model price:", error);
    throw error;
  }
}

export async function ensureTablesExist() {
  if (IS_MOCK) return;

  try {
    // 1. Users Table
    const usersTableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);

    if (!usersTableExists.rows[0].exists) {
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          balance DECIMAL(16, 6) NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          deleted BOOLEAN DEFAULT FALSE
        );
      `);
    } else {
      try {
        await query(`
          DO $$ 
          BEGIN 
            BEGIN
              ALTER TABLE users 
              ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
            EXCEPTION 
              WHEN duplicate_column THEN NULL;
            END;
          END $$;
        `);
      } catch (error) {
        console.error("Error adding deleted column to users table:", error);
      }
    }

    // 2. Model Prices Table
    const modelPricesTableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'model_prices'
      );
    `);

    const defaultInputPrice = parseFloat(
      process.env.DEFAULT_MODEL_INPUT_PRICE || "60"
    );
    const defaultOutputPrice = parseFloat(
      process.env.DEFAULT_MODEL_OUTPUT_PRICE || "60"
    );
    const defaultPerMsgPrice = parseFloat(
      process.env.DEFAULT_MODEL_PER_MSG_PRICE || "-1"
    );

    if (!modelPricesTableExists.rows[0].exists) {
      await query(`
        CREATE TABLE IF NOT EXISTS model_prices (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          base_model_id TEXT,
          input_price NUMERIC(10, 6) DEFAULT ${defaultInputPrice},
          output_price NUMERIC(10, 6) DEFAULT ${defaultOutputPrice},
          per_msg_price NUMERIC(10, 6) DEFAULT ${defaultPerMsgPrice},
          threshold NUMERIC(10, 6) DEFAULT 1.0,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      try {
        await query(`
          DO $$ 
          BEGIN 
            BEGIN
              ALTER TABLE model_prices 
              ADD COLUMN per_msg_price NUMERIC(10, 6) DEFAULT ${defaultPerMsgPrice};
            EXCEPTION 
              WHEN duplicate_column THEN NULL;
            END;
          END $$;
        `);
      } catch (error) {
        console.error("Error adding per_msg_price column:", error);
      }

      try {
        await query(`
          DO $$ 
          BEGIN 
            BEGIN
              ALTER TABLE model_prices 
              ADD COLUMN base_model_id TEXT;
            EXCEPTION 
              WHEN duplicate_column THEN NULL;
            END;
          END $$;
        `);
      } catch (error) {
        console.error("Error adding base_model_id column:", error);
      }

      try {
        await query(`
          DO $$ 
          BEGIN 
            BEGIN
              ALTER TABLE model_prices 
              ADD COLUMN threshold NUMERIC(10, 6) DEFAULT 1.0;
            EXCEPTION 
              WHEN duplicate_column THEN NULL;
            END;
          END $$;
        `);
      } catch (error) {
        console.error("Error adding threshold column:", error);
      }
    }

    // 3. User Usage Records Table
    const userUsageRecordsTableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_usage_records'
      );
    `);

    if (!userUsageRecordsTableExists.rows[0].exists) {
      await query(`
        CREATE TABLE IF NOT EXISTS user_usage_records (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          nickname VARCHAR(255) NOT NULL,
          use_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          model_name VARCHAR(255) NOT NULL,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          cost DECIMAL(10, 4) NOT NULL,
          balance_after DECIMAL(10, 4) NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);
    }

    // 4. API Providers Table
    const apiProvidersTableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'api_providers'
      );
    `);

    if (!apiProvidersTableExists.rows[0].exists) {
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
    } else {
        try {
             await query(`ALTER TABLE api_providers DROP CONSTRAINT IF EXISTS api_providers_type_check`);
             await query(`ALTER TABLE api_providers ADD CONSTRAINT api_providers_type_check CHECK (type IN ('newapi', 'openrouter', 'deepseek'))`);
        } catch(e) {
            console.error("Failed to update api_providers check constraint", e);
        }
    }

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database tables:", error);
    throw error;
  }
}

export async function initDatabase() {
  try {
    await ensureTablesExist();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

export interface ModelPrice {
  id: string;
  name: string;
  input_price: number;
  output_price: number;
  per_msg_price: number;
  threshold: number;
  updated_at: Date;
}

export interface UserUsageRecord {
  id: number;
  userId: number;
  nickname: string;
  useTime: Date;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  balanceAfter: number;
  balance: number;
}

export async function getOrCreateModelPrices(
  models: Array<{ id: string; name: string; base_model_id?: string }>
): Promise<ModelPrice[]> {
  if (IS_MOCK) {
    const modelPrices: ModelPrice[] = models.map(m => ({
      id: m.id,
      name: m.name,
      input_price: 60,
      output_price: 60,
      per_msg_price: -1,
      threshold: 1.0,
      updated_at: new Date()
    }));
    return modelPrices;
  }

  try {
    const defaultInputPrice = parseFloat(
      process.env.DEFAULT_MODEL_INPUT_PRICE || "60"
    );
    const defaultOutputPrice = parseFloat(
      process.env.DEFAULT_MODEL_OUTPUT_PRICE || "60"
    );
    const defaultPerMsgPrice = parseFloat(
      process.env.DEFAULT_MODEL_PER_MSG_PRICE || "-1"
    );

    const modelIds = models.map((m) => m.id);
    const baseModelIds = models.map((m) => m.base_model_id).filter((id) => id);

    const existingModelsResult = await query(
      `SELECT * FROM model_prices WHERE id = ANY($1::text[])`,
      [modelIds]
    );

    const baseModelsResult = await query(
      `SELECT * FROM model_prices WHERE id = ANY($1::text[])`,
      [baseModelIds]
    );

    const existingModels = new Map(
      existingModelsResult.rows.map((row) => [row.id, row])
    );
    const baseModels = new Map(
      baseModelsResult.rows.map((row) => [row.id, row])
    );

    const modelsToUpdate = models.filter((m) => existingModels.has(m.id));
    const missingModels = models.filter((m) => !existingModels.has(m.id));

    if (modelsToUpdate.length > 0) {
      for (const model of modelsToUpdate) {
        await query(`UPDATE model_prices SET name = $2 WHERE id = $1`, [
          model.id,
          model.name,
        ]);
      }
    }

    if (missingModels.length > 0) {
      for (const model of missingModels) {
        const baseModel = model.base_model_id
          ? baseModels.get(model.base_model_id)
          : null;

        await query(
          `INSERT INTO model_prices (id, name, input_price, output_price, per_msg_price, threshold)
           VALUES ($1, $2, $3, $4, $5, 1.0)
           RETURNING *`,
          [
            model.id,
            model.name,
            baseModel?.input_price ?? defaultInputPrice,
            baseModel?.output_price ?? defaultOutputPrice,
            baseModel?.per_msg_price ?? defaultPerMsgPrice,
          ]
        );
      }
    }

    const updatedModelsResult = await query(
      `SELECT * FROM model_prices WHERE id = ANY($1::text[])`,
      [modelIds]
    );

    return updatedModelsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      input_price: Number(row.input_price),
      output_price: Number(row.output_price),
      per_msg_price: Number(row.per_msg_price),
      threshold: Number(row.threshold || 1.0),
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error("Error in getOrCreateModelPrices:", error);
    throw error;
  }
}


export async function updateUserBalance(userId: string, balance: number) {
  try {
    const result = await query(
      `UPDATE users
       SET balance = $2
       WHERE id = $1
       RETURNING id, email, balance`,
      [userId, balance]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error in updateUserBalance:", error);
    throw error;
  }
}

export const pool = {
  connect: async () => {
    if (isVercel) {
      // Vercel Postgres pool handles connection automatically via db.connect() if needed,
      // but db.query() is preferred. For compatibility with pool-style usage:
      const client = await db.connect();
      return client; 
    } else {
      return (pgPool || (getClient() as Pool)).connect();
    }
  },
  query: async (text: string, params?: any[]) => {
    return query(text, params);
  },
  end: async () => {
    if (isVercel) {
       // db pool doesn't strictly need manual ending in serverless, but if we opened a client via connect:
       // The VercelClient returned by db.connect() has release().
    } else if (pgPool) {
      await pgPool.end();
    }
  },
};

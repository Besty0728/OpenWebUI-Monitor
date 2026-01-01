import { NextResponse } from "next/server";
import { ensureTablesExist, getOrCreateModelPrices } from "@/lib/db/client";
import { verifyApiToken } from "@/lib/auth";
import { LRUCache } from "lru-cache";
import { getModelIcon } from "@/lib/model-icons";

const cache = new LRUCache<string, ModelResponse>({
  max: 100,
  ttl: 1000 * 60, // 60 seconds
});

interface ModelInfo {
  id: string;
  base_model_id: string;
  name: string;
  params: {
    system: string;
  };
  meta: {
    profile_image_url: string;
  };
}

interface ModelResponse {
  data: {
    id: string;
    name: string;
    info: ModelInfo;
  }[];
}

export async function GET(req: Request) {
  const authError = verifyApiToken(req);
  if (authError) {
    return authError;
  }

  // --- MOCK MODE FOR LOCAL DEV ---
  if (process.env.MOCK_DB === "true") {
    const mockModels = [
      {
        id: "gpt-4-turbo",
        base_model_id: "gpt-4",
        name: "GPT-4 Turbo (Mock)",
        imageUrl: getModelIcon("gpt-4-turbo", "GPT-4 Turbo"),
        system_prompt: "You are a helpful assistant.",
        input_price: 30,
        output_price: 60,
        per_msg_price: -1,
        updated_at: new Date()
      },
      {
        id: "claude-3-opus",
        base_model_id: "claude-3",
        name: "Claude 3 Opus (Mock)",
        imageUrl: getModelIcon("claude-3-opus", "Claude 3 Opus"),
        system_prompt: "You are Claude.",
        input_price: 15,
        output_price: 75,
        per_msg_price: -1,
        updated_at: new Date()
      },
      {
        id: "gemini-2.0-flash",
        base_model_id: "gemini",
        name: "Gemini 2.0 Flash (Mock)",
        imageUrl: getModelIcon("gemini-2.0-flash", "Gemini 2.0 Flash"),
        system_prompt: "You are Gemini.",
        input_price: 5,
        output_price: 15,
        per_msg_price: 0.1,
        updated_at: new Date()
      },
      {
        id: "deepseek-v3",
        base_model_id: "deepseek",
        name: "DeepSeek V3 (Mock)",
        imageUrl: getModelIcon("deepseek-v3", "DeepSeek V3"),
        system_prompt: "You are DeepSeek.",
        input_price: 2,
        output_price: 8,
        per_msg_price: -1,
        updated_at: new Date()
      },
      {
        id: "qwen-72b",
        base_model_id: "qwen",
        name: "Qwen 72B (Mock)",
        imageUrl: getModelIcon("qwen-72b", "Qwen 72B"),
        system_prompt: "You are Qwen.",
        input_price: 4,
        output_price: 12,
        per_msg_price: -1,
        updated_at: new Date()
      },
      {
        id: "grok-2",
        base_model_id: "grok",
        name: "Grok 2 (Mock)",
        imageUrl: getModelIcon("grok-2", "Grok 2"),
        system_prompt: "You are Grok.",
        input_price: 10,
        output_price: 30,
        per_msg_price: -1,
        updated_at: new Date()
      },
      {
        id: "unknown-model",
        base_model_id: "unknown",
        name: "Unknown Model (Mock)",
        imageUrl: getModelIcon("unknown-model", "Unknown Model"),
        system_prompt: "You are a model.",
        input_price: 1,
        output_price: 3,
        per_msg_price: -1,
        updated_at: new Date()
      }
    ];
    return NextResponse.json(mockModels);
  }
  // -------------------------------

  try {
    await ensureTablesExist();

    const domain = process.env.OPENWEBUI_DOMAIN;
    if (!domain) {
      throw new Error("OPENWEBUI_DOMAIN environment variable is not set.");
    }

    const cacheKey = "models_list";
    const cachedData = cache.get(cacheKey) as ModelResponse | undefined;
    let data: ModelResponse;

    if (cachedData) {
      data = cachedData;
    } else {
      const apiUrl = domain.replace(/\/+$/, "") + "/api/models";

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${process.env.OPENWEBUI_API_KEY}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error("API response status:", response.status);
        console.error("API response text:", await response.text());
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
        cache.set(cacheKey, data);
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        throw new Error("Invalid JSON response from API");
      }
    }

    if (!data || !Array.isArray(data.data)) {
      console.error("Unexpected API response structure:", data);
      throw new Error("Unexpected API response structure");
    }

    const apiModelsMap = new Map();
    data.data.forEach((item) => {
      // 获取 OpenWebUI 返回的原始图片 URL（用于回退）
      let originalImageUrl = item.info?.meta?.profile_image_url || "";
      if (originalImageUrl.startsWith("/")) {
        originalImageUrl = domain.replace(/\/+$/, "") + originalImageUrl;
      }

      // 使用智能图标匹配
      const imageUrl = getModelIcon(
        String(item.id),
        String(item.name),
        originalImageUrl
      );

      apiModelsMap.set(String(item.id), {
        name: String(item.name),
        base_model_id: item.info?.base_model_id || "",
        imageUrl: imageUrl,
        system_prompt: item.info?.params?.system || "",
      });
    });

    const modelsWithPrices = await getOrCreateModelPrices(
      data.data.map((item) => {
        let baseModelId = item.info?.base_model_id;

        if (!baseModelId && item.id) {
          const idParts = String(item.id).split(".");
          if (idParts.length > 1) {
            baseModelId = idParts[idParts.length - 1];
          }
        }

        return {
          id: String(item.id),
          name: String(item.name),
          base_model_id: baseModelId,
        };
      })
    );

    const dbModelsMap = new Map();
    modelsWithPrices.forEach((model) => {
      dbModelsMap.set(model.id, {
        input_price: model.input_price,
        output_price: model.output_price,
        per_msg_price: model.per_msg_price,
        updated_at: model.updated_at,
      });
    });

    const validModels = Array.from(apiModelsMap.entries()).map(
      ([id, apiModel]) => {
        const dbModel = dbModelsMap.get(id) || {
          input_price: 60,
          output_price: 60,
          per_msg_price: -1,
          updated_at: new Date(),
        };

        let baseModelId = apiModel.base_model_id;
        if (!baseModelId && id) {
          const idParts = String(id).split(".");
          if (idParts.length > 1) {
            baseModelId = idParts[idParts.length - 1];
          }
        }

        return {
          id: id,
          base_model_id: baseModelId,
          name: apiModel.name,
          imageUrl: apiModel.imageUrl,
          system_prompt: apiModel.system_prompt,
          input_price: dbModel.input_price,
          output_price: dbModel.output_price,
          per_msg_price: dbModel.per_msg_price,
          updated_at: dbModel.updated_at,
        };
      }
    );

    return NextResponse.json(validModels);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch models",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const authError = verifyApiToken(req);
  if (authError) {
    return authError;
  }

  const data = await req.json();

  return new Response("Inlet placeholder response", {
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT(req: Request) {
  const authError = verifyApiToken(req);
  if (authError) {
    return authError;
  }

  const data = await req.json();

  return new Response("Outlet placeholder response", {
    headers: { "Content-Type": "application/json" },
  });
}

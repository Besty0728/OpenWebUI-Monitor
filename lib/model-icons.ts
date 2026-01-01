/**
 * 模型图标自动匹配模块
 * 
 * 根据模型 ID/名称自动匹配对应的厂商图标
 * 支持关键词自动匹配和手动 ID 覆盖
 */

// 图标基础路径
const ICON_BASE_PATH = '/model-icons';

// 默认图标（使用 OpenWebUI 的 favicon 或其他通用图标）
const DEFAULT_ICON = `${ICON_BASE_PATH}/default.svg`;

/**
 * 自动匹配规则
 * keywords: 模型 ID 或名称中包含的关键词（小写）
 * icon: 对应的图标文件名
 */
const ICON_RULES: { keywords: string[]; icon: string }[] = [
    // Claude (Anthropic)
    { keywords: ['claude'], icon: 'claude.svg' },
    // GPT / O1 / O3 (OpenAI)
    { keywords: ['gpt', 'o1', 'o3'], icon: 'openai.svg' },
    // Gemini (Google)
    { keywords: ['gemini'], icon: 'gemini.svg' },
    // DeepSeek
    { keywords: ['deepseek'], icon: 'deepseek.svg' },
    // Qwen (阿里)
    { keywords: ['qwen', 'qwq'], icon: 'qwen.svg' },
    // Grok (xAI)
    { keywords: ['grok'], icon: 'grok.svg' },
];

/**
 * 手动覆盖配置
 * 精确匹配模型 ID，优先级高于自动匹配规则
 * 键为精确的模型 ID，值为图标文件名（不含路径）
 */
const MANUAL_OVERRIDES: Record<string, string> = {
    // 示例：'exact-model-id': 'custom-icon.svg',
};

/**
 * 根据模型 ID 和名称获取对应的图标 URL
 * 
 * @param modelId - 模型 ID
 * @param modelName - 模型名称
 * @param fallbackUrl - OpenWebUI 返回的原始图标 URL（用于回退）
 * @returns 图标 URL
 */
export function getModelIcon(
    modelId: string,
    modelName: string,
    fallbackUrl?: string
): string {
    const idLower = modelId.toLowerCase();
    const nameLower = modelName.toLowerCase();

    // 1. 优先检查手动覆盖
    if (MANUAL_OVERRIDES[modelId]) {
        return `${ICON_BASE_PATH}/${MANUAL_OVERRIDES[modelId]}`;
    }

    // 2. 自动关键词匹配
    for (const rule of ICON_RULES) {
        for (const keyword of rule.keywords) {
            if (idLower.includes(keyword) || nameLower.includes(keyword)) {
                return `${ICON_BASE_PATH}/${rule.icon}`;
            }
        }
    }

    // 3. 如果 fallbackUrl 是有效的非默认 URL，使用它
    if (fallbackUrl && !fallbackUrl.includes('/static/favicon.png')) {
        return fallbackUrl;
    }

    // 4. 返回默认图标
    return DEFAULT_ICON;
}

/**
 * 检查是否有对应的本地图标
 * 用于调试和检查匹配结果
 */
export function hasLocalIcon(modelId: string, modelName: string): boolean {
    const icon = getModelIcon(modelId, modelName);
    return icon.startsWith(ICON_BASE_PATH) && icon !== DEFAULT_ICON;
}

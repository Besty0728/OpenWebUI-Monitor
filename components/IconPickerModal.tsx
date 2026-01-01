"use client";

import { Modal, Tooltip } from "antd";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// 可用的图标列表
const AVAILABLE_ICONS = [
    { id: "claude", name: "Claude (Anthropic)", file: "claude.svg" },
    { id: "openai", name: "GPT (OpenAI)", file: "openai.svg" },
    { id: "gemini", name: "Gemini (Google)", file: "gemini.svg" },
    { id: "deepseek", name: "DeepSeek", file: "deepseek.svg" },
    { id: "qwen", name: "Qwen (阿里)", file: "qwen.svg" },
    { id: "grok", name: "Grok (xAI)", file: "grok.svg" },
    { id: "default", name: "默认图标", file: "default.svg" },
    { id: "auto", name: "自动匹配", file: null },
];

const ICON_BASE_PATH = "/model-icons";
const STORAGE_KEY = "model-icon-overrides";

// 获取存储的图标覆盖配置
export function getIconOverrides(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

// 保存图标覆盖配置
export function setIconOverride(modelId: string, iconFile: string | null) {
    if (typeof window === "undefined") return;
    const overrides = getIconOverrides();
    if (iconFile === null) {
        delete overrides[modelId];
    } else {
        overrides[modelId] = iconFile;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

// 获取模型的自定义图标（如果有）
export function getCustomIcon(modelId: string): string | null {
    const overrides = getIconOverrides();
    const iconFile = overrides[modelId];
    if (iconFile) {
        return `${ICON_BASE_PATH}/${iconFile}`;
    }
    return null;
}

interface IconPickerModalProps {
    open: boolean;
    modelId: string;
    modelName: string;
    currentIcon: string;
    onClose: () => void;
    onSelect: (iconFile: string | null) => void;
}

export function IconPickerModal({
    open,
    modelId,
    modelName,
    currentIcon,
    onClose,
    onSelect,
}: IconPickerModalProps) {
    const { t } = useTranslation("common");
    const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
    const overrides = getIconOverrides();
    const currentOverride = overrides[modelId];

    useEffect(() => {
        if (open) {
            setSelectedIcon(currentOverride || null);
        }
    }, [open, currentOverride]);

    const handleConfirm = () => {
        if (selectedIcon === "auto") {
            onSelect(null);
        } else if (selectedIcon) {
            onSelect(selectedIcon);
        }
        onClose();
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <img src={currentIcon} alt="" className="w-6 h-6 rounded" />
                    <span>{t("models.iconPicker.title") || "选择图标"}: {modelName}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            onOk={handleConfirm}
            okText={t("common.confirm") || "确定"}
            cancelText={t("common.cancel") || "取消"}
            width={400}
        >
            <div className="grid grid-cols-4 gap-3 py-4">
                {AVAILABLE_ICONS.map((icon) => {
                    const isSelected =
                        selectedIcon === icon.file ||
                        (selectedIcon === "auto" && icon.id === "auto") ||
                        (selectedIcon === null && icon.id === "auto" && !currentOverride);

                    return (
                        <Tooltip key={icon.id} title={icon.name}>
                            <button
                                type="button"
                                onClick={() => setSelectedIcon(icon.file || "auto")}
                                className={`
                  flex flex-col items-center justify-center p-3 rounded-lg 
                  border-2 transition-all duration-200
                  ${isSelected
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                                    }
                `}
                            >
                                {icon.file ? (
                                    <img
                                        src={`${ICON_BASE_PATH}/${icon.file}`}
                                        alt={icon.name}
                                        className="w-10 h-10 object-contain"
                                    />
                                ) : (
                                    <div className="w-10 h-10 flex items-center justify-center text-2xl">
                                        🔄
                                    </div>
                                )}
                                <span className="text-xs mt-1 text-muted-foreground truncate max-w-full">
                                    {icon.id === "auto" ? "自动" : icon.id}
                                </span>
                            </button>
                        </Tooltip>
                    );
                })}
            </div>
            {currentOverride && (
                <div className="text-sm text-muted-foreground border-t pt-3">
                    {t("models.iconPicker.currentOverride") || "当前自定义"}: {currentOverride}
                </div>
            )}
        </Modal>
    );
}

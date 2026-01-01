"""
title: Usage Monitor
author: Betsy & VariantConst & OVINC CN
git_url: https://github.com/Besty0728/OpenWebUI-Monitor.git
version: 0.3.7
requirements: httpx
license: MIT
"""

import logging
import time
from typing import Dict, Optional
from httpx import AsyncClient
from pydantic import BaseModel, Field
import json


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

TRANSLATIONS = {
    "en": {
        "request_failed": "Request failed: {error_msg}",
        "insufficient_balance": "Insufficient balance: Current balance `{balance:.4f}`",
        "cost": "Cost: ${cost:.4f}",
        "balance": "Balance: ${balance:.4f}",
        "tokens": "Tokens: {input}+{output}",
        "time_spent": "Time: {time:.2f}s",
        "tokens_per_sec": "{tokens_per_sec:.2f} T/s",
    },
    "zh": {
        "request_failed": "请求失败: {error_msg}",
        "insufficient_balance": "余额不足: 当前余额 `{balance:.4f}`",
        "cost": "费用: ¥{cost:.4f}",
        "balance": "余额: ¥{balance:.4f}",
        "tokens": "Token: {input}+{output}",
        "time_spent": "耗时: {time:.2f}s",
        "tokens_per_sec": "{tokens_per_sec:.2f} T/s",
    },
}


class CustomException(Exception):
    pass


class Filter:
    class Valves(BaseModel):
        api_endpoint: str = Field(default="", description="openwebui-monitor's base url")
        api_key: str = Field(default="", description="openwebui-monitor's api key")
        priority: int = Field(default=5, description="filter priority")
        language: str = Field(default="zh", description="language (en/zh)")
        show_time_spent: bool = Field(default=True, description="show time spent")
        show_tokens_per_sec: bool = Field(default=True, description="show tokens per second")
        show_cost: bool = Field(default=True, description="show cost")
        show_balance: bool = Field(default=True, description="show balance")
        show_tokens: bool = Field(default=True, description="show tokens")

    def __init__(self):
        self.type = "filter"
        self.name = "OpenWebUI Monitor"
        self.valves = self.Valves()
        self.outage_map: Dict[str, bool] = {}
        self.start_time: Optional[float] = None
        
        # Local Caches for Optimistic Admission
        # Structure: {user_id: balance}
        self.user_caches: Dict[str, float] = {}
        # Structure: {model_id: estimated_threshold_cost}
        self.model_thresholds: Dict[str, float] = {}
        
        # Safe threshold to allow admission (e.g. at least 1.0 unit of currency)
        self.SAFE_ADMISSION_THRESHOLD = 1.0

    def get_text(self, key: str, **kwargs) -> str:
        lang = self.valves.language if self.valves.language in TRANSLATIONS else "en"
        text = TRANSLATIONS[lang].get(key, TRANSLATIONS["en"][key])
        return text.format(**kwargs) if kwargs else text

    async def get_client(self) -> AsyncClient:
        if not hasattr(self, "_client") or self._client.is_closed:
            self._client = AsyncClient()
        return self._client

    async def request(self, client: AsyncClient, url: str, headers: dict, json_data: dict):
        json_data = json.loads(json.dumps(json_data, default=lambda o: o.dict() if hasattr(o, "dict") else str(o)))

        response = await client.post(url=url, headers=headers, json=json_data)
        response.raise_for_status()
        response_data = response.json()
        if not response_data.get("success"):
            logger.error(self.get_text("request_failed", error_msg=response_data))
            raise CustomException(self.get_text("request_failed", error_msg=response_data))
        return response_data

    async def inlet(self, body: dict, __metadata__: Optional[dict] = None, __user__: Optional[dict] = None) -> dict:
        __user__ = __user__ or {}
        __metadata__ = __metadata__ or {}
        self.start_time = time.time()
        user_id = __user__.get("id", "default")
        model_id = body.get("model", "default")

        # --- Optimistic Admission Check ---
        cached_balance = self.user_caches.get(user_id)
        
        # Determine threshold for this model
        # Default to SAFE_ADMISSION_THRESHOLD if model usage is unknown
        # Or use the dynamically synced threshold from previous outlet
        threshold = self.model_thresholds.get(model_id, self.SAFE_ADMISSION_THRESHOLD)

        if cached_balance is not None and cached_balance > threshold:
            # VIP Fast Path: Local admission granted
            # Skip network request to Monitor backend
            logger.info(f"Local admission granted for {user_id}. Balance: {cached_balance}, Threshold: {threshold}")
            return body
        
        # --- Fallback: Network Admission Check ---
        client = await self.get_client()

        try:
            response_data = await self.request(
                client=client,
                url=f"{self.valves.api_endpoint}/api/v1/inlet",
                headers={"Authorization": f"Bearer {self.valves.api_key}"},
                json_data={"user": __user__, "body": body},
            )
            
            balance = response_data.get("balance", 0)
            self.user_caches[user_id] = balance
            
            self.outage_map[user_id] = balance <= 0
            if self.outage_map[user_id]:
                logger.info(self.get_text("insufficient_balance", balance=balance))
                raise CustomException(self.get_text("insufficient_balance", balance=balance))
            return body

        except Exception as err:
            logger.exception(self.get_text("request_failed", error_msg=err))
            if isinstance(err, CustomException):
                raise err
            raise Exception(f"error calculating usage, {err}") from err

    async def outlet(
        self,
        body: dict,
        __metadata__: Optional[dict] = None,
        __user__: Optional[dict] = None,
        __event_emitter__: Optional[callable] = None,
    ) -> dict:
        __user__ = __user__ or {}
        __metadata__ = __metadata__ or {}
        user_id = __user__.get("id", "default")
        model_id = body.get("model", "default")

        if self.outage_map.get(user_id, False):
            return body

        client = await self.get_client()

        try:
            response_data = await self.request(
                client=client,
                url=f"{self.valves.api_endpoint}/api/v1/outlet",
                headers={"Authorization": f"Bearer {self.valves.api_key}"},
                json_data={"user": __user__, "body": body},
            )

            # --- Dynamic Sync: Update Local Caches ---
            new_balance = response_data.get("newBalance")
            if new_balance is not None:
                self.user_caches[user_id] = float(new_balance)
            
            model_info = response_data.get("model_info")
            if model_info:
                # Priority 1: Use backend-defined threshold if available
                backend_threshold = float(model_info.get("threshold", 0))
                if backend_threshold > 0:
                    self.model_thresholds[model_id] = backend_threshold
                else:
                    # Priority 2: Estimate threshold from pricing
                    per_msg_price = float(model_info.get("per_msg_price", -1))
                    input_price = float(model_info.get("input_price", 0))
                    
                    if per_msg_price > 0:
                        self.model_thresholds[model_id] = per_msg_price
                    elif input_price > 0:
                        # Use 1k tokens cost as threshold
                        self.model_thresholds[model_id] = input_price / 1000.0
            
            # ----------------------------------------

            stats_list = []
            if self.valves.show_tokens:
                stats_list.append(self.get_text("tokens", input=response_data["inputTokens"], output=response_data["outputTokens"]))
            if self.valves.show_cost:
                stats_list.append(self.get_text("cost", cost=response_data["totalCost"]))
            if self.valves.show_balance:
                stats_list.append(self.get_text("balance", balance=response_data["newBalance"]))
            if self.start_time and self.valves.show_time_spent:
                elapsed = time.time() - self.start_time
                stats_list.append(self.get_text("time_spent", time=elapsed))
                if self.valves.show_tokens_per_sec:
                    tokens_per_sec = (response_data["outputTokens"] / elapsed if elapsed > 0 else 0)
                    stats_list.append(self.get_text("tokens_per_sec", tokens_per_sec=tokens_per_sec))

            stats = " | ".join(stats_list)
            if __event_emitter__:
                await __event_emitter__({"type": "status", "data": {"description": stats, "done": True}})

            logger.info("usage_monitor: %s %s", user_id, stats)
            return body

        except Exception as err:
            logger.exception(self.get_text("request_failed", error_msg=err))
            raise Exception(self.get_text("request_failed", error_msg=err))

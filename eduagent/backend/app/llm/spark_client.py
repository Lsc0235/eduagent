"""
星火大模型 API 客户端 — Spark X2
文档: https://www.xfyun.cn/doc/spark/X1http.html
"""
import json
from typing import AsyncGenerator
from app.config import get_settings


class SparkClient:
    """科大讯飞星火 API 封装"""

    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.spark_api_key
        self.http_url = self.settings.spark_http_url
        self.model_name = self.settings.spark_model or (
            "deepseek-chat" if "deepseek" in self.http_url else "x1"
        )

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    async def chat(self, prompt: str, system_prompt: str = "", history: list = None) -> str:
        import httpx

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        payload = {"model": self.model_name, "messages": messages}
        print(f"[Spark] chat -> {self.http_url} model={self.model_name}")

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(self.http_url, json=payload, headers=self._headers())
                print(f"[Spark] status={resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    print(f"[Spark] body: {resp.text[:300]}")
                    return f"[API 错误 {resp.status_code}: {resp.text[:200]}]"
        except Exception as e:
            print(f"[Spark] 异常: {e}")
            return f"[API 异常: {e}]"

    async def chat_stream(self, prompt: str, system_prompt: str = "", history: list = None) -> AsyncGenerator[str, None]:
        import httpx

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        payload = {"model": self.model_name, "messages": messages, "stream": True}

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", self.http_url, json=payload, headers=self._headers()) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        print(f"[Spark stream] 错误 {resp.status_code}: {body.decode()[:300]}")
                        yield f"[流式输出出错: {resp.status_code}]"
                        return
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line or line == "data:[DONE]":
                            continue
                        if line.startswith("data:"):
                            line = line[5:]
                        try:
                            data = json.loads(line)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            print(f"[Spark stream] 异常: {e}")
            yield f"[流式输出出错: {e}]"

    async def chat_with_structured_output(self, prompt: str, system_prompt: str = "", schema: dict = None) -> dict:
        if schema:
            prompt = f"""{prompt}

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
{json.dumps(schema, ensure_ascii=False, indent=2)}"""

        response = await self.chat(prompt, system_prompt)
        try:
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
            return json.loads(response)
        except json.JSONDecodeError:
            return {"error": "JSON 解析失败", "raw": response}

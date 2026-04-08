from __future__ import annotations

import os

from openai import OpenAI

from essay_chain.logging_config import get_logger

logger = get_logger("llm")


class GPTClient:
    def __init__(self, model: str) -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required for essay chain generation")
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        logger.debug(f"Calling LLM (model={self.model})")
        logger.debug(f"System prompt length: {len(system_prompt)} characters")
        logger.debug(f"User prompt length: {len(user_prompt)} characters")
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        
        result = response.choices[0].message.content.strip()
        logger.debug(f"LLM response length: {len(result)} characters")
        logger.debug(f"LLM tokens used - input: {response.usage.prompt_tokens}, output: {response.usage.completion_tokens}")
        
        return result

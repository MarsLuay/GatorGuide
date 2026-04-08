from __future__ import annotations

import logging
from dataclasses import dataclass

from essay_chain.llm import GPTClient
from essay_chain.logging_config import get_logger

logger = get_logger("stages")


@dataclass(frozen=True)
class ChainOutputs:
    retrieved_context: str
    outline: str
    styled_draft: str
    emotional_draft: str
    critique: str
    refined_essay: str


def generate_outline(llm: GPTClient, user_prompt: str, context: str) -> str:
    logger.info("Starting outline generation...")
    logger.debug(f"User prompt: {user_prompt[:100]}...")
    logger.debug(f"Context length: {len(context)} characters")
    
    system_prompt = (
        "You are an expert university essay strategist. "
        "Create a practical, coherent essay outline from retrieved references."
    )
    user_message = (
        "Task: Generate an outline for the student's essay.\n\n"
        f"Student prompt:\n{user_prompt}\n\n"
        "Retrieved essay references:\n"
        f"{context}\n\n"
        "Output format:\n"
        "1) Thesis\n"
        "2) 4-6 section outline bullets\n"
        "3) Key evidence/examples to include\n"
        "4) Risks to avoid (generic claims, weak transitions, repetition)"
    )
    
    logger.debug("Calling LLM for outline generation...")
    outline = llm.generate(system_prompt=system_prompt, user_prompt=user_message)
    logger.info(f"Outline generation complete. Length: {len(outline)} characters")
    return outline


def style_transform(llm: GPTClient, user_prompt: str, outline: str, style: str) -> str:
    logger.info("Starting style transformation...")
    logger.debug(f"Style profile: {style}")
    logger.debug(f"Outline length: {len(outline)} characters")
    
    system_prompt = "You are a writing stylist focused on clear, admissions-ready academic prose."
    user_message = (
        "Task: Turn the outline into a full draft with this style profile.\n\n"
        f"Style profile: {style}\n\n"
        f"Student prompt:\n{user_prompt}\n\n"
        f"Outline:\n{outline}\n\n"
        "Constraints:\n"
        "- Keep one unified narrative voice\n"
        "- Use concrete details where possible\n"
        "- Keep paragraphs focused and logically connected"
    )
    
    logger.debug("Calling LLM for style transformation...")
    styled_draft = llm.generate(system_prompt=system_prompt, user_prompt=user_message)
    logger.info(f"Style transformation complete. Draft length: {len(styled_draft)} characters")
    return styled_draft


def emotional_pass(llm: GPTClient, styled_draft: str, emotional_goal: str) -> str:
    logger.info("Starting emotional pass...")
    logger.debug(f"Emotional goal: {emotional_goal}")
    logger.debug(f"Current draft length: {len(styled_draft)} characters")
    
    system_prompt = "You improve emotional resonance while keeping authenticity and credibility."
    user_message = (
        "Task: Revise this draft to improve emotional impact without becoming dramatic or artificial.\n\n"
        f"Emotional goal: {emotional_goal}\n\n"
        f"Draft:\n{styled_draft}\n\n"
        "Constraints:\n"
        "- Preserve facts and core meaning\n"
        "- Add subtle emotional texture\n"
        "- Keep language natural and specific"
    )
    
    logger.debug("Calling LLM for emotional pass...")
    emotional_draft = llm.generate(system_prompt=system_prompt, user_prompt=user_message)
    logger.info(f"Emotional pass complete. Draft length: {len(emotional_draft)} characters")
    return emotional_draft


def critique_pass(llm: GPTClient, user_prompt: str, emotional_draft: str) -> str:
    logger.info("Starting critique pass...")
    logger.debug(f"Draft length to critique: {len(emotional_draft)} characters")
    
    system_prompt = "You are a strict admissions essay reviewer using actionable feedback."
    user_message = (
        "Task: Critique this essay draft against the student prompt.\n\n"
        f"Student prompt:\n{user_prompt}\n\n"
        f"Essay draft:\n{emotional_draft}\n\n"
        "Output exactly:\n"
        "- Strengths (3 bullets)\n"
        "- Weaknesses (3-5 bullets)\n"
        "- Revision priorities (numbered, highest impact first)\n"
        "- Final verdict (ready / needs revision + reason)"
    )
    
    logger.debug("Calling LLM for critique...")
    critique = llm.generate(system_prompt=system_prompt, user_prompt=user_message)
    logger.info(f"Critique complete. Critique length: {len(critique)} characters")
    return critique


def refine_pass(llm: GPTClient, emotional_draft: str, critique: str) -> str:
    logger.info("Starting refinement pass...")
    logger.debug(f"Draft length: {len(emotional_draft)} characters")
    logger.debug(f"Critique length: {len(critique)} characters")
    
    system_prompt = "You are a precise editor who applies critique while preserving writer voice."
    user_message = (
        "Task: Produce a refined final essay using this critique.\n\n"
        f"Current draft:\n{emotional_draft}\n\n"
        f"Critique:\n{critique}\n\n"
        "Constraints:\n"
        "- Resolve major weaknesses first\n"
        "- Keep coherent structure and transitions\n"
        "- Return only the refined essay text"
    )
    
    logger.debug("Calling LLM for refinement...")
    refined_essay = llm.generate(system_prompt=system_prompt, user_prompt=user_message)
    logger.info(f"Refinement complete. Final essay length: {len(refined_essay)} characters")
    return refined_essay

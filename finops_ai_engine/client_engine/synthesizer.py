import json
import logging
from typing import Any, Dict
from groq import AsyncGroq
from .config import settings

logger = logging.getLogger("client_engine.synthesizer")

# ==========================================
# 1. THE REVISED DETERMINISTIC PROMPT
# ==========================================
SYNTHESIS_PROMPT = """
You are a professional, senior FinOps analytical reporter communicating directly with an engineering management team.
Your single objective is to translate the enclosed database facts into a clean text summary that directly answers the user's explicit question.

CRITICAL INFERENCE BOUNDARIES:
1. You are strictly forbidden from executing any internal calculations, averages, or aggregations. 
2. Do not invent totals or percentage trends unless those calculated figures are explicitly present inside the source data keys. Report only what is written.
3. If the data payload context contains a truncation warning marker, evaluate the rows strictly as a partial sequential subset. Never describe the slice as if it represents the complete dataset total.
4. Format all financial figures clearly as USD (e.g., $1,450.25). 
5. Translate raw technical string tokens (like 'attributed_core_compute_cost_usd') into human-readable phrases (like 'core compute spend') in your final output sentences.
6. Trust that the provided database response matrix has already been pre-filtered by the constraints specified in the user's question. You may safely assume rows belong to filtered attributes (like app versions) mentioned in the prompt, even if those specific filter columns are omitted from the payload keys.
"""

# ==========================================
# 2. THE CONVERSATIONAL reporting LIFE-CYCLE
# ==========================================

async def synthesize_cube_response(
    client: AsyncGroq,
    user_question: str,
    cube_response_payload: Dict[str, Any]
) -> str:
    """
    Transforms raw Cube.js database response metrics into an explicit,
    conversational text summary. Safeguarded against XML injection and silent errors.
    
    Args:
        client: A long-lived, shared AsyncGroq cloud connection pool instance.
        user_question: The original natural language prompt typed into the CLI.
        cube_response_payload: The raw dictionary response returned from the Cube client.
        
    Returns:
        A deterministic conversational string ready for terminal display.
    """
    
    # --- STEP A1: TRAIN CUBE ENGINE ERROR PAYLOADS ---
    if "error" in cube_response_payload:
        error_msg = cube_response_payload.get("error", "Unknown database compilation anomaly.")
        logger.error(f"Cube.js returned an internal platform exception: {error_msg}")
        raise RuntimeError(f"Cube.js Platform Error: {error_msg}")

    # --- STEP A2: SAFE GEOMETRY LOOKUP & EMPTY CHECK ---
    raw_records = cube_response_payload.get("data", [])
    
    if len(raw_records) == 0:
        logger.info("Empty database response detected. Bypassing cloud API summary generation.")
        return "No data records matched your requested criteria."

    # --- STEP B: CONTEXT-PRESERVING TRUNCATION SLICER ---
    truncation_context_marker = ""
    max_safe_rows = 30
    
    if len(raw_records) > max_safe_rows:
        logger.warning(f"Dataset length ({len(raw_records)} rows) exceeds safety limits. Slicing payload.")
        raw_records = raw_records[:max_safe_rows]
        truncation_context_marker = (
            "\n[DATASET TRUNCATED: Displaying ONLY the first 30 entries of the returned dataset. "
            "Evaluate these rows strictly as a sequential subset and do not assume they represent "
            "the complete distribution total.]\n"
        )

    # --- STEP C: SANITIZATION & XML DELIMITER ENVELOPE ---
    # Convert array to a clean string format
    serialized_json = json.dumps(raw_records, indent=2)
    
    # FIX: Run a defensive string replacement to neutralize nested tags and stop XML injection escapes
    sanitized_json = serialized_json.replace("<", "&lt;").replace(">", "&gt;")
    
    # Wrap cleanly inside un-fakeable structural delimiters
    data_payload_envelope = (
        f"<CUBE_DATA_PAYLOAD>\n"
        f"{truncation_context_marker}"
        f"{sanitized_json}\n"
        f"</CUBE_DATA_PAYLOAD>"
    )

    # --- STEP D: REUSE CLIENT POOL WITH COMPILATION BOUNDS ---
    logger.info("Routing raw database facts to Groq Cloud for conversational summary synthesis...")
    
    response = await client.chat.completions.create(
        messages=[
            {"role": "system", "content": SYNTHESIS_PROMPT},
            {
                "role": "user", 
                "content": f"User Question: {user_question}\n\nDatabase Response Matrix:\n{data_payload_envelope}"
            }
        ],
        model=settings.llm_model,
        # FIX: Hardcode temperature strictly to 0.0 to guarantee deterministic analytical descriptions
        temperature=0.0
    )

    final_narrative_output = response.choices[0].message.content
    if not final_narrative_output:
        raise ValueError("Groq returned an empty text string during response synthesis.")

    return final_narrative_output.strip()

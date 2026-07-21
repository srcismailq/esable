import logging
from typing import Any, Dict, Optional, Literal, TypedDict
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END

# Import your decoupled architectural service layers
from .translator import compile_text_to_cube_query
from .cube_client import execute_cube_query
from .synthesizer import synthesize_cube_response

logger = logging.getLogger("client_engine.graph_engine")

# ==========================================
# 1. THE SHARED MEMORY STATE CONTRACT
# ==========================================

class EngineState(TypedDict):
    """
    The shared memory contract traveling across the LangGraph event loop.
    To satisfy state transitions, this must be seeded at the CLI bootstrap layer
    with baseline parameters matching this layout exactly.
    """
    user_query: str
    cube_json_query: Optional[Dict[str, Any]]
    api_response: Optional[Dict[str, Any]]
    final_answer: Optional[str]
    error_message: Optional[str]

# ==========================================
# 2. CONNECTION-POOLED GRAPH NODE WRAPPERS
# ==========================================

async def translate_query_node(state: EngineState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Node 1: Extracts the pooled cloud client to parse text query into a 
    strictly validated Cube.js JSON structure.
    """
    logger.info("Executing Node: [translate_query_node]")
    
    # IDIOMATIC CONTEXT INGESTION: Extract the shared, long-lived client reference
    groq_client = config.get("configurable", {}).get("groq_client")
    if not groq_client:
        return {"error_message": "System Configuration Error: Long-lived AsyncGroq client pool is missing."}

    try:
        compiled_query = await compile_text_to_cube_query(
            client=groq_client, 
            user_question=state["user_query"]
        )
        return {"cube_json_query": compiled_query}
        
    except Exception as translation_fault:
        logger.error(f"Translation node exception intercepted: {translation_fault}")
        return {"error_message": f"Query Compiling Fault: {str(translation_fault)}"}


async def execute_query_node(state: EngineState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Node 2: Extracts the long-lived HTTP client pool to execute the query payload 
    across the port-forward tunnel into your Minikube cluster.
    """
    logger.info("Executing Node: [execute_query_node]")
    
    # IDIOMATIC CONTEXT INGESTION: Extract the shared, long-lived network pool
    http_client = config.get("configurable", {}).get("http_client")
    if not http_client:
        return {"error_message": "System Configuration Error: Pooled HTTPX AsyncClient session is missing."}

    try:
        # FIXED CRITICAL ENVELOPE BUG: Safe fallback gate preventing AttributeError if cube_json_query evaluates to None
        query_payload = state.get("cube_json_query") or {}
        
        raw_database_rows = await execute_cube_query(
            client=http_client, 
            query_payload=query_payload
        )
        return {"api_response": raw_database_rows}
        
    except Exception as network_fault:
        logger.error(f"Execution node exception intercepted: {network_fault}")
        return {"error_message": f"Database Transport Fault: {str(network_fault)}"}


async def synthesize_response_node(state: EngineState, config: RunnableConfig) -> Dict[str, Any]:
    """
    Node 3: Bundles the original query with the sanitized raw database result data
    to form a deterministic conversational summary response.
    """
    logger.info("Executing Node: [synthesize_response_node]")
    
    groq_client = config.get("configurable", {}).get("groq_client")
    if not groq_client:
        return {"error_message": "System Configuration Error: Long-lived AsyncGroq client pool is missing."}

    try:
        conversational_narrative = await synthesize_cube_response(
            client=groq_client,
            user_question=state["user_query"],
            cube_response_payload=state["api_response"]
        )
        return {"final_answer": conversational_narrative}
        
    except Exception as synthesis_fault:
        logger.error(f"Synthesis node exception intercepted: {synthesis_fault}")
        return {"error_message": f"Response Synthesis Fault: {str(synthesis_fault)}"}

# ==========================================
# 3. CONSOLIDATED CIRCUIT BREAKER ROUTER
# ==========================================

def route_circuit_breaker(state: EngineState) -> Literal["continue", "error"]:
    """
    A single, unified conditional edge router function.
    Breaks execution immediately and jumps straight to END if any upstream
    node flags a system error, protecting the cluster pipeline.
    """
    if state.get("error_message") is not None:
        logger.warning(f"Circuit breaker tripped due to error flag: {state['error_message']}")
        return "error"
    return "continue"

# ==========================================
# 4. WORKFLOW GRAPH BUILDER ASSEMBLY
# ==========================================

# Initialize the StateGraph bounded by our shared EngineState memory definition
workflow = StateGraph(EngineState)

# Wire up the modular execution points
workflow.add_node("translate", translate_query_node)
workflow.add_node("execute", execute_query_node)
workflow.add_node("synthesize", synthesize_response_node)

# Set the deterministic graph entry point
workflow.set_entry_point("translate")

# CONSOLIDATED ROUTING BINDING: Reuse a single instance context manager across both nodes
workflow.add_conditional_edges(
    "translate",
    route_circuit_breaker,
    {
        "continue": "execute",
        "error": END
    }
)

workflow.add_conditional_edges(
    "execute",
    route_circuit_breaker,
    {
        "continue": "synthesize",
        "error": END
    }
)

# Terminate execution gracefully following clean response extraction
workflow.add_edge("synthesize", END)

# Compile the modular layout blueprint into a stateless, executable runnable asset
app = workflow.compile()

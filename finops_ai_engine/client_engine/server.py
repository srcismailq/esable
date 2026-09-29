from contextlib import asynccontextmanager
from typing import Any, Dict, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from groq import AsyncGroq
import httpx
import asyncio


# Pulling in the underlying system assets exactly as your CLI does
from client_engine.config import settings
from client_engine.graph_engine import app, EngineState

# --- 1. INTERNAL DATA CONTRACTS (Encapsulated inside the module) ---

class QueryRequest(BaseModel):
    user_query: str = Field(..., description="The financial or operational query string.")
    stream: bool = Field(default=False, description="Whether to stream the state diff snapshots incrementally.")

    @field_validator("user_query")
    @classmethod
    def ensure_not_empty_or_whitespace(cls, value: str) -> str:
        # Strip whitespace to evaluate if the actual content is blank
        if not value.strip():
            raise ValueError("Query cannot be empty or whitespace-only")
        return value

class QueryResponse(BaseModel):
    cube_json_query: Optional[Dict[str, Any]] = None
    final_answer: Optional[str] = None
    error_message: Optional[str] = None


# --- 2. SERVER LIFECYCLE MANAGEMENT (Global Connection Pools) ---

# Isolated container holding our long-lived engine dependencies
state_pools: Dict[str, Any] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the exact long-lived infrastructure resources required by your graph nodes
    state_pools["groq_client"] = AsyncGroq(api_key=settings.groq_api_key)
    state_pools["http_client"] = httpx.AsyncClient(timeout=settings.network_timeout_seconds)
    yield
    # Cleanly terminate network connection paths on server shutdown
    await state_pools["http_client"].aclose()


# --- 3. THE PUBLIC INTERFACE APPLICATION SURFACE ---

server = FastAPI(lifespan=lifespan, title="FinOps AI Engine Gateway")

origins = [
    "http://localhost:5173",  # Vite's standard local development server port
    "http://127.0.0.1:5173"   # Loopback variation to capture local browser routing variations
]

server.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Mandate strict whitelisting for your specific React dev app
    allow_credentials=True,      # Permits session cookie and authentication headers over cross-origins
    allow_methods=["POST", "GET"], # Restricts allowed HTTP execution verbs to exactly what our contract demands
    allow_headers=["*"],         # Allows standard content-type and browser request headers safely
)

@server.get("/health")
async def health_check():
    return {"status": "healthy"}

@server.get("/api/config/info")
async def config_info():
    return {"llm_model": settings.llm_model}

@server.post("/api/query") 
async def execute_query(payload: QueryRequest):
    # Seed a fresh, isolated state dictionary matching your EngineState contract exactly
    initial_state: EngineState = {
        "user_query": payload.user_query,
        "cube_json_query": None,
        "api_response": None,
        "final_answer": None,
        "error_message": None
    }

    # Wrap our long-lived global client utilities into the execution envelope
    config_envelope = {
        "configurable": {
            "groq_client": state_pools["groq_client"],
            "http_client": state_pools["http_client"]
        }
    }

    # PATH A: Stream state diff snapshots incrementally
    if payload.stream:
        async def event_generator():
            # Accumulate values over time to ensure we are sending a full state snapshot
            current_state = {
                "cube_json_query": None,
                "final_answer": "",
                "error_message": None
            }

            # app.astream yields chunks as the nodes execute
            async for chunk in app.astream(initial_state, config=config_envelope):
                
                if isinstance(chunk, dict):
                    node_name = next(iter(chunk))
                    values = chunk[node_name]
                    
                    if "cube_json_query" in values and values["cube_json_query"] is not None:
                        current_state["cube_json_query"] = values["cube_json_query"]
                    if "error_message" in values and values["error_message"] is not None:
                        current_state["error_message"] = values["error_message"]

                    if "final_answer" in values and values["final_answer"] is not None:
                            target_text = values["final_answer"]
                            
                            # Split the block text into words and stream them sequentially
                            words = target_text.split(" ")
                            for i, word in enumerate(words):
                                space = " " if i > 0 else ""
                                current_state["final_answer"] += f"{space}{word}"
                                
                                snapshot = QueryResponse(
                                    cube_json_query=current_state["cube_json_query"],
                                    final_answer=current_state["final_answer"],
                                    error_message=current_state["error_message"]
                                )
                                yield f"data: {snapshot.model_dump_json()}\n\n"
                                
                                # Pause for 30ms before delivering the next word snapshot frame
                                await asyncio.sleep(0.03)
                            
                            # Exit the generator since the final result is fully painted
                            return

                # Serialize using our explicit QueryResponse data contract structure
                snapshot = QueryResponse(
                    cube_json_query=current_state["cube_json_query"],
                    final_answer=current_state["final_answer"],
                    error_message=current_state["error_message"]
                )
                yield f"data: {snapshot.model_dump_json()}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # PATH B: Traditional non-streamed execution (Fallback contract kept identical)
    output_state = await app.ainvoke(initial_state, config=config_envelope)
    
    return QueryResponse(
        cube_json_query=output_state.get("cube_json_query"),
        final_answer=output_state.get("final_answer"),
        error_message=output_state.get("error_message")
    )

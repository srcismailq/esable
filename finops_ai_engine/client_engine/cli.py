import os
import sys
import httpx
import logging
import asyncio
from groq import AsyncGroq

# Import your strongly typed configurations and compiled graph engine
from client_engine.config import settings
from client_engine.graph_engine import app, EngineState

# Configure terminal-facing baseline logging architecture
logging.basicConfig(
    level=logging.WARNING, # Suppress noisy debug logs for clean terminal view
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("cli_application")

async def terminal_event_loop() -> None:
    """
    Manages the lifecycle of shared connection pools and handles 
    the interactive shell loop for the FinOps Semantic Engine.
    """
    # --- CRITICAL FIX 1: ELIMINATE DUAL CONFIGURATION LOOKUP PATHS ---
    if not os.environ.get("GROQ_API_KEY"):
        print("\n🚨 [CONFIGURATION ERROR] GROQ_API_KEY environment variable is not set.")
        print("Please run: $env:GROQ_API_KEY='your_key_here' in your active PowerShell terminal window.")
        return

    print("\n" + "=" * 60)
    print("⚡ FinOps Semantic Engine CLI Platform Active")
    print(f"Targeting LLM Architecture: {settings.llm_model}")
    print("Type 'exit' or hit Ctrl+C/Ctrl+D to terminate your session.")
    print("=" * 60)

    # --- CRITICAL FIX 1: INITIALIZE DIRECTLY WITH VERIFIED OS ENVIRONMENT STRING ---
    # Instantiate the Groq client pool as a standard long-lived object block
    shared_async_groq = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])

    # Nest the interactive loop context cleanly inside the long-lived HTTPX connection pool
    async with httpx.AsyncClient(timeout=settings.network_timeout_seconds) as pooled_http:
        
        # --- ENTER INTERACTIVE SHELL LOOP ---
        while True:
            # Wrap the entire iteration loop step inside a global exception envelope
            try:
                # Thread-delegated non-blocking terminal read yielding event loop control
                raw_input = await asyncio.to_thread(input, "\nAsk FinOps AI > ")
                user_input = raw_input.strip()
                
                # Check for explicit termination triggers
                if not user_input or user_input.lower() in ["exit", "quit"]:
                    print("\nShutting down connection pools. Goodbye.")
                    break

                # Seed a fresh baseline state transaction payload matching type contracts exactly
                initial_state: EngineState = {
                    "user_query": user_input,
                    "cube_json_query": None,
                    "api_response": None,
                    "final_answer": None,
                    "error_message": None
                }

                # Ingestion envelope bridging long-lived connection pools to internal graph nodes
                config_envelope = {
                    "configurable": {
                        "groq_client": shared_async_groq,
                        "http_client": pooled_http
                    }
                }

                print("🤖 Processing transaction query through state-machine nodes...")
                
                # Fire the graph execution loop asynchronously across the pool context
                output_state = await app.ainvoke(initial_state, config=config_envelope)

                # Clear separation of output print layouts
                if output_state.get("error_message") is not None:
                    print("\n" + "!" * 60)
                    print(f"🚨 [PLATFORM GATEWAY FAILURE] Run Aborted.")
                    print(f"Details: {output_state['error_message']}")
                    print("!" * 60)
                else:
                    print(f"\n🤖 Analyst Report:\n{output_state['final_answer']}")

            except (KeyboardInterrupt, EOFError):
                print("\n\nSession interrupted cleanly. Closing open connection paths.")
                break
            except Exception as system_crash:
                logger.critical(f"Unhandled shell runtime failure: {system_crash}")
                print(f"\n🚨 Fatal Application Anomaly: {system_crash}")
                break

if __name__ == "__main__":
    # Launch the asynchronous loop runtime cleanly using the core Python entrypoint
    try:
        asyncio.run(terminal_event_loop())
    except KeyboardInterrupt:
        sys.exit(0)

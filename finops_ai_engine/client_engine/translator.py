import json
import logging
from typing import Any, Dict, List, Literal, Optional
import groq
from groq import AsyncGroq
from pydantic import BaseModel, Field, model_validator, ConfigDict, ValidationError
from .config import settings
from .schema_registry import Measures, Dimensions, TimeDimensions

logger = logging.getLogger("client_engine.translator")

UNBOUNDED_TIME_TOKEN = "Last 10000 days"

# ==========================================
# 1. THE STRICT PYDANTIC TARGET SCHEMAS
# ==========================================

class CubeTimeDimensionBlock(BaseModel):
    """Enforces the nested object structure expected by Cube.js time entries."""
    dimension: TimeDimensions
    granularity: Literal["second", "minute", "hour", "day", "week", "month", "quarter", "year", "none"] = Field(
        description=(
            "The temporal bucket size. Use 'none' if the user asks for 'totals', "
            "'aggregates', or a 'grand total' over the entire period without a daily/monthly breakdown."
        )
    )
    date_range: str = Field(
        serialization_alias="dateRange",
        description=f"Relative time window string. For all-time or unbounded queries, you MUST use '{UNBOUNDED_TIME_TOKEN}'."
    )

    model_config = ConfigDict(extra="forbid")


class CubeFilterBlock(BaseModel):
    """Enforces strict database column operator matching rules."""
    member: Dimensions
    operator: Literal["equals", "notEquals", "contains", "notContains", "set", "notSet"]
    values: List[str] = Field(description="A list of filter string arguments, e.g. ['US']")

    model_config = ConfigDict(extra="forbid")


class CubeQueryModel(BaseModel):
    """
    Master analytical query layout structure matching Cube's REST engine.
    
    ULTIMATE STRUCTURAL FIX: Uses Python's native tuple typing to force 'prefixItems' 
    constraints into the OpenAPI schema. This mathematically locks element index geometry,
    ensuring Groq with strict: True cannot invert column tokens and sorting direction strings.
    """
    measures: List[Measures] = Field(
        description="List of target aggregatable metrics fields. Provide an empty list if none match."
    )
    dimensions: List[Dimensions] = Field(
        description="List of text-based categorization columns. Provide an empty list if none match."
    )
    time_dimensions: List[CubeTimeDimensionBlock] = Field(
        serialization_alias="timeDimensions",
        description="Isolate date parameters here. Provide an empty list if none match."
    )
    filters: List[CubeFilterBlock] = Field(
        description="Data slicing conditions. Provide an empty list if none match."
    )
    order: List[tuple[str, Literal["asc", "desc"]]] = Field(
        description="List of [member, direction] array pairs. Provide an empty list if none match."
    )
    limit: int = Field(
        description="The maximum rows to return. Specify 0 if no specific row limit is requested."
    )


    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_and_bound_order_tuples(self) -> "CubeQueryModel":
        """
        Enforces local geometric safety across the ordering array collection 
        at the master model boundary layer to protect Minikube infrastructure.
        """
        all_valid_tokens = [m.value for m in Measures] + [d.value for d in Dimensions] + [t.value for t in TimeDimensions]

        # Track tokens to prevent the LLM from sending duplicate sorting keys
        seen_tokens = set()
        
        for idx, pair in enumerate(self.order):
            if not isinstance(pair, tuple) or len(pair) != 2:
                raise ValueError(f"Order element at index {idx} must be a strict tuple pair containing exactly [member, direction].")
            
            member, direction = str(pair[0]), str(pair[1])
            
            if member not in all_valid_tokens:
                raise ValueError(f"Order target '{member}' at index {idx} is not a valid metric or attribute token.")
                
            if direction not in ["asc", "desc"]:
                raise ValueError(f"Order direction '{direction}' at index {idx} must be strictly 'asc' or 'desc'.")

             # Key collision check to prevent silent overwrites downstream
            if member in seen_tokens:
                raise ValueError(f"Duplicate order target '{member}' found at index {idx}. Field can only be sorted once.")
            seen_tokens.add(member)
                
        return self


# ==========================================
# 2. THE COGNITIVE PIPELINE INTERFACE
# ==========================================

def assemble_schema_context_prompt() -> str:
    """
    Programmatically loops through local Enums reading raw .value strings 
    to generate a rich, zero-hallucination system prompt context block dynamically.
    """
    available_measures = "\n".join([f" - {m.value}" for m in Measures])
    available_dimensions = "\n".join([f" - {d.value}" for d in Dimensions])
    available_time = "\n".join([f" - {t.value}" for t in TimeDimensions])

    # Dynamic generation of the strict filter token map
    filter_constraints = []
    for cube_dimension, allowed_tokens in Dimensions.get_filter_validation_map().items():
        filter_constraints.append(f" - {cube_dimension}: {allowed_tokens}")
    allowed_filter_literals = "\n".join(filter_constraints)

    return f"""
You are a translation compiler. Your sole job is to translate human questions into a structured Cube.js query object.
Target Cube Schema Name: DailyB2cMetrics

ALLOWED DATA CONTRACT METRICS:
Measures (Numerical fields only):
{available_measures}

Dimensions (Text-based grouping columns only):
{available_dimensions}

Time Dimensions (Temporal columns only):
{available_time}

STRICT FILTER VALUE VALIDATION CONTRACT:
When generating filters, if a query filters on any of the dimensions below, you must use ONLY these exact, case-sensitive string literal tokens. Never replace underscores with spaces or invent values:
{allowed_filter_literals}

RULES:
1. You must ONLY select from the allowed data contract metrics lists above. Never invent or guess column tokens.
2. If the user specifies ordering, determine the column and direction (asc/desc) and populate the order array as a nested list pair, e.g., [["DailyB2cMetrics.net_profit_usd", "desc"]].
"""


async def compile_text_to_cube_query(
    client: AsyncGroq, 
    user_question: str
) -> Dict[str, Any]:
    """
    Compiles human natural language into a clean, verified camelCase Cube query dictionary.
    Reuses a long-lived cloud connection pool and forces structured JSON constraints.
    """
    system_instruction = assemble_schema_context_prompt()
    target_json_schema = CubeQueryModel.model_json_schema()

    logger.info("Routing user question to Groq Cloud using strict JSON schema validation...")
    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_question}
            ],
            model=settings.llm_model,
            temperature=0.0,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "cube_query_response",
                    "strict": True,
                    "schema": target_json_schema
                }
            }
        )
    except groq.BadRequestError as err:
        print("\n🚨 [GROQ VISIBILITY] 400 GATEWAY EXCEPTION CAPTURED")
        # Target Groq's specific internal JSON body structure
        try:
            # Groq exceptions store the structured error under the .body attribute
            error_details = err.body.get("error", {})
            print(f"Error Message: {error_details.get('message')}")
            print(f"Error Type:    {error_details.get('type')}")
            
            # This is where Groq keeps the text that broke your JSON parsing rules!
            failed_text = error_details.get("failed_generation")
            
            if failed_text:
                print("\n--- [FOUND] THE RAW TEXT THAT FAILED JSON GENERATION ---")
                print(failed_text)
                print("-------------------------------------------------------")
            else:
                print("\nNo 'failed_generation' was provided by Groq's gateway.")
                print(f"Full body: {json.dumps(err.body, indent=2)}")
                
        except Exception as parse_err:
            print(f"Failed to cleanly unpack Groq exception data: {parse_err}")
            print(f"Fallback raw error dump: {err}")
            
        raise err
    raw_response_content = response.choices[0].message.content
    if not raw_response_content:
        raise ValueError("Groq returned an empty response payload during translation.")

    parsed_json_dict = json.loads(raw_response_content.strip())
    
    # Run the raw dictionary through Pydantic to validate parameters
    try:
        validated_model = CubeQueryModel.model_validate(parsed_json_dict)
    except ValidationError as exc:
        print("\n🚨 [VISIBILITY] CRITICAL PYDANTIC ERROR")
        print(parsed_json_dict) # ◄ PRINT RAW STRING HERE
        raise exc
    raw_dumped_dict = validated_model.model_dump(by_alias=True)
    
    # Handle limits and prune top-level empty parameters or empty arrays manually
    final_query_payload = {}
    for key, value in raw_dumped_dict.items():
        if key == "limit":
            if value > 0:
                final_query_payload[key] = value
        elif key == "order":
            # Map list of unique tuples directly to the key-value layout required by Cube.js
            if value:
                final_query_payload[key] = dict(value)
        elif value or (isinstance(value, list) and len(value) > 0):
            if key == "timeDimensions":
                sanitized_time_dimensions = []
                for block in value:
                    cleaned_block = dict(block)
                    if cleaned_block.get("granularity") == "none":
                        del cleaned_block["granularity"]
                    sanitized_time_dimensions.append(cleaned_block)
                final_query_payload[key] = sanitized_time_dimensions
            else:
                final_query_payload[key] = value
            
    return {"query": final_query_payload}

def extract_query_lineage_summary(cube_json_query: Dict[str, Any]) -> str:
    """
    Extracts compiled database targets into a compact, prefix-free text outline.
    Protects downstream nodes from token bloat and context erasure.
    """
    query = cube_json_query.get("query", {})
    
    def clean_token(name: str) -> str:
        return name.split(".")[-1] if name else "unknown"

    measures = [clean_token(m) for m in query.get("measures", [])]
    dimensions = [clean_token(d) for d in query.get("dimensions", [])]
    
    filters_summary = []
    for f in query.get("filters", []):
        member = clean_token(f.get("member", ""))
        operator = f.get("operator", "equals")
        values = f.get("values", [])
        filters_summary.append(f"{member} {operator} {values}")
        
    time_summary = []
    for t in query.get("timeDimensions", []):
        dimension = clean_token(t.get("dimension", ""))
        date_range = t.get("dateRange", "unknown")
        granularity = t.get("granularity", "none")
        time_summary.append(f"dimension: {dimension}, range: {date_range}, granularity: {granularity}")

    lines = [
        f"Active Measures: {', '.join(measures) if measures else 'None'}",
        f"Active Dimensions: {', '.join(dimensions) if dimensions else 'None'}",
        f"Applied Filters: {'; '.join(filters_summary) if filters_summary else 'None'}",
        f"Temporal Bounds: {'; '.join(time_summary) if time_summary else 'None'}"
    ]
    return "\n".join(lines)

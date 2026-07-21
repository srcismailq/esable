import json
import logging
from typing import Any, Dict, List, Literal
from groq import AsyncGroq
from pydantic import BaseModel, Field, model_validator, ConfigDict
from .config import settings
from .schema_registry import Measures, Dimensions, TimeDimensions

logger = logging.getLogger("client_engine.translator")

# ==========================================
# 1. THE STRICT PYDANTIC TARGET SCHEMAS
# ==========================================

class CubeTimeDimensionBlock(BaseModel):
    """Enforces the nested object structure expected by Cube.js time entries."""
    dimension: TimeDimensions
    granularity: Literal["day", "week", "month"] = Field(
        description="The temporal bucket size. Must be 'day', 'week', or 'month'."
    )
    date_range: str = Field(
        serialization_alias="dateRange",
        description="Relative time string. Examples: 'Last 30 days', 'Last 15 days', 'Yesterday'"
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

    # DIAGNOSTIC FIX: Pass the ellipses (...) marker as the absolute first positional argument.
    # This explicitly tells Pydantic's OpenAPI exporter that this field is structurally mandatory,
    # forcing its inclusion in the JSON Schema 'required' array context.
    order: List[tuple[str, Literal["asc", "desc"]]] = Field(
        ...,
        description="List of [member, direction] array pairs. Output an empty list [ ] if no sort is requested."
    )
    
    # DIAGNOSTIC FIX: Pass the ellipses (...) marker as the absolute first positional argument.
    # Forces 'limit' directly into the JSON Schema 'required' array context.
    limit: int = Field(
        ...,
        description="The maximum rows to return. Output 0 if no explicit row limit is requested."
    )

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_and_bound_order_tuples(self) -> "CubeQueryModel":
        """
        Enforces local geometric safety across the ordering array collection 
        at the master model boundary layer to protect Minikube infrastructure.
        """
        all_valid_tokens = [m.value for m in Measures] + [d.value for d in Dimensions]
        
        for idx, pair in enumerate(self.order):
            if not isinstance(pair, tuple) or len(pair) != 2:
                raise ValueError(f"Order element at index {idx} must be a strict tuple pair containing exactly [member, direction].")
            
            member, direction = str(pair[0]), str(pair[1])
            
            if member not in all_valid_tokens:
                raise ValueError(f"Order target '{member}' at index {idx} is not a valid metric or attribute token.")
                
            if direction not in ["asc", "desc"]:
                raise ValueError(f"Order direction '{direction}' at index {idx} must be strictly 'asc' or 'desc'.")
                
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

RULES:
1. You must ONLY select from the allowed data contract metrics lists above. Never invent or guess column tokens.
2. If the user specifies ordering, determine the column and direction (asc/desc) and populate the order array as a nested list pair, e.g., [["DailyB2cMetrics.net_profit_usd", "desc"]].
3. If the user asks for a date range (e.g., last 12 days, last 3 days), you MUST populate timeDimensions using the pattern 'Last X days'.
4. If no row limit is specified by the user, you must strictly output 0 for the limit field.
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

    raw_response_content = response.choices[0].message.content
    if not raw_response_content:
        raise ValueError("Groq returned an empty response payload during translation.")

    parsed_json_dict = json.loads(raw_response_content.strip())
    
    # Run the raw dictionary through Pydantic to validate parameters
    validated_model = CubeQueryModel.model_validate(parsed_json_dict)
    raw_dumped_dict = validated_model.model_dump(by_alias=True)
    
    # Handle limits and prune top-level empty parameters or empty arrays manually
    final_query_payload = {}
    for key, value in raw_dumped_dict.items():
        if key == "limit":
            if value > 0:
                final_query_payload[key] = value
        # Ensure empty arrays are completely stripped from the transport envelope
        elif value or (isinstance(value, list) and len(value) > 0):
            final_query_payload[key] = value
            
    return {"query": final_query_payload}

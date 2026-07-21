import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    """
    Strongly typed application configuration layer.
    Ensures the micro-engine fails fast during boot if critical 
    environment parameters or local tunnel targets are missing.
    """
    
    # 1. LLM Operational Configuration
    # Locked strictly to the OpenAI post-trained structured output engine hosted on Groq Cloud
    llm_model: str = "openai/gpt-oss-20b"
    groq_api_key: str = Field(..., validation_alias="GROQ_API_KEY")
    
    # 2. Semantic Layer Tunnel Target (Minikube Local Gateway)
    cube_api_url: str = Field(
        default="http://localhost:4000/cubejs-api/v1/load",
        validation_alias="CUBE_API_URL"
    )
    
    # Your verified security access token password
    cube_secret: str = Field(
        default="cube_secure_token_abc123",
        validation_alias="CUBEJS_API_SECRET"
    )
    
    # 3. Defensive Network Overrides
    network_timeout_seconds: int = 15
    max_cube_retries: int = 5
    retry_delay_seconds: int = 2

    # Instructs Pydantic to cleanly look for a local environment file first
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instantiate a single global runtime configuration object for our package modules
settings = AppSettings()

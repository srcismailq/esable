import httpx
import jwt
import datetime
import asyncio
import logging
from typing import Any, Dict
from .config import settings

logger = logging.getLogger("client_engine.cube_client")

def generate_security_token() -> str:
    """
    Generates a transient JSON Web Token (JWT) signed with the 
    idiomatic CUBEJS_API_SECRET key using clean integer Unix epoch timestamps.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(hours=1)).timestamp())
    }
    
    return jwt.encode(payload, settings.cube_secret, algorithm="HS256")

async def execute_cube_query(
    client: httpx.AsyncClient, 
    query_payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes a non-blocking network request over an external, pooled HTTPX client.
    Handles Cube's asynchronous 'continueWait' states with hoisted headers and trace preservation.
    
    Args:
        client: A long-lived, shared HTTPX AsyncClient connection pool instance.
        query_payload: Clean JSON dictionary matching Cube.js API specs.
        
    Returns:
        The validated raw data dictionary containing metrics rows.
    """
    # OPTIMIZATION: Hoist token and header generation completely outside the retry loop
    token = generate_security_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    for attempt in range(1, settings.max_cube_retries + 1):
        logger.info(f"Firing data request to Cube.js (Attempt {attempt}/{settings.max_cube_retries})...")
        
        try:
            response = await client.post(
                settings.cube_api_url, 
                headers=headers, 
                json=query_payload
            )
            
            if response.status_code != 200:
                raise RuntimeError(f"Cube Server rejected payload ({response.status_code}): {response.text}")
            
            data = response.json()
            
            if data.get("continueWait") is True:
                logger.warning(
                    f"Cube.js is compiling dbt/lakehouse pre-aggregations in the background. "
                    f"Backing off for {settings.retry_delay_seconds}s (Non-blocking)..."
                )
                await asyncio.sleep(settings.retry_delay_seconds)
                continue
            
            return data
            
        except httpx.RequestError as transport_err:
            # OPTIMIZATION: Use explicit 'from transport_err' chaining to preserve low-level trace contracts
            raise ConnectionError(
                f"Network transport failure at target endpoint: {settings.cube_api_url}. "
                f"Verify that your Minikube port-forward tunnel is open."
            ) from transport_err
    
    raise TimeoutError(
        f"Cube.js pre-aggregation compilation timed out after "
        f"{settings.max_cube_retries} background polling attempts."
    )

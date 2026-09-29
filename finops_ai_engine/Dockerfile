FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app

# Paths are relative to the ROOT context because of how we run it
COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache-dir -e .

COPY . .
EXPOSE 8000
CMD ["uvicorn", "finops_ai_engine.client_engine.server:server", "--host", "0.0.0.0", "--port", "8000"]

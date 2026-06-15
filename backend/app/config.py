from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/icoastline"
    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "icoastline"
    database_user: str = "postgres"
    database_password: str = ""
    database_schema: str = "sourcewriter"

    # Dify
    dify_base_url: str = ""
    dify_app_api_key: str = ""
    dify_dataset_api_key: str = ""
    dify_dataset_id: str = ""

    # Dify knowledge config
    dify_indexing_technique: str = "high_quality"
    dify_process_rule_mode: str = "automatic"
    dify_doc_form: str = "text_model"
    dify_reranking_enable: bool = False
    dify_score_threshold: float = 0.3
    dify_embedding_model: str = "qwen3-embedding:4b"
    dify_embedding_model_provider: str = "langgenius/ollama/ollama"

    # Storage
    upload_dir: str = "./uploads"

    # Server
    app_port: int = 8002
    app_host: str = "0.0.0.0"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

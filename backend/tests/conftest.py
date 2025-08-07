"""
Test configuration and fixtures for the AINovel backend tests
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import FastAPI

from database import DATABASE_URL, get_db
from models import Base
from routers.auth import get_current_user_dependency
from routers.model_configs import router as model_configs_router
from schemas import UserCreate, ModelConfigCreate

# Test database setup
TEST_DATABASE_URL = "sqlite:///./test_ainovel.db"

# Create test engine
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False
)

# Create test session
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Override the database dependency
def override_get_db():
    """Override database dependency for testing"""
    with TestSessionLocal() as session:
        try:
            yield session
        finally:
            session.close()

# Create test user dependency
def override_get_current_user():
    """Override current user dependency for testing"""
    return {
        "id": 1,
        "username": "testuser",
        "email": "test@example.com",
        "is_active": True
    }

@pytest.fixture(scope="session")
def app():
    """Create test FastAPI application"""
    app = FastAPI()
    app.include_router(model_configs_router)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_dependency] = override_get_current_user
    return app

@pytest.fixture(scope="session")
def client(app):
    """Create test client"""
    return TestClient(app)

@pytest.fixture(scope="session")
def test_db():
    """Create test database"""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session(test_db):
    """Create test database session"""
    with TestSessionLocal() as session:
        yield session

@pytest.fixture
def sample_user():
    """Create sample user data"""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword123",
        "full_name": "Test User"
    }

@pytest.fixture
def sample_model_config():
    """Create sample model configuration data"""
    return {
        "name": "Test OpenAI Config",
        "model_type": "openai",
        "model_name": "gpt-3.5-turbo",
        "api_key": "test-api-key-123",
        "temperature": 0.7,
        "max_tokens": 2000,
        "top_p": 1.0,
        "top_k": 40,
        "frequency_penalty": 0.0,
        "presence_penalty": 0.0,
        "stop_sequences": [],
        "stream": False,
        "logprobs": False,
        "top_logprobs": 0
    }

@pytest.fixture
def sample_model_config_with_advanced():
    """Create sample model configuration with advanced parameters"""
    return {
        "name": "Advanced Claude Config",
        "model_type": "claude",
        "model_name": "claude-3-sonnet-20240229",
        "api_key": "test-claude-key-456",
        "api_url": "https://api.anthropic.com/v1/messages",
        "temperature": 0.8,
        "max_tokens": 4000,
        "top_p": 0.9,
        "top_k": 50,
        "frequency_penalty": 0.1,
        "presence_penalty": 0.2,
        "stop_sequences": ["###", "END", "STOP"],
        "stream": True,
        "logprobs": True,
        "top_logprobs": 5
    }

@pytest.fixture
def invalid_model_config():
    """Create invalid model configuration data"""
    return {
        "name": "",
        "model_type": "invalid_model",
        "api_key": "",
        "temperature": 3.0,
        "max_tokens": -1,
        "top_p": 2.0,
        "top_k": -1,
        "frequency_penalty": 3.0,
        "presence_penalty": -3.0,
        "top_logprobs": 25
    }

@pytest.fixture
def test_connection_data():
    """Create test connection data"""
    return {
        "api_key": "test-api-key-123",
        "model_type": "openai",
        "model_name": "gpt-3.5-turbo",
        "api_url": "https://api.openai.com/v1/chat/completions"
    }

# Async fixtures for async testing
@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
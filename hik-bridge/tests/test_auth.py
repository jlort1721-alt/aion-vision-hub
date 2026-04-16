"""Tests for API key authentication."""

import pytest
from unittest.mock import patch
from fastapi import HTTPException

from app.auth import verify_api_key


class TestVerifyApiKey:
    @pytest.mark.asyncio
    async def test_valid_key(self):
        with patch("app.auth.settings") as mock_settings:
            mock_settings.api_key = "correct-key"
            result = await verify_api_key("correct-key")
            assert result == "correct-key"

    @pytest.mark.asyncio
    async def test_invalid_key(self):
        with patch("app.auth.settings") as mock_settings:
            mock_settings.api_key = "correct-key"
            with pytest.raises(HTTPException) as exc_info:
                await verify_api_key("wrong-key")
            assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_missing_key(self):
        with patch("app.auth.settings") as mock_settings:
            mock_settings.api_key = "correct-key"
            with pytest.raises(HTTPException) as exc_info:
                await verify_api_key(None)
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_dev_mode_no_key_configured(self):
        with patch("app.auth.settings") as mock_settings:
            mock_settings.api_key = ""
            result = await verify_api_key(None)
            assert result == "dev-mode"

    @pytest.mark.asyncio
    async def test_dev_mode_with_any_key(self):
        with patch("app.auth.settings") as mock_settings:
            mock_settings.api_key = ""
            result = await verify_api_key("anything")
            assert result == "dev-mode"

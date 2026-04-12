"""AION Hikvision Bridge — API Key authentication middleware."""

import logging

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

_auth_warning_logged = False


async def verify_api_key(
    api_key: str | None = Security(api_key_header),
) -> str:
    """Validate the X-API-Key header against the configured secret.

    Returns the validated key on success, raises 401/403 on failure.
    """
    global _auth_warning_logged
    if not settings.api_key:
        if not _auth_warning_logged:
            logging.getLogger("hik-bridge.auth").critical(
                "HIK_BRIDGE_API_KEY is not set — ALL endpoints are unauthenticated! "
                "Set HIK_BRIDGE_API_KEY in .env before deploying to production."
            )
            _auth_warning_logged = True
        return "dev-mode"

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )

    if api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    return api_key

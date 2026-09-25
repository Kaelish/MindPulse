"""
Supabase client (server-side) for the MindPulse backend.

Uses the service-role (secret) key to bypass Row Level Security.
The secret key must NEVER be used in a browser or exposed on the client.

The client is created lazily so that importing this module never fails when
the environment is not configured; the first actual use raises a clear error.
"""

import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

_client: Any = None


def get_supabase_admin() -> Any:
    """Return a configured service-role client, or raise a helpful error."""
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "Supabase is not configured for the backend. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in mindpulse-backend/.env (never commit it)."
        )

    from supabase import create_client

    _client = create_client(url, key)
    return _client

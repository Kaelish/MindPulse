"""
Supabase client (server-side) for the MindPulse backend.

Uses the service-role (secret) key to bypass Row Level Security.
The secret key must NEVER be used in a browser or exposed on the client.
"""
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

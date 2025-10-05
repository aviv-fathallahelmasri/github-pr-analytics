"""
Central configuration module for GitHub PR Analytics Dashboard.
Handles all environment variables and application settings.
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DASHBOARD_DIR = PROJECT_ROOT / "dashboard"
DEPLOYMENT_DIR = PROJECT_ROOT / "deployment"

# Create directories if they don't exist
for directory in [DATA_DIR, DASHBOARD_DIR, DEPLOYMENT_DIR]:
    directory.mkdir(exist_ok=True)

# GitHub Configuration
GITHUB_TOKEN: Optional[str] = os.getenv("GITHUB_TOKEN")
GITHUB_OWNER: str = os.getenv("GITHUB_OWNER", "axel-springer-kugawana")
GITHUB_REPO: str = os.getenv("GITHUB_REPO", "aviv_data_collection_contracts")

# Dashboard Configuration
DASHBOARD_URL: str = os.getenv(
    "DASHBOARD_URL", 
    "https://aviv-fathallahelmasri.github.io/pr-analytics-dashboard/"
)

# Automation Settings
UPDATE_SCHEDULE: str = os.getenv("UPDATE_SCHEDULE", "0 8 * * *")

# Development Settings
DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

# Data Settings
MAX_PRS_TO_FETCH: int = 1000
CACHE_DURATION_HOURS: int = 24

# File Paths
PR_DATA_FILE = DATA_DIR / "pr_data.csv"
METRICS_FILE = DATA_DIR / "metrics.json"
LAST_UPDATE_FILE = DATA_DIR / "last_update.txt"

# Validate critical configuration
def validate_config() -> bool:
    """Validate that all required configuration is present."""
    if not GITHUB_TOKEN:
        raise ValueError("GITHUB_TOKEN is required. Please set it in .env file")
    return True

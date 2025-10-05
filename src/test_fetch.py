"""
Test script to verify GitHub connection and data fetching.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Test configuration loading
print("Testing configuration...")
print(f"GitHub Owner: {os.getenv('GITHUB_OWNER')}")
print(f"GitHub Repo: {os.getenv('GITHUB_REPO')}")
print(f"Token configured: {'Yes' if os.getenv('GITHUB_TOKEN') else 'No'}")

if not os.getenv('GITHUB_TOKEN'):
    print("\n  Please add your GitHub token to the .env file!")
    print("1. Create a token at: https://github.com/settings/tokens")
    print("2. Add it to .env file")
    sys.exit(1)

# Test GitHub connection
print("\nTesting GitHub connection...")
from github import Github

try:
    g = Github(os.getenv('GITHUB_TOKEN'))
    repo = g.get_repo(f"{os.getenv('GITHUB_OWNER')}/{os.getenv('GITHUB_REPO')}")
    print(f" Connected to: {repo.full_name}")
    print(f"   Description: {repo.description}")
    print(f"   Stars: {repo.stargazers_count}")
    
    # Get a sample PR
    pulls = list(repo.get_pulls(state="all", sort="created", direction="desc")[:1])
    if pulls:
        pr = pulls[0]
        print(f"\n Latest PR:")
        print(f"   #{pr.number}: {pr.title}")
        print(f"   Author: {pr.user.login}")
        print(f"   State: {pr.state}")
        
    print("\n All tests passed! Ready to fetch data.")
    
except Exception as e:
    print(f"\n Error: {e}")
    print("Please check your GitHub token and repository settings.")

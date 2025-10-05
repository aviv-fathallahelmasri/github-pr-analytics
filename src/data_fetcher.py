"""
GitHub PR Data Fetcher Module
Fetches and processes pull request data from GitHub repositories.
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Any
import logging

import pandas as pd
from github import Github
from github.PullRequest import PullRequest
from dotenv import load_dotenv

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent))
from config.settings import (
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    PR_DATA_FILE,
    METRICS_FILE,
    LAST_UPDATE_FILE,
    DATA_DIR,
    validate_config
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GitHubPRFetcher:
    """Fetches and processes GitHub pull request data."""
    
    def __init__(self, token: str, owner: str, repo: str):
        """
        Initialize the PR fetcher.
        
        Args:
            token: GitHub personal access token
            owner: Repository owner/organization
            repo: Repository name
        """
        self.github = Github(token)
        self.owner = owner
        self.repo_name = repo
        try:
            self.repo = self.github.get_repo(f"{owner}/{repo}")
            logger.info(f"Successfully connected to {owner}/{repo}")
        except Exception as e:
            logger.error(f"Failed to connect to repository: {e}")
            raise
            
    def fetch_all_prs(self, state: str = "all", limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch all pull requests from the repository.
        
        Args:
            state: PR state filter ('open', 'closed', 'all')
            limit: Maximum number of PRs to fetch (None for all)
            
        Returns:
            List of PR data dictionaries
        """
        logger.info(f"Fetching {state} pull requests...")
        pr_data = []
        
        try:
            pulls = self.repo.get_pulls(state=state, sort="created", direction="desc")
            
            for idx, pr in enumerate(pulls):
                if limit and idx >= limit:
                    break
                    
                pr_dict = self._extract_pr_data(pr)
                pr_data.append(pr_dict)
                
                if (idx + 1) % 10 == 0:
                    logger.info(f"Processed {idx + 1} PRs...")
                    
            logger.info(f"Successfully fetched {len(pr_data)} pull requests")
            return pr_data
            
        except Exception as e:
            logger.error(f"Error fetching PRs: {e}")
            raise
            
    def _extract_pr_data(self, pr: PullRequest) -> Dict[str, Any]:
        """
        Extract relevant data from a pull request object.
        
        Args:
            pr: GitHub PullRequest object
            
        Returns:
            Dictionary containing PR data
        """
        # Calculate merge time if merged
        merge_time_hours = None
        if pr.merged_at and pr.created_at:
            delta = pr.merged_at - pr.created_at
            merge_time_hours = delta.total_seconds() / 3600
            
        return {
            'number': pr.number,
            'title': pr.title,
            'state': pr.state,
            'author': pr.user.login if pr.user else 'Unknown',
            'created_at': pr.created_at.isoformat() if pr.created_at else None,
            'updated_at': pr.updated_at.isoformat() if pr.updated_at else None,
            'closed_at': pr.closed_at.isoformat() if pr.closed_at else None,
            'merged_at': pr.merged_at.isoformat() if pr.merged_at else None,
            'is_merged': pr.merged,
            'merge_time_hours': merge_time_hours,
            'labels': [label.name for label in pr.labels],
            'has_data_contract_label': 'data contract' in [label.name.lower() for label in pr.labels],
            'reviewers': [reviewer.login for reviewer in pr.requested_reviewers],
            'review_comments': pr.review_comments,
            'commits': pr.commits,
            'additions': pr.additions,
            'deletions': pr.deletions,
            'changed_files': pr.changed_files,
            'url': pr.html_url
        }
        
    def save_to_csv(self, pr_data: List[Dict[str, Any]], filepath: Path) -> None:
        """
        Save PR data to CSV file.
        
        Args:
            pr_data: List of PR data dictionaries
            filepath: Path to save CSV file
        """
        df = pd.DataFrame(pr_data)
        
        # Ensure directory exists
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # Save to CSV
        df.to_csv(filepath, index=False)
        logger.info(f"Saved {len(df)} PRs to {filepath}")
        
    def calculate_metrics(self, pr_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate key metrics from PR data.
        
        Args:
            pr_data: List of PR data dictionaries
            
        Returns:
            Dictionary containing calculated metrics
        """
        df = pd.DataFrame(pr_data)
        
        # Total PRs
        total_prs = len(df)
        
        # Merged PRs
        merged_prs = df['is_merged'].sum()
        merge_rate = (merged_prs / total_prs * 100) if total_prs > 0 else 0
        
        # Average merge time
        merge_times = df[df['is_merged']]['merge_time_hours'].dropna()
        avg_merge_time = merge_times.mean() if len(merge_times) > 0 else 0
        
        # Fast merges (< 24 hours)
        fast_merges = len(merge_times[merge_times < 24])
        fast_merge_rate = (fast_merges / len(merge_times) * 100) if len(merge_times) > 0 else 0
        
        # Active contributors
        active_authors = df['author'].nunique()
        
        # Review coverage
        has_reviews = df['review_comments'] > 0
        review_coverage = (has_reviews.sum() / total_prs * 100) if total_prs > 0 else 0
        
        # Data contract PRs
        data_contract_prs = df['has_data_contract_label'].sum()
        
        metrics = {
            'total_prs': int(total_prs),
            'merged_prs': int(merged_prs),
            'merge_rate': round(merge_rate, 1),
            'avg_merge_time_hours': round(avg_merge_time, 1),
            'fast_merge_rate': round(fast_merge_rate, 1),
            'active_authors': int(active_authors),
            'review_coverage': round(review_coverage, 1),
            'data_contract_prs': int(data_contract_prs),
            'last_updated': datetime.now(timezone.utc).isoformat()
        }
        
        return metrics


def main():
    """Main execution function."""
    try:
        # Load environment variables
        load_dotenv()
        
        # Validate configuration
        validate_config()
        
        # Initialize fetcher
        fetcher = GitHubPRFetcher(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO)
        
        # Fetch PR data
        logger.info("Starting PR data fetch...")
        pr_data = fetcher.fetch_all_prs(state="all", limit=100)  # Start with 100 for testing
        
        # Save to CSV
        fetcher.save_to_csv(pr_data, PR_DATA_FILE)
        
        # Calculate metrics
        metrics = fetcher.calculate_metrics(pr_data)
        
        # Save metrics to JSON
        import json
        METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(METRICS_FILE, 'w') as f:
            json.dump(metrics, f, indent=2)
        logger.info(f"Saved metrics to {METRICS_FILE}")
        
        # Update last update time
        with open(LAST_UPDATE_FILE, 'w') as f:
            f.write(datetime.now(timezone.utc).isoformat())
            
        # Print summary
        print("\n=== PR Analytics Summary ===")
        print(f"Total PRs: {metrics['total_prs']}")
        print(f"Merge Rate: {metrics['merge_rate']}%")
        print(f"Avg Merge Time: {metrics['avg_merge_time_hours']:.1f} hours")
        print(f"Active Authors: {metrics['active_authors']}")
        print(f"Review Coverage: {metrics['review_coverage']}%")
        print(f"Data Contract PRs: {metrics['data_contract_prs']}")
        print("============================\n")
        
        logger.info("PR data fetch completed successfully!")
        
    except Exception as e:
        logger.error(f"Failed to fetch PR data: {e}")
        raise


if __name__ == "__main__":
    main()

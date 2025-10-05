import os
import sys
from datetime import datetime
import json
import pandas as pd
from github import Github

# Get GitHub token from environment
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
if not GITHUB_TOKEN:
    print("Error: GITHUB_TOKEN not found in environment variables")
    sys.exit(1)

# Initialize GitHub client
g = Github(GITHUB_TOKEN)

# Repository details
REPO_OWNER = "axel-springer-kugawana"
REPO_NAME = "aviv_data_collection_contracts"

try:
    # Get repository
    repo = g.get_repo(f"{REPO_OWNER}/{REPO_NAME}")
    print(f"Successfully connected to {REPO_OWNER}/{REPO_NAME}")
    
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Fetch all PRs
    print("Fetching pull requests...")
    all_prs = []
    
    for pr in repo.get_pulls(state='all', sort='created', direction='desc'):
        pr_data = {
            'number': pr.number,
            'title': pr.title,
            'state': pr.state,
            'created_at': pr.created_at,
            'updated_at': pr.updated_at,
            'closed_at': pr.closed_at,
            'merged_at': pr.merged_at,
            'author': pr.user.login if pr.user else 'unknown',
            'labels': [label.name for label in pr.labels],
            'is_merged': pr.merged,
            'review_comments': pr.review_comments,
            'merge_time_hours': None
        }
        
        # Calculate merge time if merged
        if pr.merged and pr.merged_at and pr.created_at:
            delta = pr.merged_at - pr.created_at
            pr_data['merge_time_hours'] = delta.total_seconds() / 3600
        
        # Check for data contract label
        pr_data['has_data_contract_label'] = 'data-contract' in [label.name.lower() for label in pr.labels]
        
        all_prs.append(pr_data)
    
    print(f"Fetched {len(all_prs)} pull requests")
    
    # Convert to DataFrame
    df = pd.DataFrame(all_prs)
    
    # Save to CSV
    csv_path = 'data/pr_data.csv'
    df.to_csv(csv_path, index=False)
    print(f"Saved PR data to {csv_path}")
    
    # Calculate metrics
    total_prs = len(df)
    merged_prs = df['is_merged'].sum()
    merge_rate = (merged_prs / total_prs * 100) if total_prs > 0 else 0
    
    merged_df = df[df['is_merged'] == True]
    avg_merge_time = merged_df['merge_time_hours'].mean() if len(merged_df) > 0 else 0
    
    metrics = {
        'total_prs': int(total_prs),
        'merged_prs': int(merged_prs),
        'merge_rate': round(merge_rate, 1),
        'avg_merge_time_hours': round(avg_merge_time, 1) if avg_merge_time else 0,
        'active_authors': df['author'].nunique(),
        'last_updated': datetime.now().isoformat()
    }
    
    # Save metrics
    metrics_path = 'data/metrics.json'
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {metrics_path}")
    
    # Save last update timestamp
    with open('data/last_update.txt', 'w') as f:
        f.write(datetime.now().isoformat())
    
    print("Data fetch completed successfully!")
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

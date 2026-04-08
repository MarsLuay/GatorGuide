"""
API Client Module for College Scorecard Data Fetching

Handles:
- Paginated requests to College Scorecard API
- Rate limit management (1,000 requests/hour)
- Exponential backoff on failures
- Local caching of raw JSON responses
- Progress tracking
"""

import os
import json
import time
import requests
from pathlib import Path
from typing import Optional, Dict, List, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

API_BASE_URL = os.getenv('API_BASE_URL', 'https://api.data.gov/ed/collegescorecard/v1/schools')
API_KEY = os.getenv('COLLEGE_SCORECARD_API_KEY')
API_PER_PAGE = int(os.getenv('API_PER_PAGE', '100'))
API_TIMEOUT = int(os.getenv('API_TIMEOUT', '30'))
CACHE_DIR = Path(os.getenv('CACHE_DIR', './data_cache'))


class APIClient:
    """Handles all communication with College Scorecard API."""

    def __init__(self, api_key: str, base_url: str = API_BASE_URL, 
                 per_page: int = API_PER_PAGE, timeout: int = API_TIMEOUT):
        """
        Initialize API Client.
        
        Args:
            api_key: College Scorecard API key
            base_url: Base API endpoint URL
            per_page: Results per page (1-100, default 100)
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.base_url = base_url
        self.per_page = min(per_page, 100)  # API max is 100
        self.timeout = timeout
        self.session = requests.Session()
        self.rate_limit_remaining = 1000
        self.rate_limit_reset = None
        self.total_institutions = None
        
        # Setup cache directory
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _get_headers(self) -> Dict[str, str]:
        """Return request headers with API key."""
        return {
            'User-Agent': 'College-Scorecard-Scraper/1.0',
            'Accept': 'application/json',
            'api_key': self.api_key
        }

    def _handle_rate_limit(self, response: requests.Response):
        """Extract and handle rate limit info from response headers."""
        if 'X-RateLimit-Remaining' in response.headers:
            self.rate_limit_remaining = int(response.headers['X-RateLimit-Remaining'])
        if 'X-RateLimit-Reset' in response.headers:
            self.rate_limit_reset = int(response.headers['X-RateLimit-Reset'])
        
        if response.status_code == 429:  # Too Many Requests
            reset_time = int(response.headers.get('X-RateLimit-Reset', time.time())) - int(time.time())
            wait_time = max(reset_time, 1)
            print(f"⚠️  Rate limit hit. Waiting {wait_time} seconds...")
            time.sleep(wait_time + 1)
            return True
        return False

    def _exponential_backoff_request(self, url: str, params: Dict[str, Any], 
                                    max_retries: int = 3) -> Optional[requests.Response]:
        """
        Make request with exponential backoff retry logic.
        
        Args:
            url: Request URL
            params: Query parameters
            max_retries: Maximum number of retries
            
        Returns:
            Response object or None if all retries failed
        """
        for attempt in range(max_retries):
            try:
                response = self.session.get(
                    url,
                    params=params,
                    headers=self._get_headers(),
                    timeout=self.timeout
                )
                
                # Handle rate limiting
                if self._handle_rate_limit(response):
                    continue
                
                response.raise_for_status()
                return response
                
            except requests.exceptions.Timeout:
                print(f"⏱️  Timeout on attempt {attempt + 1}/{max_retries}. Retrying...")
                time.sleep(2 ** attempt)
            except requests.exceptions.ConnectionError:
                print(f"🔌 Connection error on attempt {attempt + 1}/{max_retries}. Retrying...")
                time.sleep(2 ** attempt)
            except requests.exceptions.HTTPError as e:
                if response.status_code >= 500:
                    print(f"🔴 Server error {response.status_code} on attempt {attempt + 1}/{max_retries}. Retrying...")
                    time.sleep(2 ** attempt)
                else:
                    print(f"❌ HTTP Error {response.status_code}: {e}")
                    return None
            except Exception as e:
                print(f"❌ Unexpected error on attempt {attempt + 1}/{max_retries}: {e}")
                return None
        
        return None

    def fetch_institutions(self, fields: Optional[List[str]] = None) -> bool:
        """
        Fetch all institutions from API and cache locally.
        
        Args:
            fields: Optional list of specific fields to fetch. If None, fetches all.
            
        Returns:
            True if successful, False otherwise
        """
        print("🚀 Starting institution data fetch from College Scorecard API...")
        
        # Prepare field parameter
        field_param = ",".join(fields) if fields else None
        
        page = 0
        total_fetched = 0
        cache_files = []
        
        try:
            while True:
                print(f"\n📄 Fetching page {page + 1}...")
                
                params = {
                    'page': page,
                    'per_page': self.per_page,
                    'api_key': self.api_key
                }
                
                if field_param:
                    params['fields'] = field_param
                
                response = self._exponential_backoff_request(self.base_url, params)
                if not response:
                    print(f"❌ Failed to fetch page {page + 1}")
                    return False
                
                data = response.json()
                
                # Extract metadata
                if page == 0:
                    metadata = data.get('metadata', {})
                    self.total_institutions = metadata.get('total', 0)
                    print(f"📊 Total institutions available: {self.total_institutions}")
                
                # Cache the raw response
                cache_file = CACHE_DIR / f"page_{page:05d}.json"
                with open(cache_file, 'w') as f:
                    json.dump(data, f, indent=2)
                cache_files.append(cache_file)
                
                # Check results
                results = data.get('results', [])
                if not results:
                    print(f"✅ Fetch complete! Retrieved {total_fetched} institutions")
                    break
                
                total_fetched += len(results)
                progress_pct = (total_fetched / self.total_institutions * 100) if self.total_institutions else 0
                print(f"   ✓ Cached {len(results)} records (Total: {total_fetched}/{self.total_institutions} - {progress_pct:.1f}%)")
                print(f"   💾 Cached to {cache_file}")
                print(f"   ⏱️  Rate limit remaining: {self.rate_limit_remaining}")
                
                page += 1
                
                # Small delay between requests to be API-friendly
                if self.total_institutions and page < (self.total_institutions // self.per_page + 1):
                    time.sleep(0.5)
            
            print(f"\n✨ All {total_fetched} institutions fetched and cached successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error during fetch: {e}")
            return False

    def get_cached_pages(self) -> List[Dict[str, Any]]:
        """
        Load all cached API responses from local files.
        
        Returns:
            List of page data dictionaries
        """
        pages = []
        cache_files = sorted(CACHE_DIR.glob("page_*.json"))
        
        print(f"📂 Loading {len(cache_files)} cached pages...")
        
        for cache_file in cache_files:
            try:
                with open(cache_file, 'r') as f:
                    page_data = json.load(f)
                    pages.append(page_data)
            except Exception as e:
                print(f"⚠️  Error loading {cache_file}: {e}")
        
        print(f"✅ Loaded {len(pages)} pages from cache")
        return pages

    def clear_cache(self):
        """Clear all cached API responses."""
        cache_files = list(CACHE_DIR.glob("page_*.json"))
        for cache_file in cache_files:
            cache_file.unlink()
        print(f"🗑️  Cleared {len(cache_files)} cached files")


if __name__ == "__main__":
    # Test API client
    if not API_KEY:
        print("❌ API_KEY not found in .env file")
        exit(1)
    
    client = APIClient(API_KEY)
    
    # Test fetch (limited fields for speed)
    test_fields = [
        "id", "school.name", "school.state", "school.city",
        "latest.student.size", "latest.admissions.admission_rate.overall"
    ]
    
    if client.fetch_institutions(fields=test_fields):
        pages = client.get_cached_pages()
        print(f"\n✅ Test successful! Fetched {len(pages)} pages")

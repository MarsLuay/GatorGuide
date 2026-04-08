#!/usr/bin/env python3
"""
Main Orchestration Script for College Scorecard Data Pipeline

Pipeline stages:
1. Fetch: Download API data and cache locally
2. Transform: Normalize JSON into SQL-ready records
3. Load: Insert into MySQL database
4. Validate: Verify data integrity

Usage:
    python main.py --fetch-only          # Fetch from API only
    python main.py --transform-only      # Transform cached data only
    python main.py --load-only           # Load pre-transformed data only
    python main.py --full-pipeline       # Execute all stages
    python main.py --create-schema       # Create database and schema only
    python main.py --validate            # Run validation checks
"""

import argparse
import sys
import time
from pathlib import Path
from Server.CrawlScoreBoard.api_client import APIClient
from Server.CrawlScoreBoard.transform import DataTransformer
from Server.CrawlScoreBoard.db_loader import DatabaseLoader
from dotenv import load_dotenv
import os

load_dotenv()

# Configuration
API_KEY = os.getenv('COLLEGE_SCORECARD_API_KEY')
SCHEMA_FILE = Path(__file__).parent / 'schema.sql'


def print_banner():
    """Print ASCII banner."""
    print("""
╔══════════════════════════════════════════════════════════════╗
║   College Scorecard → MySQL Data Pipeline                    ║
║   Fetch • Transform • Load • Validate                         ║
╚══════════════════════════════════════════════════════════════╝
    """)


def fetch_data(api_client: APIClient) -> bool:
    """Fetch data from College Scorecard API."""
    print("\n" + "="*60)
    print("STAGE 1: FETCH")
    print("="*60)
    
    # Fetch all available fields (commented to use defaults)
    # For production, you may want to specify fields to reduce data size
    success = api_client.fetch_institutions()
    
    return success


def transform_data(api_client: APIClient, transformer: DataTransformer) -> bool:
    """Transform cached API data."""
    print("\n" + "="*60)
    print("STAGE 2: TRANSFORM")
    print("="*60)
    
    # Load cached pages
    pages = api_client.get_cached_pages()
    if not pages:
        print("❌ No cached data found. Run fetch stage first.")
        return False
    
    # Transform to normalized format
    success = transformer.transform_pages(pages)
    if not success:
        return False
    
    # Save to CSV for inspection
    transformer.save_to_csv()
    
    return True


def load_data(transformer: DataTransformer, loader: DatabaseLoader) -> bool:
    """Load transformed data into MySQL."""
    print("\n" + "="*60)
    print("STAGE 3: LOAD")
    print("="*60)
    
    # Connect to database
    if not loader.connect():
        return False
    
    # Load all data
    try:
        success = loader.load_all_data(transformer)
        loader.print_summary()
        return success
    finally:
        loader.disconnect()


def create_schema_only(loader: DatabaseLoader) -> bool:
    """Create database and execute schema only."""
    print("\n" + "="*60)
    print("SCHEMA CREATION")
    print("="*60)
    
    # Create database
    if not loader.create_database_if_not_exists():
        return False
    
    # Connect and create tables
    if not loader.connect():
        return False
    
    try:
        success = loader.execute_schema(str(SCHEMA_FILE))
        return success
    finally:
        loader.disconnect()


def validate_data(loader: DatabaseLoader) -> bool:
    """Validate loaded data."""
    print("\n" + "="*60)
    print("STAGE 4: VALIDATE")
    print("="*60)
    
    if not loader.connect():
        return False
    
    try:
        if not loader.cursor or not loader.connection:
            print("❌ Database connection not established")
            return False
        
        print("\n🔍 Running validation checks...")
        
        # Count institutions
        loader.cursor.execute("SELECT COUNT(*) FROM institution")
        result = loader.cursor.fetchone()
        inst_count = int(result[0]) if (result and len(result) > 0 and result[0] is not None) else 0
        print(f"   ✓ Institutions: {inst_count:,}")
        
        # Count states with data
        loader.cursor.execute("""
            SELECT COUNT(DISTINCT state_id) FROM institution 
            WHERE state_id IS NOT NULL
        """)
        result = loader.cursor.fetchone()
        state_count = int(result[0]) if (result and len(result) > 0 and result[0] is not None) else 0
        print(f"   ✓ States represented: {state_count}")
        
        # Check enrollment metrics
        loader.cursor.execute("SELECT COUNT(*) FROM enrollment_metrics")
        result = loader.cursor.fetchone()
        enrollment_count = int(result[0]) if (result and len(result) > 0 and result[0] is not None) else 0
        print(f"   ✓ Enrollment metrics: {enrollment_count:,}")
        
        # Check for orphaned foreign keys
        loader.cursor.execute("""
            SELECT COUNT(*) FROM institution_demographics 
            WHERE institution_id NOT IN (SELECT id FROM institution)
        """)
        result = loader.cursor.fetchone()
        orphaned = int(result[0]) if (result and len(result) > 0 and result[0] is not None) else 0
        if orphaned > 0:
            print(f"   ⚠️  Orphaned demographic records: {orphaned}")
        else:
            print("   ✓ Referential integrity: OK")
        
        print("\n✅ Validation complete!")
        return True
        
    except Exception as e:
        print(f"❌ Validation error: {e}")
        return False
    finally:
        loader.disconnect()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="College Scorecard Data Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --fetch-only          # Fetch data from API
  python main.py --transform-only      # Transform cached data
  python main.py --load-only           # Load transformed data
  python main.py --full-pipeline       # Run complete pipeline
  python main.py --create-schema       # Create schema only
  python main.py --validate            # Validate loaded data
        """
    )
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--fetch-only', action='store_true',
                       help='Fetch data from API and cache locally')
    group.add_argument('--transform-only', action='store_true',
                       help='Transform cached API data to normalized format')
    group.add_argument('--load-only', action='store_true',
                       help='Load pre-transformed data into MySQL')
    group.add_argument('--full-pipeline', action='store_true',
                       help='Execute complete pipeline (fetch → transform → load)')
    group.add_argument('--create-schema', action='store_true',
                       help='Create database and schema only')
    group.add_argument('--validate', action='store_true',
                       help='Validate data in MySQL database')
    
    args = parser.parse_args()
    
    print_banner()
    
    # Validate configuration
    if not API_KEY:
        print("❌ COLLEGE_SCORECARD_API_KEY not found in .env file")
        return 1
    
    if not SCHEMA_FILE.exists():
        print(f"❌ Schema file not found: {SCHEMA_FILE}")
        return 1
    
    # Initialize components
    api_client = APIClient(API_KEY)
    transformer = DataTransformer()
    loader = DatabaseLoader()
    
    start_time = time.time()
    success = False
    
    try:
        # Execute requested stages
        if args.fetch_only:
            success = fetch_data(api_client)
        
        elif args.transform_only:
            success = transform_data(api_client, transformer)
        
        elif args.load_only:
            success = load_data(transformer, loader)
        
        elif args.full_pipeline:
            success = (
                fetch_data(api_client) and
                transform_data(api_client, transformer) and
                load_data(transformer, loader)
            )
        
        elif args.create_schema:
            success = create_schema_only(loader)
        
        elif args.validate:
            success = validate_data(loader)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Pipeline interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # Print summary
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    
    if success:
        print(f"✅ Pipeline completed successfully in {elapsed:.1f} seconds")
        print(f"{'='*60}")
        return 0
    else:
        print(f"❌ Pipeline failed after {elapsed:.1f} seconds")
        print(f"{'='*60}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

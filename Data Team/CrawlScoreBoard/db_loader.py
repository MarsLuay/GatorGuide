"""
Database Loader Module for College Scorecard Data

Handles:
- MySQL connection pooling and management
- Batch insertions with configurable batch size
- Foreign key constraint handling
- Transaction rollback on errors
- Progress tracking and error reporting
"""

import os
import mysql.connector
from mysql.connector import Error
from typing import Dict, List, Any, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

# MySQL Configuration
MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', '3306'))
MYSQL_USER = os.getenv('MYSQL_USER')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE')


class DatabaseLoader:
    """Handle all database operations for College Scorecard data."""

    def __init__(self, host: Optional[str] = MYSQL_HOST, port: int = MYSQL_PORT,
                 user: Optional[str] = MYSQL_USER, password: Optional[str] = MYSQL_PASSWORD,
                 database: Optional[str] = MYSQL_DATABASE):
        """
        Initialize database loader.
        
        Args:
            host: MySQL host
            port: MySQL port
            user: MySQL user
            password: MySQL password
            database: Database name
        """
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database
        self.connection: Optional[Any] = None
        self.cursor: Optional[Any] = None
        self.stats = {
            'institutions_loaded': 0,
            'demographics_loaded': 0,
            'enrollment_metrics_loaded': 0,
            'admission_metrics_loaded': 0,
            'financial_aid_metrics_loaded': 0,
            'completion_metrics_loaded': 0,
            'earnings_metrics_loaded': 0,
            'debt_metrics_loaded': 0,
            'repayment_metrics_loaded': 0,
            'field_of_study_loaded': 0,
            'errors': 0
        }

    def connect(self) -> bool:
        """
        Establish MySQL connection.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            print(f"🔗 Connecting to MySQL at {self.host}:{self.port}/{self.database}...")
            
            self.connection = mysql.connector.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                autocommit=False,
                connection_timeout=10
            )
            
            self.cursor = self.connection.cursor(dictionary=False)
            print("✅ Database connection successful!")
            return True
            
        except Error as e:
            print(f"❌ Database connection failed: {e}")
            return False

    def disconnect(self):
        """Close database connection."""
        if self.connection and self.connection.is_connected():
            if self.cursor:
                self.cursor.close()
            self.connection.close()
            print("🔌 Database disconnected")

    def create_database_if_not_exists(self) -> bool:
        """Create database if it doesn't exist."""
        try:
            conn = mysql.connector.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                autocommit=True
            )
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {self.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ Database '{self.database}' ready")
            cursor.close()
            conn.close()
            return True
        except Error as e:
            print(f"❌ Failed to create database: {e}")
            return False

    def execute_schema(self, schema_file: str) -> bool:
        """
        Execute SQL schema file.
        
        Args:
            schema_file: Path to schema.sql file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            print(f"\n📋 Loading schema from {schema_file}...")
            
            with open(schema_file, 'r') as f:
                schema_content = f.read()
            
            if not self.cursor or not self.connection:
                print("❌ Database connection not established")
                return False
            
            # Remove SQL comments and split by semicolon
            lines = []
            for line in schema_content.split('\n'):
                # Remove line comments
                if '--' in line:
                    line = line[:line.index('--')]
                line = line.strip()
                if line:
                    lines.append(line)
            
            clean_content = ' '.join(lines)
            statements = [s.strip() for s in clean_content.split(';') if s.strip()]
            
            print(f"📋 Found {len(statements)} statements to execute...")
            
            executed = 0
            for i, statement in enumerate(statements):
                try:
                    self.cursor.execute(statement)
                    self.connection.commit()
                    executed += 1
                    # Print first 60 chars of executed statement for confirmation
                    stmt_preview = statement.split('(')[0][:60].strip()
                    print(f"   ✓ [{executed:2d}] {stmt_preview}...")
                except Error as e:
                    # Ignore "table already exists" errors
                    if "already exists" in str(e):
                        print(f"   ⚠️  [{i+1:2d}] Table already exists (OK)")
                        executed += 1
                    else:
                        print(f"❌ CRITICAL ERROR in statement {i+1}: {e}")
                        print(f"   Statement: {statement[:200]}...")
                        raise
            
            print(f"\n✅ Schema loaded successfully! ({executed} statements executed)")
            return True
            
        except Exception as e:
            print(f"❌ Error loading schema: {e}")
            if self.connection:
                self.connection.rollback()
            return False

    def get_state_id(self, state_code: str) -> Optional[int]:
        """Get state ID from state code."""
        if not state_code or state_code not in ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
                                                   'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
                                                   'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
                                                   'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
                                                   'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']:
            return None
        
        try:
            if not self.cursor:
                return None
            self.cursor.execute(
                "SELECT id FROM state WHERE state_code = %s",
                (state_code,)
            )
            result = self.cursor.fetchone()
            if result and isinstance(result, (list, tuple)) and len(result) > 0:
                return int(result[0]) if result[0] is not None else None
            return None
        except Error as e:
            print(f"⚠️  Error getting state ID for {state_code}: {e}")
            return None

    def _get_lookup_id(self, table: str, code_column: str, code_value) -> Optional[int]:
        """Generic lookup helper: return id from `table` where `code_column` = code_value."""
        if code_value is None:
            return None
        try:
            if not self.cursor:
                return None
            query = f"SELECT id FROM {table} WHERE {code_column} = %s"
            self.cursor.execute(query, (code_value,))
            result = self.cursor.fetchone()
            if result and isinstance(result, (list, tuple)) and len(result) > 0:
                return int(result[0]) if result[0] is not None else None
            return None
        except Error as e:
            print(f"⚠️  Error looking up {table}.{code_column}={code_value}: {e}")
            return None

    def get_degree_type_id(self, degree_code) -> Optional[int]:
        """Map degree_code to `degree_type.id` using `degree_code` column."""
        return self._get_lookup_id('degree_type', 'degree_code', degree_code)

    def get_institution_type_id(self, type_code) -> Optional[int]:
        """Map institution type code to `institution_type.id` using `type_code` column."""
        return self._get_lookup_id('institution_type', 'type_code', type_code)

    def get_institution_id_map(self, api_ids: List[int]) -> Dict[int, int]:
        """Return a map {api_id: id} for given list of api_ids present in DB."""
        mapping: Dict[int, int] = {}
        if not api_ids:
            return mapping
        try:
            # Build placeholders
            placeholders = ','.join(['%s'] * len(api_ids))
            query = f"SELECT api_id, id FROM institution WHERE api_id IN ({placeholders})"
            self.cursor.execute(query, tuple(api_ids))
            rows = self.cursor.fetchall()
            for row in rows:
                # cursor is configured dictionary=False so row is tuple (api_id, id)
                if row and len(row) >= 2:
                    mapping[int(row[0])] = int(row[1])
            return mapping
        except Error as e:
            print(f"⚠️  Error building institution id map: {e}")
            return mapping

    def get_or_create_cohort_year(self, cohort_value) -> Optional[int]:
        """Ensure a cohort_year row exists for given cohort_value and return its id.

        Uses cohort_year=0 and cohort_type='latest' for the special 'latest' value.
        """
        try:
            if cohort_value == 'latest':
                cohort_year_val = 0
                cohort_type = 'latest'
            else:
                try:
                    cohort_year_val = int(cohort_value)
                    cohort_type = 'year'
                except Exception:
                    cohort_year_val = 0
                    cohort_type = str(cohort_value)

            # Insert if not exists
            self.cursor.execute(
                "INSERT IGNORE INTO cohort_year (cohort_year, cohort_type, description) VALUES (%s, %s, %s)",
                (cohort_year_val, cohort_type, f"Auto-created for {cohort_value}")
            )
            self.connection.commit()

            # Select id
            self.cursor.execute(
                "SELECT id FROM cohort_year WHERE cohort_year = %s AND cohort_type = %s",
                (cohort_year_val, cohort_type)
            )
            row = self.cursor.fetchone()
            if row and isinstance(row, (list, tuple)) and len(row) > 0:
                return int(row[0])
            return None
        except Error as e:
            print(f"⚠️  Error creating/reading cohort_year for {cohort_value}: {e}")
            if self.connection:
                self.connection.rollback()
            return None

    def insert_states(self) -> bool:
        """Insert US states into database."""
        print("\n🏛️  Inserting states...")
        
        state_data = [
            ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
            ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
            ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
            ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
            ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
            ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
            ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
            ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
            ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
            ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
            ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
            ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
            ('WI', 'Wisconsin'), ('WY', 'Wyoming'), ('DC', 'District of Columbia')
        ]
        
        try:
            if not self.cursor or not self.connection:
                return False
            for state_code, state_name in state_data:
                self.cursor.execute(
                    "INSERT IGNORE INTO state (state_code, state_name) VALUES (%s, %s)",
                    (state_code, state_name)
                )
            self.connection.commit()
            print(f"✅ Inserted {len(state_data)} states")
            return True
        except Error as e:
            print(f"❌ Error inserting states: {e}")
            if self.connection:
                self.connection.rollback()
            return False

    def batch_insert(self, table: str, records: List[Dict[str, Any]], 
                     batch_size: int = 1000, ignore_duplicates: bool = False) -> Tuple[int, int]:
        """
        Insert records in batches.
        
        Args:
            table: Table name
            records: List of record dictionaries
            batch_size: Number of records per batch
            
        Returns:
            Tuple of (inserted_count, error_count)
        """
        if not records:
            return 0, 0
        
        inserted = 0
        errors = 0
        
        print(f"\n📥 Inserting {len(records)} records into {table}...")
        
        try:
            if not self.cursor or not self.connection:
                return 0, len(records)
            columns = list(records[0].keys())
            placeholders = ", ".join(["%s"] * len(columns))
            column_names = ", ".join(columns)
            
            if ignore_duplicates:
                insert_query = f"INSERT IGNORE INTO {table} ({column_names}) VALUES ({placeholders})"
            else:
                insert_query = f"INSERT INTO {table} ({column_names}) VALUES ({placeholders})"
            
            for i in range(0, len(records), batch_size):
                batch = records[i:i+batch_size]
                batch_values = [tuple(r.values()) for r in batch]
                
                try:
                    self.cursor.executemany(insert_query, batch_values)
                    self.connection.commit()
                    inserted += len(batch)
                    
                    progress = min(i + batch_size, len(records))
                    pct = (progress / len(records) * 100)
                    print(f"   ✓ Inserted {progress}/{len(records)} ({pct:.1f}%)")
                    
                except Error as e:
                    print(f"⚠️  Batch error (records {i}-{i+len(batch)}): {e}")
                    if self.connection:
                        self.connection.rollback()
                    errors += len(batch)
            
            if inserted > 0:
                print(f"✅ Successfully inserted {inserted} records into {table}")
            if errors > 0:
                print(f"⚠️  {errors} records failed")
            
            return inserted, errors
            
        except Exception as e:
            print(f"❌ Critical error during batch insert: {e}")
            if self.connection:
                self.connection.rollback()
            return 0, len(records)

    def load_all_data(self, transformer) -> bool:
        """
        Load all transformed data into database.
        
        Args:
            transformer: DataTransformer instance with transformed data
            
        Returns:
            True if successful, False otherwise
        """
        print("\n🗂️  Starting database load...")
        
        # Insert states first (required for FK)
        if not self.insert_states():
            return False
        
        # Prepare institution records (add state IDs, map degree/type codes to FK ids)
        institutions = []
        for inst in transformer.institutions:
            inst_copy = inst.copy()
            state_id = self.get_state_id(inst.get('state_code'))
            inst_copy['state_id'] = state_id
            # Map region code (from API) -> region.id in DB
            if 'region_id' in inst_copy:
                region_code = inst_copy.get('region_id')
                region_fk = self._get_lookup_id('region', 'region_code', region_code)
                inst_copy['region_id'] = region_fk
            # Map predominant_degree (degree_code) -> predominant_degree_id
            if 'predominant_degree' in inst_copy:
                degree_code = inst_copy.pop('predominant_degree')
                inst_copy['predominant_degree_id'] = self.get_degree_type_id(degree_code)
            # Map institution_type (type_code) -> institution_type_id
            if 'institution_type' in inst_copy:
                type_code = inst_copy.pop('institution_type')
                inst_copy['institution_type_id'] = self.get_institution_type_id(type_code)
            # Remove the state_code field (not in table)
            if 'state_code' in inst_copy:
                del inst_copy['state_code']
            institutions.append(inst_copy)
        
        # Load institutions
        # First check which api_ids already exist to avoid duplicate-key errors
        api_ids = [inst.get('api_id') for inst in transformer.institutions if inst.get('api_id')]
        existing_map = self.get_institution_id_map(api_ids)
        to_insert = [i for i in institutions if i.get('api_id') not in existing_map]

        if to_insert:
            loaded, errors = self.batch_insert('institution', to_insert)
            self.stats['institutions_loaded'] = loaded + len(existing_map)
            self.stats['errors'] += errors
        else:
            # Nothing new to insert
            self.stats['institutions_loaded'] = len(existing_map)

        # Build full api_id -> id map for all institutions
        institution_map = self.get_institution_id_map(api_ids)
        
        # Load other metrics (remap keys emitted by transformer to DB-ready column names)
        if transformer.demographics:
            demographics_ready = []
            for rec in transformer.demographics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    # skip records for institutions not inserted
                    continue
                r['institution_id'] = inst_id
                # Map race_code -> race_ethnicity_id if present
                race_code = r.pop('race_code', None)
                if race_code is not None:
                    race_id = self._get_lookup_id('race_ethnicity', 'race_code', race_code)
                    r['race_ethnicity_id'] = race_id
                # Map cohort_year -> cohort_year_id if present
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    cohort_id = self.get_or_create_cohort_year(cohort)
                    r['cohort_year_id'] = cohort_id
                demographics_ready.append(r)

            loaded, errors = self.batch_insert('institution_demographics', demographics_ready, ignore_duplicates=True)
            self.stats['demographics_loaded'] = loaded
            self.stats['errors'] += errors
        
        if transformer.enrollment_metrics:
            enrollment_ready = []
            for rec in transformer.enrollment_metrics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    continue
                r['institution_id'] = inst_id
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    r['cohort_year_id'] = self.get_or_create_cohort_year(cohort)
                enrollment_ready.append(r)

            loaded, errors = self.batch_insert('enrollment_metrics', enrollment_ready, ignore_duplicates=True)
            self.stats['enrollment_metrics_loaded'] = loaded
            self.stats['errors'] += errors
        
        if transformer.admission_metrics:
            admission_ready = []
            for rec in transformer.admission_metrics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    continue
                r['institution_id'] = inst_id
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    r['cohort_year_id'] = self.get_or_create_cohort_year(cohort)
                admission_ready.append(r)

            loaded, errors = self.batch_insert('admission_metrics', admission_ready, ignore_duplicates=True)
            self.stats['admission_metrics_loaded'] = loaded
            self.stats['errors'] += errors
        
        if transformer.financial_aid_metrics:
            financial_ready = []
            for rec in transformer.financial_aid_metrics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    continue
                r['institution_id'] = inst_id
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    r['cohort_year_id'] = self.get_or_create_cohort_year(cohort)
                financial_ready.append(r)

            loaded, errors = self.batch_insert('financial_aid_metrics', financial_ready, ignore_duplicates=True)
            self.stats['financial_aid_metrics_loaded'] = loaded
            self.stats['errors'] += errors
        
        if transformer.completion_metrics:
            completion_ready = []
            for rec in transformer.completion_metrics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    continue
                r['institution_id'] = inst_id
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    r['cohort_year_id'] = self.get_or_create_cohort_year(cohort)
                completion_ready.append(r)

            loaded, errors = self.batch_insert('completion_metrics', completion_ready, ignore_duplicates=True)
            self.stats['completion_metrics_loaded'] = loaded
            self.stats['errors'] += errors
        
        if transformer.earnings_metrics:
            earnings_ready = []
            for rec in transformer.earnings_metrics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    continue
                r['institution_id'] = inst_id
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    r['cohort_year_id'] = self.get_or_create_cohort_year(cohort)
                earnings_ready.append(r)

            loaded, errors = self.batch_insert('earnings_metrics', earnings_ready, ignore_duplicates=True)
            self.stats['earnings_metrics_loaded'] = loaded
            self.stats['errors'] += errors
        
        if transformer.debt_metrics:
            debt_ready = []
            for rec in transformer.debt_metrics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    continue
                r['institution_id'] = inst_id
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    r['cohort_year_id'] = self.get_or_create_cohort_year(cohort)
                debt_ready.append(r)

            loaded, errors = self.batch_insert('debt_metrics', debt_ready, ignore_duplicates=True)
            self.stats['debt_metrics_loaded'] = loaded
            self.stats['errors'] += errors
        
        if transformer.repayment_metrics:
            repayment_ready = []
            for rec in transformer.repayment_metrics:
                r = rec.copy()
                api_id = r.pop('institution_api_id', None)
                inst_id = institution_map.get(api_id)
                if not inst_id:
                    continue
                r['institution_id'] = inst_id
                cohort = r.pop('cohort_year', None)
                if cohort is not None:
                    r['cohort_year_id'] = self.get_or_create_cohort_year(cohort)
                repayment_ready.append(r)

            loaded, errors = self.batch_insert('repayment_metrics', repayment_ready, ignore_duplicates=True)
            self.stats['repayment_metrics_loaded'] = loaded
            self.stats['errors'] += errors
        
        return True

    def print_summary(self):
        """Print load summary statistics."""
        print("\n" + "="*60)
        print("📊 DATABASE LOAD SUMMARY")
        print("="*60)
        print(f"✅ Institutions loaded:         {self.stats['institutions_loaded']:,}")
        print(f"✅ Demographic records loaded:  {self.stats['demographics_loaded']:,}")
        print(f"✅ Enrollment metrics loaded:   {self.stats['enrollment_metrics_loaded']:,}")
        print(f"✅ Admission metrics loaded:    {self.stats['admission_metrics_loaded']:,}")
        print(f"✅ Financial aid metrics:       {self.stats['financial_aid_metrics_loaded']:,}")
        print(f"✅ Completion metrics loaded:   {self.stats['completion_metrics_loaded']:,}")
        print(f"✅ Earnings metrics loaded:     {self.stats['earnings_metrics_loaded']:,}")
        print(f"✅ Debt metrics loaded:         {self.stats['debt_metrics_loaded']:,}")
        print(f"✅ Repayment metrics loaded:    {self.stats['repayment_metrics_loaded']:,}")
        
        total = sum(v for k, v in self.stats.items() if k != 'errors')
        print("-" * 60)
        print(f"📈 TOTAL RECORDS LOADED:        {total:,}")
        if self.stats['errors'] > 0:
            print(f"⚠️  ERRORS:                       {self.stats['errors']:,}")
        print("="*60)


if __name__ == "__main__":
    # Test database loader
    loader = DatabaseLoader()
    if loader.connect():
        loader.disconnect()

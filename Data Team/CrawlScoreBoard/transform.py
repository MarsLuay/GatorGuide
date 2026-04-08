"""
Data Transformation Module for College Scorecard API Responses

Handles:
- Flattening nested JSON structures (dotted keys → columns)
- Demographic data normalization (wide → narrow format)
- Field of Study data extraction from nested arrays
- Data validation and null handling
- Type conversion for SQL insertion
"""

from typing import Dict, List, Any, Optional
from pathlib import Path
from dotenv import load_dotenv
import os
import csv

load_dotenv()
OUTPUT_DIR = Path(os.getenv('OUTPUT_DIR', './data_output'))


class DataTransformer:
    """Transform raw API JSON into normalized SQL-ready records."""

    # Race/ethnicity field mappings from API
    RACE_ETHNICITY_CODES = {
        'UGDS_WHITE': 'WHITE',
        'UGDS_BLACK': 'BLACK',
        'UGDS_HISP': 'HISP',
        'UGDS_ASIAN': 'ASIAN',
        'UGDS_AIAN': 'AIAN',
        'UGDS_NHPI': 'NHPI',
        'UGDS_2MOR': '2MOR',
        'UGDS_NRA': 'NRA',
        'UGDS_UNKN': 'UNKN'
    }

    # State codes for lookup
    STATE_CODES = {
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    }

    def __init__(self):
        """Initialize transformer and create output directory."""
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        self.institutions = []
        self.demographics = []
        self.field_of_study = []
        self.enrollment_metrics = []
        self.admission_metrics = []
        self.financial_aid_metrics = []
        self.completion_metrics = []
        self.earnings_metrics = []
        self.debt_metrics = []
        self.repayment_metrics = []

    def transform_pages(self, pages: List[Dict[str, Any]]) -> bool:
        """
        Transform all cached API pages into normalized records.
        
        Args:
            pages: List of API response page dictionaries
            
        Returns:
            True if successful, False otherwise
        """
        print("\n🔄 Starting data transformation...")
        
        total_institutions = 0
        
        try:
            for page_num, page in enumerate(pages):
                results = page.get('results', [])
                print(f"📄 Transforming page {page_num + 1} ({len(results)} institutions)...")
                
                for institution in results:
                    self._transform_institution(institution)
                    total_institutions += 1
                
                if (page_num + 1) % 10 == 0:
                    print(f"   ✓ Processed {total_institutions} institutions...")
            
            print("\n✅ Transformation complete!")
            print(f"   📊 Institutions: {len(self.institutions)}")
            print(f"   👥 Demographic records: {len(self.demographics)}")
            print(f"   🎓 Field of Study programs: {len(self.field_of_study)}")
            print(f"   📈 Enrollment metrics: {len(self.enrollment_metrics)}")
            print(f"   🎯 Admission metrics: {len(self.admission_metrics)}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error during transformation: {e}")
            return False

    def _transform_institution(self, raw_institution: Dict[str, Any]):
        """Transform a single institution record."""
        try:
            # Basic institution info
            inst_id = raw_institution.get('id')
            if not inst_id:
                print("⚠️  Skipping institution with no ID")
                return
            
            inst = {
                'api_id': inst_id,
                'name': raw_institution.get('school', {}).get('name', 'Unknown'),
                'city': raw_institution.get('school', {}).get('city'),
                'state_code': raw_institution.get('school', {}).get('state'),
                'zip_code': raw_institution.get('school', {}).get('zip'),
                'region_id': raw_institution.get('school', {}).get('region_id'),
                'latitude': raw_institution.get('location', {}).get('lat'),
                'longitude': raw_institution.get('location', {}).get('lon'),
                'predominant_degree': raw_institution.get('school', {}).get('degrees_awarded', {}).get('predominant'),
                'institution_type': raw_institution.get('school', {}).get('type'),
                'operational_status': raw_institution.get('school', {}).get('operating'),
                'hcm2_status': raw_institution.get('HCM2'),
                'opeflag': raw_institution.get('OPEFLAG'),
                'dolprovider': raw_institution.get('DOLPROVIDER'),
                
                'student_count': self._safe_int(raw_institution.get('latest', {}).get('student', {}).get('size')),
                'student_faculty_ratio': self._safe_float(raw_institution.get('student.faculty_ratio') or raw_institution.get('STUFACR')),
                'tuition_in_state': self._safe_float(raw_institution.get('latest', {}).get('cost', {}).get('tuition', {}).get('in_state')),
                'tuition_out_of_state': self._safe_float(raw_institution.get('latest', {}).get('cost', {}).get('tuition', {}).get('out_of_state')),
                'living_cost_on_campus': self._safe_float(raw_institution.get('latest', {}).get('cost', {}).get('living_expenses', {}).get('on_campus')),
                'sat_avg': self._safe_int(raw_institution.get('latest', {}).get('admissions', {}).get('sat_scores', {}).get('average', {}).get('overall')),
                'act_avg': self._safe_int(raw_institution.get('latest', {}).get('admissions', {}).get('act_scores', {}).get('midpoint', {}).get('cumulative')),
                'admission_rate': self._safe_float(raw_institution.get('latest', {}).get('admissions', {}).get('admission_rate', {}).get('overall')),
                'completion_rate': self._safe_float(raw_institution.get('latest', {}).get('completion', {}).get('rate'))
            }
            
            self.institutions.append(inst)
            
            # Extract demographics (wide → narrow format)
            self._extract_demographics(inst_id, raw_institution)
            
            # Extract enrollment metrics
            self._extract_enrollment_metrics(inst_id, raw_institution)
            
            # Extract admission metrics
            self._extract_admission_metrics(inst_id, raw_institution)
            
            # Extract financial aid metrics
            self._extract_financial_aid_metrics(inst_id, raw_institution)
            
            # Extract completion metrics
            self._extract_completion_metrics(inst_id, raw_institution)
            
            # Extract earnings metrics
            self._extract_earnings_metrics(inst_id, raw_institution)
            
            # Extract debt metrics
            self._extract_debt_metrics(inst_id, raw_institution)
            
            # Extract repayment metrics
            self._extract_repayment_metrics(inst_id, raw_institution)
            
            # Extract field of study data (nested arrays)
            self._extract_field_of_study(inst_id, raw_institution)
            
        except Exception as e:
            print(f"⚠️  Error transforming institution {inst_id}: {e}")

    def _extract_demographics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract and normalize demographic data."""
        for api_field, race_code in self.RACE_ETHNICITY_CODES.items():
            value = raw_institution.get(api_field)
            if value is not None:
                demo = {
                    'institution_api_id': inst_id,
                    'race_code': race_code,
                    'percentage': self._safe_float(value),
                    'category': 'undergraduate'
                }
                self.demographics.append(demo)

    def _extract_enrollment_metrics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract enrollment metrics."""
        latest = raw_institution.get('latest', {})
        student = latest.get('student', {})
        
        if any([student.get('size'), student.get('enrollment')]):
            metrics = {
                'institution_api_id': inst_id,
                'cohort_year': 'latest',
                'total_enrollment': self._safe_int(student.get('size')),
                'full_time_enrollment': self._safe_float(student.get('enrollment', {}).get('full_time')),
                'pell_grant_recipients': self._safe_float(raw_institution.get('PCTPELL_DCS_POOLED_SUPP')),
                'federal_loan_recipients': self._safe_float(raw_institution.get('PCTFLOAN_DCS_POOLED_SUPP')),
                'student_to_faculty_ratio': self._safe_float(raw_institution.get('STUFACR')),
                'full_time_retention_rate': self._safe_float(raw_institution.get('RET_FT4_POOLED_SUPP')),
                'part_time_retention_rate': self._safe_float(raw_institution.get('RET_PT4_POOLED_SUPP'))
            }
            self.enrollment_metrics.append(metrics)

    def _extract_admission_metrics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract admission metrics."""
        latest = raw_institution.get('latest', {})
        admissions = latest.get('admissions', {})
        
        if any([admissions.get('admission_rate'), raw_institution.get('SATVR25')]):
            metrics = {
                'institution_api_id': inst_id,
                'cohort_year': 'latest',
                'admission_rate': self._safe_float(admissions.get('admission_rate', {}).get('overall')),
                'admission_rate_supplemental': self._safe_float(raw_institution.get('ADM_RATE_SUPP')),
                'sat_verbal_25th': self._safe_int(raw_institution.get('SATVR25')),
                'sat_verbal_75th': self._safe_int(raw_institution.get('SATVR75')),
                'sat_math_25th': self._safe_int(raw_institution.get('SATMT25')),
                'sat_math_75th': self._safe_int(raw_institution.get('SATMT75')),
                'act_composite_25th': self._safe_int(raw_institution.get('ACTCM25')),
                'act_composite_75th': self._safe_int(raw_institution.get('ACTCM75'))
            }
            self.admission_metrics.append(metrics)

    def _extract_financial_aid_metrics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract financial aid metrics."""
        latest = raw_institution.get('latest', {})
        cost = latest.get('cost', {})
        
        if any([cost.get('tuition'), cost.get('living_expenses')]):
            metrics = {
                'institution_api_id': inst_id,
                'cohort_year': 'latest',
                'tuition_in_state': self._safe_float(cost.get('tuition', {}).get('in_state')),
                'tuition_out_of_state': self._safe_float(cost.get('tuition', {}).get('out_of_state')),
                'avg_net_price_public': self._safe_float(raw_institution.get('NPT4_PUB')),
                'avg_net_price_private': self._safe_float(raw_institution.get('NPT4_PRIV')),
                'living_cost_on_campus': self._safe_float(cost.get('living_expenses', {}).get('on_campus')),
                'living_cost_off_campus_with_family': self._safe_float(cost.get('living_expenses', {}).get('off_campus_with_family')),
                'living_cost_off_campus_alone': self._safe_float(cost.get('living_expenses', {}).get('off_campus'))
            }
            self.financial_aid_metrics.append(metrics)

    def _extract_completion_metrics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract completion/graduation metrics."""
        latest = raw_institution.get('latest', {})
        completion = latest.get('completion', {})
        
        if any([completion.get('rate'), raw_institution.get('OMAWDP8_ALL_POOLED_SUPP')]):
            metrics = {
                'institution_api_id': inst_id,
                'cohort_year': 'latest',
                'completion_rate_8yr': self._safe_float(completion.get('rate')),
                'completion_rate_6yr': self._safe_float(raw_institution.get('C150_L4_POOLED_SUPP')),
                'completion_rate_4yr': self._safe_float(raw_institution.get('C150_L4_PELL_POOLED_SUPP'))
            }
            self.completion_metrics.append(metrics)

    def _extract_earnings_metrics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract earnings metrics."""
        latest = raw_institution.get('latest', {})
        earnings = latest.get('earnings', {})
        
        if any([earnings.get('10_yrs_after_entry'), raw_institution.get('MD_EARN_WNE_P10')]):
            metrics = {
                'institution_api_id': inst_id,
                'cohort_year': 'latest',
                'median_earnings_10yr': self._safe_int(earnings.get('10_yrs_after_entry')),
                'median_earnings_6yr': self._safe_int(raw_institution.get('MD_EARN_WNE_P6')),
                'pct_earning_above_hs_grad': self._safe_float(raw_institution.get('GT_THRESHOLD_P6_SUPP_P6'))
            }
            self.earnings_metrics.append(metrics)

    def _extract_debt_metrics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract debt metrics."""
        if any([raw_institution.get('GRAD_DEBT_MDN_SUPP'), raw_institution.get('PPLUS_DEBT_ALL_POOLED_SUPP')]):
            metrics = {
                'institution_api_id': inst_id,
                'cohort_year': 'latest',
                'median_federal_loan_debt': self._safe_float(raw_institution.get('GRAD_DEBT_MDN_SUPP')),
                'median_federal_loan_debt_10yr_payment': self._safe_int(raw_institution.get('GRAD_DEBT_MDN10YR_SUPP')),
                'median_parent_plus_debt': self._safe_float(raw_institution.get('PPLUS_DEBT_ALL_POOLED_SUPP')),
                'pct_parent_plus_low': self._safe_float(raw_institution.get('PPLUS_PCT_LOW_POOLED_SUPP')),
                'pct_parent_plus_high': self._safe_float(raw_institution.get('PPLUS_PCT_HIGH_POOLED_SUPP'))
            }
            self.debt_metrics.append(metrics)

    def _extract_repayment_metrics(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract repayment metrics."""
        if raw_institution.get('BBRR2_FED_UG_EVAL_DFLT_RT'):
            metrics = {
                'institution_api_id': inst_id,
                'cohort_year': 'latest',
                'repayment_rate_defaulted': self._safe_float(raw_institution.get('BBRR2_FED_UG_EVAL_DFLT_RT')),
                'repayment_rate_delinquent': self._safe_float(raw_institution.get('BBRR2_FED_UG_EVAL_DELIN_RT')),
                'repayment_rate_forbearance': self._safe_float(raw_institution.get('BBRR2_FED_UG_EVAL_CONSO_RT')),
                'repayment_rate_paid_in_full': self._safe_float(raw_institution.get('BBRR2_FED_UG_EVAL_PAIDINFULL_RT'))
            }
            self.repayment_metrics.append(metrics)

    def _extract_field_of_study(self, inst_id: int, raw_institution: Dict[str, Any]):
        """Extract field of study data from nested arrays."""
        programs = raw_institution.get('programs', [])
        if not isinstance(programs, list):
            return
        
        for program in programs:
            try:
                cip_code = program.get('code')
                cip_desc = program.get('description')
                cred_level = program.get('credential_level')
                
                if not all([cip_code, cred_level]):
                    continue
                
                fos_record = {
                    'institution_api_id': inst_id,
                    'cip_code': cip_code,
                    'cip_description': cip_desc,
                    'credential_level': cred_level,
                    'award_count': self._safe_int(program.get('ipedscount2')),
                    'median_earnings_5yr': self._safe_int(program.get('earnings_mdn_5yr')),
                    'median_debt_all_schools': self._safe_float(program.get('debt_mdn_all_stgp_any')),
                    'median_debt_this_school': self._safe_float(program.get('debt_mdn_all_stgp_eval'))
                }
                self.field_of_study.append(fos_record)
                
            except Exception as e:
                print(f"⚠️  Error extracting field of study for institution {inst_id}: {e}")

    def _safe_int(self, value: Any) -> Optional[int]:
        """Safely convert value to int or return None."""
        if value is None or value == 'NULL':
            return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None

    def _safe_float(self, value: Any) -> Optional[float]:
        """Safely convert value to float or return None."""
        if value is None or value == 'NULL':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    def save_to_csv(self):
        """Save transformed data to CSV files for inspection."""
        print("\n💾 Saving transformed data to CSV files...")
        
        # Save institutions
        if self.institutions:
            inst_file = OUTPUT_DIR / "institutions.csv"
            with open(inst_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=self.institutions[0].keys())
                writer.writeheader()
                writer.writerows(self.institutions)
            print(f"   ✓ Saved {len(self.institutions)} institutions to {inst_file}")
        
        # Save demographics
        if self.demographics:
            demo_file = OUTPUT_DIR / "demographics.csv"
            with open(demo_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=self.demographics[0].keys())
                writer.writeheader()
                writer.writerows(self.demographics)
            print(f"   ✓ Saved {len(self.demographics)} demographic records to {demo_file}")
        
        # Save enrollment metrics
        if self.enrollment_metrics:
            enroll_file = OUTPUT_DIR / "enrollment_metrics.csv"
            with open(enroll_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=self.enrollment_metrics[0].keys())
                writer.writeheader()
                writer.writerows(self.enrollment_metrics)
            print(f"   ✓ Saved {len(self.enrollment_metrics)} enrollment records to {enroll_file}")
        
        # Save field of study
        if self.field_of_study:
            fos_file = OUTPUT_DIR / "field_of_study.csv"
            with open(fos_file, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=self.field_of_study[0].keys())
                writer.writeheader()
                writer.writerows(self.field_of_study)
            print(f"   ✓ Saved {len(self.field_of_study)} field of study records to {fos_file}")
        
        print("✅ CSV export complete!")


if __name__ == "__main__":
    # Test transformer with sample data
    print("Running transformer test...")

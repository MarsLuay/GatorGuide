import json
import csv
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def transform_data():
    # 1. Setup Paths
    current_dir = Path(__file__).parent
    cache_dir = current_dir / os.getenv("CACHE_DIR", "data_cache")
    output_dir = current_dir / os.getenv("OUTPUT_DIR", "data_output")
    output_dir.mkdir(exist_ok=True)
    
    output_file = output_dir / "final_schools_data_cleaned.csv"
    
    # 2. Define strict column order for CSV
    headers = [
        "name", "type", "address", "city", "state", "zipcode", "id", 
        "test_scores_required", "admission_rate", "tuition", "living_expenses", 
        "number_of_student", "staff_student_rate", "gar", 
        "climate", "courses_and_classes", "deadline_dates", 
        "scholarship", "school_url", "english_proficiency_required"
    ]
    
    all_rows = []
    
    # 3. Load cached JSON files
    json_files = sorted(cache_dir.glob("page_*.json"))
    
    if not json_files:
        print("❌ No cached JSON files found. Please run the scraper first.")
        return

    print(f"🔄 Transforming {len(json_files)} files...")

    for file_path in json_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                page_data = json.load(f)
                
                # Check if page_data is an empty list or not iterable (e.g. dict)
                if not isinstance(page_data, list):
                    print(f"⚠️ Skipping non-list file: {file_path}")
                    continue

                for school in page_data:
                    if not isinstance(school, dict):
                        continue

                    # Flatten the cost_of_attendance object, handle None
                    cost = school.get("cost_of_attendance") or {}
                    
                    # Map the JSON keys to the CSV row
                    row = {
                        "name": school.get("name"),
                        "type": school.get("type"),
                        "city": school.get("city"),
                        "state": school.get("state"),
                        "zipcode": school.get("zipcode"),
                        "id": school.get("id"),
                        "test_scores_required": school.get("test_scores_required"),
                        "admission_rate": school.get("latest.admissions.admission_rate.overall"),
                        "tuition": cost.get("tuition"),
                        "living_expenses": cost.get("living_expenses"),
                        "number_of_student": school.get("number_of_student"),
                        "staff_student_rate": school.get("staff_student_rate"),
                        "gar": school.get("gar"),
                        "climate": school.get("climate"),
                        "courses_and_classes": school.get("courses_and_classes"),
                        "deadline_dates": school.get("deadline_dates"),
                        "scholarship": school.get("scholarship"),
                        "school_url": school.get("school_url"),
                        "english_proficiency_required": school.get("english_proficiency_required")
                    }
                    all_rows.append(row)
            except json.JSONDecodeError:
                print(f"⚠️ Skipping corrupted file: {file_path}")

    # 4. Write to CSV with UTF-8 encoding (to handle special characters in school names)
    with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(all_rows)

    print("-" * 30)
    print(f"✅ Transformation Complete!")
    print(f"📁 Output: {output_file.absolute()}")
    print(f"📊 Total Schools Processed: {len(all_rows)}")

if __name__ == "__main__":
    transform_data()
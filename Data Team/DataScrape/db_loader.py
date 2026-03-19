import csv
import os
import sys
from pathlib import Path

import django
from dotenv import load_dotenv

load_dotenv()

# Path to the DataScrape folder, where this file lives.
DATASCRAPE_DIR = Path(__file__).resolve().parent

# Root of the Data Team workspace.
ROOT_DIR = DATASCRAPE_DIR.parent

# Django project root in the current repo structure.
# This must be on sys.path so that `import Server.settings` and `import API.models`
# both resolve correctly.
DJANGO_PROJECT_DIR = ROOT_DIR / "Server"


def validate_paths():
    errors = []

    if not DJANGO_PROJECT_DIR.exists():
        errors.append(f"  ERROR: Django project dir not found at: {DJANGO_PROJECT_DIR}")

    if not (DJANGO_PROJECT_DIR / "Server" / "settings.py").exists():
        errors.append(
            f"  ERROR: settings.py not found at: {DJANGO_PROJECT_DIR / 'Server' / 'settings.py'}"
        )

    if not (DJANGO_PROJECT_DIR / "API" / "models.py").exists():
        errors.append(
            f"  ERROR: models.py not found at: {DJANGO_PROJECT_DIR / 'API' / 'models.py'}"
        )

    if errors:
        print("Path validation failed:")
        for err in errors:
            print(err)
        print("\nPaths checked:")
        print(f"  DATASCRAPE_DIR    : {DATASCRAPE_DIR}")
        print(f"  ROOT_DIR          : {ROOT_DIR}")
        print(f"  DJANGO_PROJECT_DIR: {DJANGO_PROJECT_DIR}")
        sys.exit(1)

    print("Paths validated successfully.")
    print(f"  DATASCRAPE_DIR    : {DATASCRAPE_DIR}")
    print(f"  DJANGO_PROJECT_DIR: {DJANGO_PROJECT_DIR}")


validate_paths()

if str(DJANGO_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(DJANGO_PROJECT_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Server.settings")

try:
    django.setup()
    print("Django initialized successfully.")
except Exception as e:
    print(f"Failed to initialize Django: {e}")
    print("Make sure your virtual environment is active and Django is installed.")
    sys.exit(1)

try:
    from API.models import CostOfAttendance, School

    print("Models imported successfully.")
except ImportError as e:
    print(f"Could not import models: {e}")
    print("Make sure API/models.py exists and migrations have been run.")
    sys.exit(1)


def safe_decimal(value):
    """Convert messy currency strings like '$1,234.56' to float. Returns 0.0 on failure."""
    if not value:
        return 0.0
    try:
        return float(str(value).replace("$", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def safe_int(value):
    """Convert a value to int safely. Returns 0 on failure."""
    if not value:
        return 0
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return 0


def safe_str(value, default=""):
    """Strip whitespace from a string, return default if empty."""
    if value is None:
        return default
    return str(value).strip() or default


def load_csv_to_django():
    output_dir_name = os.getenv("OUTPUT_DIR", "data_output")
    csv_path = DATASCRAPE_DIR / output_dir_name / "final_schools_data_cleaned.csv"

    if not csv_path.exists():
        print(f"CSV not found at: {csv_path}")
        print("Make sure the file exists in DataScrape/data_output/.")
        return

    print(f"\nLoading CSV from: {csv_path}\n")

    success_count = 0
    error_count = 0
    errors = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        expected_columns = {
            "id",
            "name",
            "type",
            "city",
            "state",
            "zipcode",
            "test_scores_required",
            "english_proficiency_required",
            "number_of_student",
            "staff_student_rate",
            "gar",
            "climate",
            "courses_and_classes",
            "deadline_dates",
            "scholarship",
            "school_url",
            "tuition",
            "living_expenses",
        }
        missing_cols = expected_columns - set(reader.fieldnames or [])
        if missing_cols:
            print(f"Warning: these expected columns are missing from the CSV: {missing_cols}\n")

        for row in reader:
            school_name = safe_str(row.get("name"), "Unknown")
            school_id = safe_str(row.get("id"))

            if not school_id:
                print(f"Skipping row with missing 'id' for school: {school_name}")
                error_count += 1
                continue

            try:
                school, created = School.objects.update_or_create(
                    school_id=school_id,
                    defaults={
                        "name": safe_str(row.get("name")),
                        "school_type": safe_str(row.get("type")),
                        "address": safe_str(row.get("address")),
                        "city": safe_str(row.get("city")),
                        "state": safe_str(row.get("state")),
                        "zipcode": safe_str(row.get("zipcode")),
                        "test_scores_required": safe_str(row.get("test_scores_required")),
                        "english_proficiency_required": safe_str(
                            row.get("english_proficiency_required")
                        ),
                        "number_of_students": safe_int(row.get("number_of_student")),
                        "staff_student_rate": safe_str(row.get("staff_student_rate")),
                        "gar": safe_str(row.get("gar")),
                        "climate": safe_str(row.get("climate")),
                        "courses_and_classes": safe_str(row.get("courses_and_classes")),
                        "deadline_dates": safe_str(row.get("deadline_dates")),
                        "scholarship_info": safe_str(row.get("scholarship")),
                        "school_url": safe_str(row.get("school_url")),
                    },
                )

                CostOfAttendance.objects.update_or_create(
                    school=school,
                    defaults={
                        "tuition": safe_decimal(row.get("tuition")),
                        "living_expenses": safe_decimal(row.get("living_expenses")),
                    },
                )

                action = "Created" if created else "Updated"
                print(f"  {action}: {school_name} (id={school_id})")
                success_count += 1

            except Exception as e:
                msg = f"  Error on '{school_name}' (id={school_id}): {e}"
                print(msg)
                errors.append(msg)
                error_count += 1

    print("\n" + "=" * 50)
    print("Import complete.")
    print(f"  Successful: {success_count}")
    print(f"  Errors    : {error_count}")

    if errors:
        print("\nError details:")
        for err in errors:
            print(err)
    print("=" * 50)


if __name__ == "__main__":
    load_csv_to_django()

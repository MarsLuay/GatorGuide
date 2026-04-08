import json
import os
import time
from collections import OrderedDict
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()


class CollegeScorecardScraper:
    def __init__(self, api_key):
        self.api_key = api_key or os.getenv("API_KEY")
        self.base_url = (
            os.getenv(
                "API_BASE_URL",
                "https://api.data.gov/ed/collegescorecard/v1/schools",
            )
            + ".json"
        )

        # Use CACHE_DIR from .env or default to local 'data_cache'
        cache_env = os.getenv("CACHE_DIR", "data_cache")
        self.cache_dir = Path(cache_env)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Mapping for the specific fields we want to pull
        self.fields = [
            "id",
            "school.name",
            "school.ownership",
            "school.address",
            "school.city",
            "school.state",
            "school.zip",
            "school.school_url",
            "latest.student.size",
            "latest.student.demographics.student_faculty_ratio",
            "latest.completion.rate_pooled_4yr",
            "latest.cost.tuition.out_of_state",
            "latest.cost.attendance.academic_year",
            "latest.admissions.test_requirements",
        ]

    def fetch_all(self):
        per_page = int(os.getenv("API_PER_PAGE", 100))
        timeout = int(os.getenv("API_TIMEOUT", 30))

        params = {
            "api_key": self.api_key,
            "fields": ",".join(self.fields),
            "per_page": per_page,
            "page": 0,
        }

        # Ivy League IDs for the "Type" logic
        ivy_ids = [166027, 130794, 190150, 186131, 215062, 182285, 217156, 190415]

        while True:
            current_page = params["page"]
            print(f"Processing page {current_page}...")
            try:
                response = requests.get(self.base_url, params=params, timeout=timeout)
                response.raise_for_status()
                data = response.json()
                results = data.get("results", [])

                if not results:
                    break

                ordered_results = []
                for item in results:
                    url = item.get("school.school_url")

                    # Logic to handle nulls with URL fallback
                    def get_val(key):
                        val = item.get(key)
                        if val is None or val == "":
                            return f"See {url}" if url else None
                        return val

                    # Create Ordered Dictionary to keep JSON structure consistent
                    school = OrderedDict(
                        [
                            ("name", item.get("school.name") or (f"See {url}" if url else None)),
                            (
                                "type",
                                "Ivy League"
                                if item.get("id") in ivy_ids
                                else ("Public" if item.get("school.ownership") == 1 else "Private"),
                            ),
                            ("address", get_val("school.address")),
                            ("city", get_val("school.city")),
                            ("state", get_val("school.state")),
                            ("zipcode", get_val("school.zip")),
                            ("id", item.get("id")),
                            (
                                "test_scores_required",
                                get_val("latest.admissions.sat_scores.average.overall")
                                or get_val("latest.admissions.act_scores.average.overall"),
                            ),
                            (
                                "latest.admissions.admission_rate.overall",
                                get_val("latest.admissions.admission_rate.overall"),
                            ),
                            (
                                "cost_of_attendance",
                                OrderedDict(
                                    [
                                        ("tuition", item.get("latest.cost.tuition.out_of_state")),
                                        ("living_expenses", item.get("latest.cost.living_expenses")),
                                    ]
                                ),
                            ),
                            ("number_of_student", item.get("latest.student.size")),
                            (
                                "staff_student_rate",
                                (
                                    f"1:{item.get('latest.student.demographics.student_faculty_ratio')}"
                                    if item.get("latest.student.demographics.student_faculty_ratio")
                                    else None
                                ),
                            ),
                            (
                                "gar",
                                (
                                    f"{item.get('latest.completion.rate_pooled_4yr') * 100:.1f}%"
                                    if item.get("latest.completion.rate_pooled_4yr")
                                    else None
                                ),
                            ),
                            ("climate", None),  # Parameters not in this API
                            ("courses_and_classes", f"See {url}" if url else None),
                            ("deadline_dates", None),
                            ("scholarship", None),
                            ("school_url", url),
                            ("english_proficiency_required", None),
                        ]
                    )
                    ordered_results.append(school)

                # Save page to cache
                file_path = self.cache_dir / f"page_{current_page:03d}.json"
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(ordered_results, f, indent=4)

                params["page"] += 1
                time.sleep(0.5)

            except requests.exceptions.RequestException:
                print(f"Request failed while processing page {current_page}.")
                break
            except (ValueError, KeyError, TypeError):
                print(f"Unexpected response format while processing page {current_page}.")
                break
            except Exception:
                print(f"Critical error while processing page {current_page}.")
                break


if __name__ == "__main__":
    # Replace with your actual api.data.gov key
    scraper = CollegeScorecardScraper(os.getenv("API_KEY"))
    scraper.fetch_all()

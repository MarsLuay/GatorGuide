import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent

STEPS = [
    {
        "name": "Step 1 - Fetch Data (API Client)",
        "script": PIPELINE_DIR / "api_client.py",
        "description": "Pulling school data from College Scorecard API...",
    },
    {
        "name": "Step 2 - Transform Data",
        "script": PIPELINE_DIR / "transform.py",
        "description": "Cleaning and transforming raw data...",
    },
    {
        "name": "Step 3 - Load into Database (DB Loader)",
        "script": PIPELINE_DIR / "db_loader.py",
        "description": "Loading final CSV into Django/MySQL...",
    },
]


def print_banner(text, char="=", width=60):
    print("\n" + char * width)
    print(f"  {text}")
    print(char * width)


def print_step(step, index, total):
    print(f"\n{'-' * 60}")
    print(f"  [{index}/{total}] {step['name']}")
    print(f"  {step['description']}")
    print(f"{'-' * 60}")


def run_step(step, index, total):
    print_step(step, index, total)

    script_path = step["script"]

    if not script_path.exists():
        print(f"Script not found: {script_path}")
        print("Make sure all pipeline scripts are in the DataScrape folder.")
        return False

    start_time = time.time()

    try:
        subprocess.run(
            [sys.executable, str(script_path)],
            check=True,
            text=True,
        )
        elapsed = time.time() - start_time
        print(f"\n{step['name']} completed in {elapsed:.1f}s")
        return True

    except subprocess.CalledProcessError as e:
        elapsed = time.time() - start_time
        print(f"\n{step['name']} failed after {elapsed:.1f}s")
        print(f"Exit code: {e.returncode}")
        print("Fix the error above before re-running the pipeline.")
        return False

    except Exception as e:
        print(f"\nUnexpected error in {step['name']}: {e}")
        return False


def run_pipeline():
    start_time = time.time()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print_banner(f"GatorGuide Data Pipeline | {now}")

    total = len(STEPS)
    completed = 0

    for i, step in enumerate(STEPS, start=1):
        success = run_step(step, i, total)

        if not success:
            print_banner(
                f"Pipeline stopped at step {i}/{total}: {step['name']}",
                char="!",
            )
            print(f"\n  Completed : {completed}/{total} steps")
            print(f"  Failed at : {step['name']}")
            print(f"  Total time: {time.time() - start_time:.1f}s")
            print("!" * 60 + "\n")
            sys.exit(1)

        completed += 1

    total_time = time.time() - start_time
    print_banner("Pipeline Complete")
    print(f"  All {total} steps finished successfully")
    print(f"  Total time: {total_time:.1f}s")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    run_pipeline()

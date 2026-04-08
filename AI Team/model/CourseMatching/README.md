# CourseMatching RLHF Workflow (GPT + Human Validation)

This folder now supports a practical RLHF pipeline for transfer course matching:

1. Generate GPT-based course match suggestions.
2. Review/approve/edit results in a human validation GUI.
3. Convert validated feedback into fine-tuning JSONL.
4. Launch a fine-tuning job for a GPT model.

## Files
- `gpt_matcher.py`: GPT matching engine with heuristic shortlist and fallback.
- `demo.py`: Runs matching on sample school data and writes predictions.
- `validation_app.py`: Streamlit reviewer UI for advisor validation.
- `prepare_finetune_data.py`: Builds OpenAI fine-tuning JSONL from validated feedback.
- `run_finetune.py`: Uploads JSONL and starts fine-tuning job.
- `match_predictions.json`: Generated predictions for review.
- `human_feedback.jsonl`: Reviewer decisions (append-only).
- `finetune_train.jsonl`: Training dataset generated from approvals/edits.

## Setup
From `GatorGuideV2/AI/CourseMatching`:

```bash
pip install -r requirements.txt
```

Set your API key in `.env` or shell:

```bash
export OPENAI_API_KEY=your_key_here

# Optional: use a fine-tuned model ID after training
export COURSE_MATCH_MODEL=ft:gpt-4.1-mini:your-org:course-matching:job_or_model_id
```

## Step 1: Generate Matches
```bash
python demo.py
```

Outputs:
- `school_data.json`
- `match_predictions.json`

If `OPENAI_API_KEY` is missing, the matcher uses a heuristic fallback, so you can still test the review flow.

## Step 2: Human Validation GUI
```bash
streamlit run validation_app.py
```

In the UI, each prediction can be:
- `approve`: keep predicted target
- `reject`: drop the example
- `edit`: provide corrected target code/name

Feedback is appended to `human_feedback.jsonl`.

## Step 3: Build Fine-Tuning Dataset
```bash
python prepare_finetune_data.py
```

This creates `finetune_train.jsonl` with chat-format training examples.

## Step 4: Launch Fine-Tuning Job
```bash
python run_finetune.py --base-model gpt-4o-mini-2024-07-18 --suffix course-matching
```

The script uploads the training file and creates an OpenAI fine-tuning job.

## RLHF Mapping
- Human preference collection: `validation_app.py` + `human_feedback.jsonl`
- Reward/proxy signal: accepted/edited labels in feedback data
- Policy improvement: fine-tuning GPT on reviewed examples
- Iteration: rerun prediction -> review -> fine-tune as new feedback arrives

## Important Notes
- Keep this as advisor-in-the-loop; do not auto-approve transfer equivalency.
- Maintain a held-out validation set before deploying a fine-tuned model in production.

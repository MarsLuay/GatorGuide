# Model

This folder contains the AI and retrieval experiments for GatorGuide.

## Main Areas

- `src/rag_vector/` - document ingestion, chunking, embeddings, retrieval, and vector database adapters
- `src/essay_chain/` - multi-stage essay generation pipeline
- `CourseMatching/` - course-matching prototype, evaluation, and finetuning utilities
- `data/` - local sample inputs and raw reference material

## Docs

- [Essay RAG system](AI.md)
- [Course matching prototype](CourseMatching/README.md)

## Setup

```bash
cd Model
python3 -m venv venv
source venv/bin/activate
python3 -m pip install -r requirements.txt
```

## Example Commands

Run ingestion:

```bash
PYTHONPATH=src python3 -m rag_vector.ingest
```

Run the essay chain:

```bash
PYTHONPATH=src python3 -m essay_chain.run_chain --user-id 000991 --query "Describe your motivation for healthcare AI" --k 3
```

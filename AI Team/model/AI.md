# Essay RAG System (Vector DB + Full Essay Chain)

This project runs the full flow:

Prompt -> Retrieve Context -> Generate Outline -> Style Pass -> Emotional Pass -> Critique -> Refine

Implemented:

- Document ingestion from local files
- PDF ingestion support (.pdf)
- Direct user text ingestion into vector DB
- User-scoped retrieval via user_id
- Text chunking with overlap
- Embedding generation
- Persistent vector database storage (Chroma or Supabase Postgres)
- Semantic retrieval by query
- Multi-stage GPT essay generation chain

## Agent-Style Flow (Based on Agent.md Graph)

```mermaid
graph TD
	A[User Query] --> B[Embed Query]
	B --> C{Vector DB Backend}
	C -->|Chroma| D[Query Chroma Collection]
	C -->|Supabase Postgres| E[Query rag_chunks by user_id]
	D --> F[Top-K Retrieved Chunks]
	E --> F
	F --> G[Build Grounded Context]
	G --> H[LLM Stage 1: Generate Outline]
	H --> I[LLM Stage 2: Style Transform]
	I --> J[LLM Stage 3: Emotional Pass]
	J --> K[LLM Stage 4: Critique]
	K --> L[LLM Stage 5: Refine]
	L --> M[Save Outputs JSON + Markdown + Logs]
	M --> N[Return Final Essay]
```

### Data Preparation Sub-Flow

```mermaid
graph TD
	A[Source Input]
	A -->|txt / md / pdf| B[Loader]
	A -->|user text| C[Direct Input]
	B --> D[Chunking]
	C --> D
	D --> E[Embeddings]
	E --> F[Upsert with Metadata]
	F --> G[(Vector DB)]
```

Metadata saved per chunk:

- user_id
- source
- source_type (pdf, text, user_input)
- index
- collection_name

## Project Layout

- requirements.txt: Python dependencies
- src/rag_vector/config.py: environment and backend settings
- src/rag_vector/chunking.py: chunking logic
- src/rag_vector/embeddings.py: embedding provider wrappers
- src/rag_vector/vectordb.py: vector DB adapters (Chroma and Postgres)
- src/rag_vector/ingest.py: ingestion CLI
- src/rag_vector/retrieve.py: retrieval CLI
- src/essay_chain/llm.py: GPT wrapper
- src/essay_chain/stages.py: generation stages
- src/essay_chain/pipeline.py: orchestration and artifact saving
- src/essay_chain/run_chain.py: full chain CLI entrypoint

## Environment Variables

Common:

- RAG_DATA_DIR (default: data/raw)
- RAG_COLLECTION (default: essay_knowledge)
- RAG_PUBLIC_USER_ID (default: public)
- RAG_EMBED_PROVIDER (sentence_transformers or openai)
- RAG_EMBED_MODEL (default: all-MiniLM-L6-v2)
- OPENAI_API_KEY (required for essay chain and openai embeddings)
- RAG_LLM_MODEL (default: gpt-4o-mini)

Backend switch:

- RAG_DB_BACKEND (chroma or postgres)

Chroma backend:

- RAG_DB_DIR (default: data/vector_db)

Supabase Postgres backend:

- RAG_PG_TABLE (default: rag_chunks)
- RAG_PG_SSLMODE (default: require)
- SUPABASE_DB_URL (preferred)
- SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD (fallback)

## How To Run The Whole Code

Run from project folder:

```bash
cd /Users/ben/Github-project/GatorGuide/GatorGuideV2/AI
```

### 1) Setup Environment

```bash
python3 -m venv venv
source venv/bin/activate
python3 -m pip install -r requirements.txt
```

### 2) Create .env

Example (.env) for Supabase:

```bash
RAG_DB_BACKEND=postgres
RAG_COLLECTION=essay_knowledge
RAG_PG_TABLE=rag_chunks
SUPABASE_DB_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
RAG_PG_SSLMODE=require

RAG_EMBED_PROVIDER=sentence_transformers
RAG_EMBED_MODEL=all-MiniLM-L6-v2

OPENAI_API_KEY=YOUR_OPENAI_API_KEY
RAG_LLM_MODEL=gpt-4o-mini
```

### 3) Ingest Knowledge

Shared corpus from data/raw (public scope):

```bash
PYTHONPATH=src python3 -m rag_vector.ingest
```

Direct user text:

```bash
PYTHONPATH=src python3 -m rag_vector.ingest --user-id 000991 --source profile --user-text "I like AI for healthcare and led a campus clinic project."
```

User PDF:

```bash
PYTHONPATH=src python3 -m rag_vector.ingest --user-id 000991 --user-text-file ./data/raw/profile.pdf
```

### 4) Test Retrieval

```bash
PYTHONPATH=src python3 -m rag_vector.retrieve --user-id 000991 --query "What are this student's interests and leadership experience?" --k 3
```

### 5) Run Full Essay Chain

```bash
PYTHONPATH=src python3 -m essay_chain.run_chain --user-id 000991 --query "Describe your motivation for healthcare AI" --k 3
```

Outputs are saved under:

- outputs/run_YYYYMMDD_HHMMSS/pipeline_output.json
- outputs/run_YYYYMMDD_HHMMSS/pipeline_output.md
- outputs/run_YYYYMMDD_HHMMSS/pipeline.log

## Troubleshooting

- If command works once then fails with missing modules, use the same interpreter each time:

```bash
./venv/bin/python -m pip install -r requirements.txt
PYTHONPATH=src ./venv/bin/python -m rag_vector.retrieve --user-id 000991 --query "test" --k 1
```

- If Postgres retrieval says vector type missing, enable extension and convert embedding column to vector(384) in Supabase.

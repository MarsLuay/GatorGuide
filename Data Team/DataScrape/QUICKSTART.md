# Quick Start Guide

## 🚀 Getting Started with the College Scorecard Data Pipeline

### Prerequisites Verification
- ✅ Python 3.11.14 installed and configured
- ✅ UV package manager installed
- ✅ MySQL 9.5.0 running locally
- ✅ MySQL credentials configured in `.env`
- ✅ API key configured in `.env`

### Step 1: Activate Virtual Environment

```bash
# Fish shell
source .venv/bin/activate.fish

# Bash/Zsh
source .venv/bin/activate
```

### Step 2: Create Database & Schema

Run this once to set up tables:

```bash
python main.py --create-schema
```

You should see:
```
🏛️  Inserting states...
✅ Inserted 51 states
✅ Schema loaded successfully!
```

### Step 3: Fetch API Data

Download ~5,465 institutions from the API (~2-3 minutes):

```bash
python main.py --fetch-only
```

This caches raw JSON to `./data_cache/` (safe to run multiple times).

Expected output:
```
🚀 Starting institution data fetch...
📊 Total institutions available: 5465
📄 Fetching page 1...
   ✓ Cached 100 records (Total: 100/5465 - 1.8%)
...
✨ All 5465 institutions fetched and cached successfully!
```

### Step 4: Transform Data

Normalize JSON to SQL-ready records (~2-5 minutes):

```bash
python main.py --transform-only
```

Creates CSV exports in `./data_output/` for inspection.

Expected output:
```
🔄 Starting data transformation...
📄 Transforming page 1 (100 institutions)...
✅ Transformation complete!
   📊 Institutions: 5465
   👥 Demographic records: 49,000+
   🎓 Field of Study programs: 89,000+
```

### Step 5: Load into MySQL

Insert transformed records into database (~5 minutes):

```bash
python main.py --load-only
```

Expected output:
```
🗂️  Starting database load...
🏛️  Inserting states...
📥 Inserting 5465 records into institution...
   ✓ Inserted 5465/5465 (100.0%)
✅ Successfully inserted 5465 records into institution
...
📊 DATABASE LOAD SUMMARY
✅ Institutions loaded:         5,465
✅ Demographic records loaded:  49,635
✅ Enrollment metrics loaded:   4,892
...
📈 TOTAL RECORDS LOADED:        234,560
```

### Run Everything at Once

Or skip the individual steps and run the full pipeline:

```bash
python main.py --full-pipeline
```

Takes ~10-15 minutes total.

### Validate Your Data

Check that everything loaded correctly:

```bash
python main.py --validate
```

Expected output:
```
🔍 Running validation checks...
   ✓ Institutions: 5,465
   ✓ States represented: 50
   ✓ Enrollment metrics: 4,892
   ✓ Referential integrity: OK
✅ Validation complete!
```

## 📊 Query Examples in MySQL Workbench

Once data is loaded, try these queries:

### Top 10 Institutions by Enrollment

```sql
SELECT 
    i.name,
    i.city,
    s.state_code,
    em.total_enrollment
FROM institution i
JOIN state s ON i.state_id = s.id
JOIN enrollment_metrics em ON i.id = em.institution_id
WHERE em.total_enrollment IS NOT NULL
ORDER BY em.total_enrollment DESC
LIMIT 10;
```

### Average Admission Rate by State

```sql
SELECT 
    s.state_name,
    COUNT(DISTINCT i.id) as institution_count,
    ROUND(AVG(adm.admission_rate) * 100, 2) as avg_admission_rate
FROM institution i
JOIN state s ON i.state_id = s.id
JOIN admission_metrics adm ON i.id = adm.institution_id
WHERE adm.admission_rate IS NOT NULL
GROUP BY s.state_name
ORDER BY avg_admission_rate ASC;
```

### Field of Study Earnings Ranking

```sql
SELECT 
    i.name,
    f.cip_description,
    cl.credential_name,
    fse.median_earnings_5yr
FROM institution i
JOIN institution_field_of_study ifs ON i.id = ifs.institution_id
JOIN field_of_study f ON ifs.field_of_study_id = f.id
JOIN credential_level cl ON f.credential_level_id = cl.id
JOIN field_of_study_earnings fse ON ifs.id = fse.institution_field_of_study_id
WHERE fse.median_earnings_5yr IS NOT NULL
ORDER BY fse.median_earnings_5yr DESC
LIMIT 20;
```

## 🛠️ Useful Commands

### View cached API data (first 100 institutions):

```bash
head -n 50 data_cache/page_00000.json | python -m json.tool
```

### Check transformed CSV data:

```bash
head -n 5 data_output/institutions.csv
```

### Clean and restart:

```bash
rm -rf data_cache data_output
python main.py --full-pipeline
```

### Monitor database size:

```sql
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'collegescorecard'
ORDER BY size_mb DESC;
```

## 🐛 Troubleshooting

**Error: "Unknown database 'collegescorecard'"**
- Run: `python main.py --create-schema`

**Error: "API request timeout"**
- Internet connection may be slow; script will retry automatically
- Check API key in `.env`

**Error: "Foreign key constraint violation"**
- Ensure you ran `--create-schema` first
- Check that state IDs are being populated

**Error: "Too many connections"**
- Close other MySQL connections or increase max_connections

## 📚 File Reference

- `main.py` - Entry point with CLI interface
- `api_client.py` - College Scorecard API communication
- `transform.py` - JSON normalization & transformation
- `db_loader.py` - MySQL operations
- `schema.sql` - Database schema (review in Workbench)
- `.env` - Configuration (DO NOT COMMIT)
- `data_cache/` - Cached JSON responses from API
- `data_output/` - CSV exports for inspection

## 📖 Full Documentation

See `README.md` for:
- Complete schema documentation
- All available data fields
- Performance benchmarks
- Advanced customization

## ✅ Checklist

- [ ] Virtual environment activated
- [ ] `.env` configured with API key and MySQL credentials
- [ ] MySQL server running
- [ ] Schema created: `python main.py --create-schema`
- [ ] Data fetched: `python main.py --fetch-only`
- [ ] Data transformed: `python main.py --transform-only`
- [ ] Data loaded: `python main.py --load-only`
- [ ] Data validated: `python main.py --validate`
- [ ] Queried in MySQL Workbench
- [ ] Ready to analyze!

---

**Questions?** Check the detailed docs in `README.md` or review the inline comments in Python files.

Happy analyzing! 🎓📊

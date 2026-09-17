# IP-SAKTI Sahayak — Backend

Python/FastAPI backend for the IP-SAKTI Sahayak SIH26045 project.

**See the root `README.md` (one level up) for the full write-up** —
architecture, API table, environment variables, setup instructions,
demo mode, known limitations, and verification results.

Quick start:
```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Swagger docs: http://localhost:8000/docs
Tests: `python -m pytest tests/ -v`

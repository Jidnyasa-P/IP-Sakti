# IP-SAKTI Sahayak — single-container production image.
#
# Stage 1 builds the Vite/React frontend to static assets.
# Stage 2 runs the FastAPI backend, which serves those static assets
# directly (see backend/app/main.py) alongside the /api routes — so the
# whole app is reachable on ONE port (8000), no nginx/proxy needed.
#
# Build:  docker build -t ip-sakti .
# Run:    docker run -p 8000:8000 ip-sakti
# Open:   http://localhost:8000

# ---- Stage 1: frontend build ----
FROM node:20-alpine AS frontend-builder
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm install
COPY frontend/. ./
RUN npm run build

# ---- Stage 2: backend + built frontend ----
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/. .
COPY --from=frontend-builder /fe/dist /frontend/dist

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

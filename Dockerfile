FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./

RUN npm ci

COPY frontend .

ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_TENANT_ID
ARG VITE_AZURE_AUTHORITY
ARG VITE_REDIRECT_URI
ARG VITE_API_BASE_URL

ENV VITE_AZURE_CLIENT_ID=${VITE_AZURE_CLIENT_ID} \
    VITE_AZURE_TENANT_ID=${VITE_AZURE_TENANT_ID} \
    VITE_AZURE_AUTHORITY=${VITE_AZURE_AUTHORITY} \
    VITE_REDIRECT_URI=${VITE_REDIRECT_URI} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt


COPY backend/ ./

COPY --from=frontend-build /frontend/dist ./static/frontend

ENV PORT=8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "300", "app:app"]

#!/usr/bin/env python3
"""
Verify job infographic download against Firestore + SharePoint.

Usage (from repo root):
  cd backend && python scripts/verify_infographic_download.py
  cd backend && python scripts/verify_infographic_download.py <job_id>
"""

from __future__ import annotations

import os
import sys

# backend/ on path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

import firebase_admin
from firebase_admin import credentials

from services.firestore_service import FirestoreService
from services.sharepoint_service import SharePointService
from services.job_infographic_service import JobInfographicService


def init_firebase() -> None:
    try:
        firebase_admin.get_app()
    except ValueError:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(
            cred, {"projectId": os.getenv("FIREBASE_PROJECT_ID", "cendien-sales-support-ai")}
        )


def azure_config() -> dict:
    return {
        "client_id": os.getenv("AZURE_CLIENT_ID"),
        "client_secret": os.getenv("AZURE_CLIENT_SECRET"),
        "tenant_id": os.getenv("AZURE_TENANT_ID"),
        "authority": os.getenv("AZURE_AUTHORITY"),
        "scope": ["User.Read"],
    }


def png_magic(data: bytes) -> bool:
    return len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n"


def jpeg_magic(data: bytes) -> bool:
    return len(data) >= 2 and data[:2] == b"\xff\xd8"


def is_image(data: bytes) -> bool:
    return png_magic(data) or jpeg_magic(data)


def summarize_record(label: str, record: dict | None) -> str:
    if not record:
        return f"{label}: (none)"
    keys = ("file_id", "site_id", "drive_id", "sharepoint_web_url", "download_url", "generated_at")
    parts = [f"{k}={'yes' if record.get(k) else 'no'}" for k in keys]
    return f"{label}: " + ", ".join(parts)


def test_job(job: dict, service: JobInfographicService) -> bool:
    job_id = job.get("id", "?")
    title = (job.get("title") or "")[:60]
    print(f"\n--- Job {job_id}: {title} ---")
    info = job.get("infographic")
    if not info:
        print("  SKIP: no infographic on job")
        return True

    print("  ", summarize_record("latest", info))

    ok = True
    data = service.get_image_bytes(job)
    if data and is_image(data):
        print(f"  PASS latest download: {len(data)} bytes, valid image header")
    else:
        print(f"  FAIL latest download: got {len(data) if data else 0} bytes")
        ok = False

    versions = job.get("infographic_versions") or []
    if len(versions) > 1:
        oldest = versions[-1]
        fid = oldest.get("file_id")
        print("  ", summarize_record("oldest version", oldest))
        if fid:
            vdata = service.get_image_bytes(job, file_id=fid)
            if vdata and is_image(vdata):
                print(f"  PASS oldest version download: {len(vdata)} bytes")
            else:
                print(f"  FAIL oldest version (file_id={fid[:20]}...): no image bytes")
                ok = False

    return ok


def main() -> int:
    cfg = azure_config()
    missing = [k for k in ("client_id", "client_secret", "tenant_id") if not cfg.get(k)]
    if missing:
        print("ERROR: Missing Azure env vars:", ", ".join(missing))
        return 2

    init_firebase()
    firestore = FirestoreService(cache_ttl_seconds=0)
    sharepoint = SharePointService(cfg)
    service = JobInfographicService(sharepoint)

    if len(sys.argv) > 1:
        job_id = sys.argv[1].strip()
        job = firestore.get_job(job_id)
        if not job:
            print(f"ERROR: Job not found: {job_id}")
            return 1
        jobs = [job]
    else:
        all_jobs = firestore.get_all_jobs()
        jobs = [j for j in all_jobs if j.get("infographic")]
        jobs.sort(
            key=lambda j: j.get("infographic", {}).get("generated_at") or "",
            reverse=True,
        )
        if not jobs:
            print("No jobs with infographic metadata in Firestore.")
            return 1
        jobs = jobs[:3]
        print(f"Testing {len(jobs)} most recent job(s) with posters...")

    passed = sum(1 for j in jobs if test_job(j, service))
    failed = len(jobs) - passed
    print(f"\n=== Result: {passed}/{len(jobs)} job(s) passed ===")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

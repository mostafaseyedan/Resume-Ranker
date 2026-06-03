"""
Generate hiring infographics from job records and save to SharePoint.
"""

import asyncio
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, Optional

from .gemini_image_service import GeminiImageService, create_gemini_image_service
from .sharepoint_service import SharePointService

logger = logging.getLogger(__name__)

# Slug -> compact style hint (UI sends the slug).
THEME_VARIANTS: Dict[str, str] = {
    "corporate-modular": "structured corporate layout with modular content blocks",
    "soft-3d-glossy": "soft 3D glossy objects with depth and studio lighting",
    "photo-overlay": "photographic background treatment with text layered over imagery",
    "editorial-magazine": "editorial magazine spread with bold typography and asymmetry",
    "isometric": "isometric illustration with dimensional objects and angled perspective",
}

HIRING_POSTER_SYSTEM_INSTRUCTION = (
    "You are an expert at designing hiring infographics from job descriptions. "
    "Prioritize the role title, key skills, work mode/location, duration, and call-to-action. "
    "Keep image text sparse: headline, short labels, and brief bullets only; no dense paragraphs. "
    "Use any provided logo only as a small brand mark, not as the poster's color or layout reference. "
    "Do not render prompt instructions or any text inside do_not_render metadata."
)


def normalize_visual_theme(slug: Optional[str]) -> Optional[str]:
    if not slug or not str(slug).strip():
        return None
    key = str(slug).strip().lower()
    if key not in THEME_VARIANTS:
        valid = ", ".join(THEME_VARIANTS)
        raise ValueError(f"Unknown visual theme '{slug}'. Valid themes: {valid}")
    return key


def compose_poster_user_prompt(body: str, visual_theme: Optional[str]) -> str:
    """Theme hint first so it is not drowned out by a long job description."""
    lines: list[str] = []
    key = normalize_visual_theme(visual_theme)
    if key:
        lines.append(f"<STYLE_HINT do_not_render=\"true\">{THEME_VARIANTS[key]}</STYLE_HINT>")
    lines.append(body.strip())
    return "\n\n".join(lines)

LOGO_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "static",
    "cendien_corp_logo.jpg",
)
INFOGRAPHIC_SHAREPOINT_SUBFOLDER = "Hiring Infographics"

ALLOWED_ASPECT_RATIOS = {
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
}
ALLOWED_IMAGE_QUALITIES = {"1K", "2K", "4K"}


class JobInfographicService:
    def __init__(
        self,
        sharepoint_service: SharePointService,
        image_service: Optional[GeminiImageService] = None,
    ):
        self.sharepoint = sharepoint_service
        self.image_service = image_service

    def _get_image_service(self) -> GeminiImageService:
        if self.image_service is None:
            self.image_service = create_gemini_image_service()
        return self.image_service

    @staticmethod
    def _safe_filename(title: str) -> str:
        slug = re.sub(r"[^\w\-]+", "_", (title or "job").strip())[:60].strip("_")
        return slug or "job"

    @staticmethod
    def _version_label() -> str:
        return datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    @staticmethod
    def _build_image_request(job: Dict[str, Any]) -> str:
        title = (job.get("title") or "Open Position").strip()
        description = (job.get("description") or "").strip()
        return (
            f"NOW HIRING — {title}\n\n"
            f"<JOB_DESCRIPTION source_text=\"true\">\n{description[:12000]}\n</JOB_DESCRIPTION>"
        )

    @staticmethod
    def _load_logo_bytes() -> bytes:
        if not os.path.isfile(LOGO_FILE_PATH):
            raise ValueError(
                "Cendien logo is required for poster generation but was not found at "
                f"{LOGO_FILE_PATH}"
            )
        try:
            with open(LOGO_FILE_PATH, "rb") as f:
                data = f.read()
        except OSError as e:
            raise ValueError(f"Could not read Cendien logo at {LOGO_FILE_PATH}: {e}") from e
        if not data:
            raise ValueError(f"Cendien logo at {LOGO_FILE_PATH} is empty")
        return data

    async def generate_for_job(
        self,
        job: Dict[str, Any],
        *,
        visual_theme: Optional[str] = None,
        aspect_ratio: Optional[str] = None,
        image_quality: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        description = (job.get("description") or "").strip()
        if not description:
            raise ValueError("Job description is required to generate an infographic")

        resolved_aspect_ratio = (aspect_ratio or "3:4").strip()
        if resolved_aspect_ratio not in ALLOWED_ASPECT_RATIOS:
            raise ValueError("Unsupported infographic aspect ratio")

        resolved_image_quality = (image_quality or "2K").strip().upper()
        if resolved_image_quality not in ALLOWED_IMAGE_QUALITIES:
            raise ValueError("Unsupported infographic quality")

        resolved_theme = normalize_visual_theme(visual_theme or "corporate-modular")

        logo_bytes = JobInfographicService._load_logo_bytes()
        image_service = self._get_image_service()
        logger.info(
            "Job infographic: model=%s theme=%s aspect=%s quality=%s",
            image_service.model_default,
            resolved_theme,
            resolved_aspect_ratio,
            resolved_image_quality,
        )

        result = await image_service.generate_image(
            user_prompt=compose_poster_user_prompt(
                self._build_image_request(job),
                resolved_theme,
            ),
            system_instruction=HIRING_POSTER_SYSTEM_INSTRUCTION,
            aspect_ratio=resolved_aspect_ratio,
            image_size=resolved_image_quality,
            input_image_bytes=logo_bytes,
            input_image_mime="image/jpeg",
        )

        if not result.get("success"):
            raise RuntimeError(result.get("error") or "Image generation failed")

        image_bytes = result["image_data"]
        mime_type = result.get("mime_type") or "image/png"
        ext = "png" if "png" in mime_type else "jpg"
        version_label = self._version_label()
        ratio_label = resolved_aspect_ratio.replace(":", "x")
        filename = (
            f"hiring_infographic_{self._safe_filename(job.get('title', ''))}_"
            f"{ratio_label}_{version_label}.{ext}"
        )

        sharepoint_link = (job.get("monday_metadata") or {}).get("sharepoint_link")
        upload_meta: Optional[Dict[str, Any]] = None
        download_url: Optional[str] = None
        file_id: Optional[str] = None
        site_id: Optional[str] = None
        drive_id: Optional[str] = None

        if sharepoint_link:
            upload_meta = await asyncio.to_thread(
                self.sharepoint.upload_file_to_folder,
                sharepoint_link,
                image_bytes,
                filename,
                job.get("title"),
                INFOGRAPHIC_SHAREPOINT_SUBFOLDER,
            )
            if upload_meta and upload_meta.get("web_url"):
                file_id = upload_meta.get("id")
                site_id = upload_meta.get("site_id")
                drive_id = upload_meta.get("drive_id")
                if file_id and site_id and drive_id:
                    download_url = await asyncio.to_thread(
                        self.sharepoint.get_item_download_url,
                        file_id,
                        site_id,
                        drive_id,
                    )
                if not download_url:
                    fresh = await asyncio.to_thread(
                        self.sharepoint.convert_web_url_to_download_url,
                        upload_meta["web_url"],
                    )
                    if fresh:
                        download_url = fresh.get("download_url")
                        file_id = file_id or fresh.get("file_id")
                        site_id = site_id or fresh.get("site_id")
                        drive_id = drive_id or fresh.get("drive_id")
            else:
                logger.warning("Infographic generated but SharePoint upload failed")
        else:
            logger.warning("Job has no SharePoint link; infographic metadata will not include SharePoint URL")

        infographic_record = {
            "filename": filename,
            "version": version_label,
            "visual_theme": resolved_theme,
            "aspect_ratio": resolved_aspect_ratio,
            "image_quality": resolved_image_quality,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "generated_by": user_email,
            "sharepoint_web_url": (upload_meta or {}).get("web_url"),
            "download_url": download_url,
            "file_id": file_id,
            "site_id": site_id,
            "drive_id": drive_id,
            "mime_type": mime_type,
            "model": result.get("model"),
            "saved_to_sharepoint": bool((upload_meta or {}).get("web_url")),
        }

        return {
            "infographic": infographic_record,
            "image_bytes": image_bytes,
            "mime_type": mime_type,
        }

    @staticmethod
    def select_record(
        job: Dict[str, Any], file_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Resolve which infographic record to serve.

        With no file_id, returns the latest (``job['infographic']``). With a
        file_id, searches the latest plus ``infographic_versions`` and returns
        the matching record, or None if no stored version has that file_id.
        """
        latest = job.get("infographic") or None
        if not file_id:
            return latest
        candidates = ([latest] if latest else []) + (job.get("infographic_versions") or [])
        for record in candidates:
            if record and record.get("file_id") == file_id:
                return record
        return None

    def delete_version(self, job: Dict[str, Any], file_id: str) -> Dict[str, Any]:
        """Delete one infographic version from SharePoint and compute the updated records.

        Returns the new ``infographic`` (next-newest version, or None) and
        ``infographic_versions`` for the caller to persist, plus the deleted record
        and whether the SharePoint file was removed.
        """
        record = self.select_record(job, file_id)
        if not record:
            raise ValueError("Infographic version not found")

        sharepoint_deleted = False
        if record.get("file_id") and record.get("site_id") and record.get("drive_id"):
            sharepoint_deleted = self.sharepoint.delete_file(
                record["file_id"], record["site_id"], record["drive_id"]
            )
            if not sharepoint_deleted:
                logger.warning(
                    "Could not delete infographic from SharePoint: %s", record.get("filename")
                )

        versions = [
            v for v in (job.get("infographic_versions") or []) if v.get("file_id") != file_id
        ]
        latest = job.get("infographic")
        if latest and latest.get("file_id") == file_id:
            latest = versions[0] if versions else None

        return {
            "infographic": latest,
            "infographic_versions": versions,
            "deleted": record,
            "sharepoint_deleted": sharepoint_deleted,
        }

    def get_image_bytes(
        self, job: Dict[str, Any], *, file_id: Optional[str] = None
    ) -> Optional[bytes]:
        info = self.select_record(job, file_id)
        if not info:
            return None

        item_file_id = info.get("file_id")
        site_id = info.get("site_id")
        drive_id = info.get("drive_id")
        web_url = info.get("sharepoint_web_url")

        if web_url and (not item_file_id or not site_id or not drive_id):
            fresh = self.sharepoint.convert_web_url_to_download_url(web_url)
            if fresh:
                item_file_id = item_file_id or fresh.get("file_id")
                site_id = site_id or fresh.get("site_id")
                drive_id = drive_id or fresh.get("drive_id")

        if item_file_id and site_id and drive_id:
            content = self.sharepoint.download_file(item_file_id, site_id, drive_id)
            if content is not None:
                return content

        download_url = info.get("download_url")
        if not download_url and web_url:
            fresh = self.sharepoint.convert_web_url_to_download_url(web_url)
            if fresh:
                download_url = fresh.get("download_url")
                item_file_id = item_file_id or fresh.get("file_id")
                site_id = site_id or fresh.get("site_id")
                drive_id = drive_id or fresh.get("drive_id")

        if not download_url and not (item_file_id and site_id and drive_id):
            return None

        return self.sharepoint.get_file_content_as_binary(
            download_url or "",
            file_id=item_file_id,
            site_id=site_id,
            drive_id=drive_id,
        )

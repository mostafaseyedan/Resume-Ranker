"""
Badge Service - Generates certification and achievement badges for resumes

Two types of badges:
1. Certification Badges - For actual certifications (AWS, Azure, etc.)
   Flow: Known mapping -> Web search -> Gemini image generation
2. Custom Achievement Badges - Derived from skills/experience analysis
   Flow: LLM analysis -> Gemini image generation only
"""

import os
import asyncio
import tempfile
import logging
from typing import Dict, Any, Optional, List, Tuple
from io import BytesIO

from google import genai
from google.genai import types
from PIL import Image

from .resume_models import ResumeModel

logger = logging.getLogger(__name__)


# Known certification badge URLs (official or high-quality sources)
KNOWN_CERTIFICATION_BADGES = {
    # AWS Certifications
    "aws certified solutions architect": "https://images.credly.com/size/340x340/images/0e284c3f-5164-4b21-8660-0d84737941bc/image.png",
    "aws certified developer": "https://images.credly.com/size/340x340/images/b9feab85-1a43-4f6d-99a5-7c1a640586af/image.png",
    "aws certified cloud practitioner": "https://images.credly.com/size/340x340/images/00634f82-b07f-4bbd-a6bb-53de397fc3a6/image.png",
    "aws certified sysops administrator": "https://images.credly.com/size/340x340/images/f0d3fbb9-bfa7-4017-9989-7bde8eaf42b1/image.png",
    "aws certified devops engineer": "https://images.credly.com/size/340x340/images/bd31ef42-d460-493e-8503-39592aaf0458/image.png",
    "aws certified data analytics": "https://images.credly.com/size/340x340/images/5bf37709-4b69-4f8c-b1e2-5972d39d4df3/image.png",
    "aws certified machine learning": "https://images.credly.com/size/340x340/images/778bde6c-ad1c-4312-ac33-2fa40d50571d/image.png",
    "aws certified database": "https://images.credly.com/size/340x340/images/885d38e4-55c0-4c35-b4ed-694e2b26be6c/image.png",
    "aws certified security": "https://images.credly.com/size/340x340/images/53acdae5-d69f-4dda-b650-d02ed7a50dd7/image.png",
    # Azure Certifications
    "microsoft certified: azure fundamentals": "https://images.credly.com/size/340x340/images/be8fcaeb-c769-4858-b567-ffaaa73ce231/image.png",
    "microsoft certified: azure administrator": "https://images.credly.com/size/340x340/images/336eebfc-0ac3-4553-9a67-b402f491f185/image.png",
    "microsoft certified: azure developer": "https://images.credly.com/size/340x340/images/63316b60-f62d-4e51-aacc-c23cb850089c/image.png",
    "microsoft certified: azure solutions architect": "https://images.credly.com/size/340x340/images/987adb7e-49be-4e24-b67e-55986bd3fe66/image.png",
    "azure solutions architect": "https://images.credly.com/size/340x340/images/987adb7e-49be-4e24-b67e-55986bd3fe66/image.png",
    "microsoft certified: azure data fundamentals": "https://images.credly.com/size/340x340/images/70eb1e3f-d4de-4377-a062-b20fb29594ea/image.png",
    "microsoft certified: azure ai fundamentals": "https://images.credly.com/size/340x340/images/4136ced8-75d5-4afb-8677-40b6236e2672/image.png",
    # Google Cloud
    "google cloud certified professional cloud architect": "https://images.credly.com/size/340x340/images/71c579e0-51fd-4247-b493-d2fa8167157a/image.png",
    "google cloud certified associate cloud engineer": "https://images.credly.com/size/340x340/images/08096465-cbfc-4c3e-93e5-93c5aa61f23e/image.png",
    # Kubernetes
    "certified kubernetes administrator": "https://images.credly.com/size/340x340/images/8b8ed108-e77d-4396-ac59-2504583b9d54/image.png",
    "certified kubernetes application developer": "https://images.credly.com/size/340x340/images/f88d800c-5261-45c6-9515-0c842b1e4e47/image.png",
    "ckad": "https://images.credly.com/size/340x340/images/f88d800c-5261-45c6-9515-0c842b1e4e47/image.png",
    "cka": "https://images.credly.com/size/340x340/images/8b8ed108-e77d-4396-ac59-2504583b9d54/image.png",
    # Scrum / Agile
    "professional scrum master": "https://images.credly.com/size/340x340/images/a2790314-008a-4c3d-9553-f5e84eb064e7/image.png",
    "psm i": "https://images.credly.com/size/340x340/images/a2790314-008a-4c3d-9553-f5e84eb064e7/image.png",
    "certified scrum master": "https://images.credly.com/size/340x340/images/5e26b881-2e83-4af5-ae18-811e1e43718d/image.png",
    "csm": "https://images.credly.com/size/340x340/images/5e26b881-2e83-4af5-ae18-811e1e43718d/image.png",
    # PMP
    "project management professional": "https://images.credly.com/size/340x340/images/260e36dc-d100-45c3-852f-9d8063fa71e6/image.png",
    "pmp": "https://images.credly.com/size/340x340/images/260e36dc-d100-45c3-852f-9d8063fa71e6/image.png",
    # CompTIA
    "comptia security+": "https://images.credly.com/size/340x340/images/74790a75-8451-400a-8536-92d792c5184a/image.png",
    "comptia network+": "https://images.credly.com/size/340x340/images/e1fc05b2-959b-45a4-8571-a1c0a7415b93/image.png",
    "comptia a+": "https://images.credly.com/size/340x340/images/63482325-a0d6-4f64-ae75-f5f33922c7d0/image.png",
    # Cisco
    "ccna": "https://images.credly.com/size/340x340/images/a31c0301-ff96-4cee-9435-0a4b40ce6e66/image.png",
    "ccnp": "https://images.credly.com/size/340x340/images/a31c0301-ff96-4cee-9435-0a4b40ce6e66/image.png",
}


BADGE_GENERATION_SYSTEM_INSTRUCTION = """You are a professional certification badge designer.
You create clean, professional certification and achievement badges that look exactly like Microsoft Azure certification badges.

AZURE BADGE STRUCTURE (follow this layout precisely):
1. CANVAS: Entire background is solid white (#FFFFFF)
2. SHIELD SHAPE: Pointed-bottom shield (like Azure badges), filled with a gradient from navy blue (#1B2A4A) at the edges to blue (#2E6AB1) in the center
3. THIN BORDER: Light silver/gray (#D0D0D0) thin outline around the entire shield
4. UPPER SECTION (inside shield, top area): A small text reading "CERTIFIED" or similar label in small white text
5. MIDDLE SECTION (inside shield, center): The MAIN TITLE TEXT in large, bold, white (#FFFFFF) sans-serif font, centered, split across 2-3 lines
6. LOWER LABEL BANNER: A prominent horizontal silver/gray (#E8E8E8) banner/ribbon that spans across the lower portion of the shield. This banner contains a category or level label (like "ASSOCIATE", "EXPERT", "SPECIALIST") in dark navy text. This banner is the KEY distinguishing feature of Azure badges.
7. OPTIONAL: Small decorative stars below the label banner

STRICT RULES:
- THE TITLE TEXT MUST BE CLEARLY READABLE - most important requirement
- NO red color anywhere
- NO photographs, NO complex illustrations, NO hexagons
- Professional and corporate look
- The badge MUST be readable even when displayed at 1 inch (2.5cm) width
"""


class BadgeService:
    """Service for generating certification and achievement badges for resumes"""

    def __init__(self, gemini_api_key: Optional[str] = None):
        """
        Initialize Badge Service

        Args:
            gemini_api_key: Google Gemini API key (falls back to env var)
        """
        self.api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required for badge generation")

        self.client = genai.Client(api_key=self.api_key)
        self.image_model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview")
        self.text_model = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
        self.badge_width_inches = 1  # Target badge width in resume
        self.badge_px = 500  # Target badge size in pixels
        self.max_custom_badges = int(os.getenv("MAX_CUSTOM_BADGES", "3"))

        logger.info("BadgeService initialized")

    async def generate_all_badges(self, resume_model: ResumeModel) -> List[Dict[str, Any]]:
        """
        Generate all badges for a resume (certification + custom achievement).

        Args:
            resume_model: The validated ResumeModel

        Returns:
            List of badge dicts with keys: title, image_path, source
        """
        badges = []

        # Step 1: Analyze resume with LLM to determine which badges to generate
        badge_plan = await self._analyze_resume_for_badges(resume_model)
        logger.info(f"Badge plan from LLM: {len(badge_plan.get('certification_badges', []))} cert badges, "
                     f"{len(badge_plan.get('custom_badges', []))} custom badges")

        # Step 2: Generate certification badges
        cert_badges = badge_plan.get("certification_badges", [])
        for cert_badge in cert_badges:
            badge = await self._get_certification_badge(cert_badge)
            if badge:
                badges.append(badge)

        # Step 3: Generate custom achievement badges
        custom_badges = badge_plan.get("custom_badges", [])[:self.max_custom_badges]
        for custom_badge in custom_badges:
            badge = await self._generate_badge_image(custom_badge["title"])
            if badge:
                badges.append({
                    "title": custom_badge["title"],
                    "image_path": badge,
                    "source": "generated"
                })

        logger.info(f"Generated {len(badges)} total badges")
        return badges

    async def _analyze_resume_for_badges(self, resume_model: ResumeModel) -> Dict[str, Any]:
        """
        Use LLM to analyze the resume and determine which badges to create.

        Returns dict with:
            - certification_badges: list of cert names to create badges for
            - custom_badges: list of custom achievement badge titles
        """
        # Build resume summary for analysis
        cert_names = [cert.name for cert in (resume_model.certifications or [])]

        skills_summary = ", ".join(
            [f"{s.category}: {s.details}" for s in (resume_model.skills or [])]
        )

        experience_summary = "\n".join([
            f"- {exp.role} at {exp.company} ({exp.start_date} to {exp.end_date or 'Present'})"
            for exp in (resume_model.experience or [])
        ])

        # Calculate total years of experience
        total_years = 0
        for exp in (resume_model.experience or []):
            if exp.start_date:
                from datetime import date
                end = exp.end_date or date.today()
                years = (end - exp.start_date).days / 365.25
                total_years += years

        prompt = f"""Analyze this resume and suggest badges to generate.

CANDIDATE: {resume_model.name}
TITLE: {resume_model.title}
TOTAL YEARS OF EXPERIENCE: {total_years:.0f} years

CERTIFICATIONS:
{chr(10).join(f"- {name}" for name in cert_names) if cert_names else "None listed"}

SKILLS:
{skills_summary}

EXPERIENCE:
{experience_summary}

INSTRUCTIONS:
1. For "certification_badges": List the certification names from the resume that should have badges.
   Only include certifications that are actually listed on the resume.

2. For "custom_badges": Suggest up to 3 custom achievement badges based on the candidate's
   skills and experience. These should be impressive-sounding professional titles like:
   - "Certified Professional Python Developer" (if 10+ years Python)
   - "Senior Cloud Architecture Specialist" (if extensive cloud experience)
   - "Full-Stack Engineering Expert" (if strong full-stack background)
   - "Enterprise Data Solutions Architect" (if strong data/DB experience)

   Make them specific to THIS candidate's actual skills and experience level.
   They should sound professional and credible, similar to real certification titles.

Return a JSON object with this exact structure:
{{
    "certification_badges": [
        "exact certification name from resume"
    ],
    "custom_badges": [
        {{
            "title": "Custom Badge Title",
            "reason": "Brief reason why this badge fits"
        }}
    ]
}}
"""

        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.text_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    system_instruction="You are an expert HR and talent assessment specialist. "
                                       "Analyze resumes and suggest appropriate professional badges "
                                       "and achievement titles based on skills and experience.",
                    temperature=0.3,
                )
            )

            if response.text:
                import json
                result = json.loads(response.text)
                return result
            else:
                logger.warning("Empty response from LLM for badge analysis")
                return {"certification_badges": cert_names, "custom_badges": []}

        except Exception as e:
            logger.error(f"Error analyzing resume for badges: {e}")
            # Fallback: use all certifications, no custom badges
            return {"certification_badges": cert_names, "custom_badges": []}

    async def _get_certification_badge(self, cert_name: str) -> Optional[Dict[str, Any]]:
        """
        Get a certification badge using the priority flow:
        1. Known mapping
        2. Web search (via Serper)
        3. Gemini image generation

        Returns badge dict or None
        """
        # Step 1: Check known mapping
        cert_lower = cert_name.lower().strip()
        for known_key, known_url in KNOWN_CERTIFICATION_BADGES.items():
            if known_key in cert_lower or cert_lower in known_key:
                logger.info(f"Found known badge mapping for: {cert_name}")
                image_path = await self._download_badge(known_url, cert_name)
                if image_path:
                    return {
                        "title": cert_name,
                        "image_path": image_path,
                        "source": "known_mapping"
                    }

        # Step 2: Web search for badge image
        image_path = await self._search_badge_image(cert_name)
        if image_path:
            return {
                "title": cert_name,
                "image_path": image_path,
                "source": "web_search"
            }

        # Step 3: Generate with Gemini
        image_path = await self._generate_badge_image(cert_name)
        if image_path:
            return {
                "title": cert_name,
                "image_path": image_path,
                "source": "generated"
            }

        logger.warning(f"Failed to get badge for: {cert_name}")
        return None

    async def _download_badge(self, url: str, cert_name: str) -> Optional[str]:
        """Download a badge image from a URL and save to temp file"""
        try:
            import requests
            response = await asyncio.to_thread(
                requests.get, url, timeout=10
            )
            response.raise_for_status()

            image_data = response.content
            image_path = self._save_and_resize_badge(image_data, cert_name)
            return image_path

        except Exception as e:
            logger.warning(f"Failed to download badge from {url}: {e}")
            return None

    async def _search_badge_image(self, cert_name: str) -> Optional[str]:
        """Search for a certification badge image using Serper API"""
        serper_api_key = os.getenv("SERPER_API_KEY")
        if not serper_api_key:
            logger.info("SERPER_API_KEY not set, skipping web search for badge")
            return None

        try:
            import requests

            search_query = f"{cert_name} certification badge official logo png"

            response = await asyncio.to_thread(
                requests.post,
                "https://google.serper.dev/images",
                json={"q": search_query, "num": 3},
                headers={"X-API-KEY": serper_api_key, "Content-Type": "application/json"},
                timeout=10
            )
            response.raise_for_status()
            results = response.json()

            images = results.get("images", [])
            for img in images:
                img_url = img.get("imageUrl", "")
                if img_url:
                    image_path = await self._download_badge(img_url, cert_name)
                    if image_path:
                        logger.info(f"Found badge via web search for: {cert_name}")
                        return image_path

        except Exception as e:
            logger.warning(f"Web search for badge failed: {e}")

        return None

    async def _generate_badge_image(self, badge_title: str) -> Optional[str]:
        """Generate a badge image using Gemini image generation"""
        try:
            # Split title into lines for the prompt to encourage large text layout
            title_words = badge_title.split()
            if len(title_words) > 3:
                mid = len(title_words) // 2
                line1 = " ".join(title_words[:mid])
                line2 = " ".join(title_words[mid:])
                title_layout = f"Line 1: {line1}\nLine 2: {line2}"
            else:
                title_layout = badge_title

            prompt = (
                f"Create a professional Microsoft Azure-style certification badge with this title text:\n"
                f"{title_layout}\n\n"
                f"CRITICAL: Follow this EXACT layout (like a real Microsoft Azure certification badge):\n"
                f"1. White (#FFFFFF) canvas/background\n"
                f"2. Pointed-bottom SHIELD shape filled with navy blue (#1B2A4A) to blue (#2E6AB1) gradient\n"
                f"3. Thin silver/gray outline border around the shield\n"
                f"4. Small 'CERTIFIED' text at the top inside the shield in white\n"
                f"5. The MAIN TITLE TEXT in large, bold white font in the center of the shield\n"
                f"6. A PROMINENT HORIZONTAL SILVER/GRAY LABEL BANNER across the lower portion of the shield - "
                f"this is a wide rectangular ribbon/banner shape in light gray (#E8E8E8) that spans the width of the shield, "
                f"containing a category word like 'SPECIALIST' or 'EXPERT' in dark navy text\n"
                f"7. Small decorative stars below the banner text\n\n"
                f"This silver/gray horizontal label banner is THE most important visual element that makes it look like an Azure badge.\n"
                f"NO red, NO hexagons, NO photographs, NO complex illustrations.\n"
                f"Single badge, clean professional corporate look."
            )

            config = types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                temperature=1,
                system_instruction=BADGE_GENERATION_SYSTEM_INSTRUCTION,
                tools=[],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
            )

            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.image_model,
                contents=[types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt)]
                )],
                config=config,
            )

            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            image_data = part.inline_data.data
                            if image_data:
                                logger.info(f"Generated badge image for: {badge_title} ({len(image_data)} bytes)")
                                image_path = self._save_and_resize_badge(image_data, badge_title)
                                return image_path

            logger.warning(f"No image data in Gemini response for badge: {badge_title}")
            return None

        except Exception as e:
            logger.error(f"Error generating badge image for '{badge_title}': {e}")
            return None

    def _save_and_resize_badge(self, image_data: bytes, badge_title: str) -> Optional[str]:
        """Save badge image to temp file and resize"""
        try:
            img = Image.open(BytesIO(image_data))

            # Convert to RGBA for transparency support
            if img.mode != 'RGBA':
                img = img.convert('RGBA')

            # Resize maintaining aspect ratio, target width = badge_px
            aspect = img.height / img.width
            new_width = self.badge_px
            new_height = int(new_width * aspect)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Save to temp file
            suffix = ".png"
            safe_name = "".join(c if c.isalnum() else "_" for c in badge_title[:30])
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=suffix,
                prefix=f"badge_{safe_name}_"
            )
            img.save(temp_file.name, format="PNG", optimize=True)
            temp_file.close()

            logger.info(f"Saved badge to: {temp_file.name} ({new_width}x{new_height}px)")
            return temp_file.name

        except Exception as e:
            logger.error(f"Error saving/resizing badge image: {e}")
            return None

    def cleanup_badge_files(self, badges: List[Dict[str, Any]]):
        """Remove temporary badge image files after they've been embedded in the document"""
        for badge in badges:
            image_path = badge.get("image_path")
            if image_path and os.path.exists(image_path):
                try:
                    os.unlink(image_path)
                    logger.debug(f"Cleaned up badge file: {image_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up badge file {image_path}: {e}")

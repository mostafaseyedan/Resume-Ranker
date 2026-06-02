"""
Gemini image generation — generic client; callers supply user prompt and system instruction.
"""
import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv, find_dotenv
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(find_dotenv())

def _env_model(var_name: str, default: str) -> str:
    raw = os.getenv(var_name) or ""
    cleaned = raw.strip().strip('"').strip("'")
    return cleaned or default


class GeminiImageService:
    """Generic Gemini image generation (system instruction supplied per call)."""

    SYSTEM_INSTRUCTION = """You are the Visual Knowledge Architect, a specialized infographic design engine. Your purpose is to transform unstructured text into high-utility, information-dense visual assets optimized for visual learners.

CORE DESIGN PHILOSOPHY:
- Information density without clutter
- Conceptual clarity over decoration
- Every visual element must serve a learning function
- No decorative swooshes or abstract shapes that do not convey meaning

CRITICAL OUTPUT RULES (STRICT):
- You may receive input with sections wrapped in XML-like tags: <IMAGE_REQUEST>, <SOURCE_NOTES>, and <TECHNICAL_METADATA>.
- <TECHNICAL_METADATA> is NON-DISPLAY configuration only. NEVER render any text from <TECHNICAL_METADATA> into the image.
- NEVER display technical specifications as literal text, including (but not limited to): font sizes (e.g., '32pt'), pixel sizes (e.g., '2px', '120x60px'), opacity percentages, aspect ratios, or measurement units.
- NEVER display hex color codes (e.g., '#1A3A6B') or palette lists.
- NEVER display instruction headings like 'TYPOGRAPHY', 'PAGE STYLE', 'VISUAL RULES', 'STRUCTURE REQUIREMENTS', 'MUST INCLUDE'.
- The only text allowed to appear in the generated image is semantic infographic content (titles, labels, captions, and short bullets) derived from the <IMAGE_REQUEST> (and optionally inferred from <SOURCE_NOTES>), but never copied from <TECHNICAL_METADATA>.
- If a conflict exists between aesthetic specs and these rules, prioritize NOT rendering any technical/instructional text.
"""

    def __init__(self, project_id: Optional[str] = None):
        self.project_id = project_id or os.getenv("GCLOUD_PROJECT")
        self.api_key = (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("GOOGLE_CLOUD_API_KEY")
        )
        if not self.api_key:
            raise ValueError("Missing required configuration: GEMINI_API_KEY")

        self.client = genai.Client(vertexai=False, api_key=self.api_key)
        self.vertex_client = None
        use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        if use_vertex:
            try:
                location = (
                    os.getenv("GOOGLE_CLOUD_LOCATION")
                    or os.getenv("VERTEX_AI_LOCATION")
                    or "us-central1"
                )
                if not self.project_id:
                    raise ValueError("Missing required configuration for Vertex: GCLOUD_PROJECT")
                self.vertex_client = genai.Client(
                    vertexai=True,
                    project=self.project_id,
                    location=location,
                )
            except Exception as e:
                logger.warning("Vertex client disabled: %s", e)

        self.model_default = _env_model("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
        fast = _env_model("GEMINI_IMAGE_MODEL_FAST", "")
        self.model_fast = fast or self.model_default
        self.model = self.model_default
        self.connected = True
        logger.info(
            "GeminiImageService ready: default=%s fast=%s",
            self.model_default,
            self.model_fast,
        )

    def _resolve_model(
        self, *, model_variant: Optional[str] = None, model: Optional[str] = None
    ) -> str:
        if model:
            return model
        variant = (model_variant or "").strip().lower()
        if variant in ("fast", "flash"):
            return self.model_fast
        return self.model_default

    def _image_generation_tools(self) -> List[types.Tool]:
        return [types.Tool(google_search=types.GoogleSearch())]

    @staticmethod
    def _thinking_config() -> types.ThinkingConfig:
        # thinking_level needs google-genai>=1.62; older SDKs only have thinking_budget
        if "thinking_level" in types.ThinkingConfig.model_fields:
            return types.ThinkingConfig(thinking_level="HIGH")
        return types.ThinkingConfig(thinking_budget=-1)

    @staticmethod
    def _image_config(
        aspect_ratio: Optional[str],
        image_size: Optional[str],
    ) -> Optional[types.ImageConfig]:
        if not hasattr(types, "ImageConfig"):
            logger.warning(
                "google-genai is too old for ImageConfig; pip install 'google-genai>=1.62.0'"
            )
            return None
        return types.ImageConfig(
            aspect_ratio=aspect_ratio or "3:4",
            image_size=image_size or "2K",
        )

    def _build_generation_config(
        self,
        aspect_ratio: Optional[str] = None,
        image_size: Optional[str] = None,
        model: Optional[str] = None,
        system_instruction: Optional[str] = None,
    ) -> types.GenerateContentConfig:
        model_name = (model or "").lower()
        is_image_model = "image" in model_name
        effective_system_instruction = system_instruction or self.SYSTEM_INSTRUCTION

        if not is_image_model:
            return types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                temperature=1,
                system_instruction=effective_system_instruction,
                tools=self._image_generation_tools(),
            )

        config_kwargs: Dict[str, Any] = {
            "response_modalities": ["IMAGE", "TEXT"],
            "temperature": 1,
            "system_instruction": effective_system_instruction,
            "thinking_config": self._thinking_config(),
            "tools": self._image_generation_tools(),
        }
        image_cfg = self._image_config(aspect_ratio, image_size)
        if image_cfg is not None:
            config_kwargs["image_config"] = image_cfg
        return types.GenerateContentConfig(**config_kwargs)

    def _resolve_client(self, model: str):
        m = (model or "").lower()
        if self.vertex_client and (
            "flash-image" in m
            or "2.5" in m
            or m.startswith("projects/")
            or m.startswith("publishers/")
        ):
            return self.vertex_client
        return self.client

    async def generate_image(
        self,
        user_prompt: str,
        conversation_context: Optional[str] = None,
        style_preset: Optional[str] = None,
        aspect_ratio: Optional[str] = None,
        image_size: Optional[str] = None,
        system_instruction: Optional[str] = None,
        model_variant: Optional[str] = None,
        model: Optional[str] = None,
        input_image_bytes: Optional[bytes] = None,
        input_image_mime: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate an image. Caller supplies the full user prompt and optional system instruction."""
        try:
            has_logo = bool(input_image_bytes)
            if conversation_context:
                logger.warning("conversation_context is ignored; pass content in user_prompt only")
            if style_preset:
                logger.warning("style_preset is deprecated; include style in user_prompt")
            prompt = user_prompt.strip()
            model_to_use = self._resolve_model(model_variant=model_variant, model=model)
            logger.info(
                "Generating image: model=%s theme=%s aspect=%s size=%s logo=%s",
                model_to_use,
                style_preset or "(none)",
                aspect_ratio or "3:4",
                image_size or "2K",
                has_logo,
            )

            config = self._build_generation_config(
                aspect_ratio=aspect_ratio,
                image_size=image_size,
                model=model_to_use,
                system_instruction=system_instruction,
            )

            parts = [types.Part.from_text(text=prompt)]
            if input_image_bytes:
                parts.append(
                    types.Part.from_bytes(
                        data=input_image_bytes,
                        mime_type=input_image_mime or "image/png",
                    )
                )

            client = self._resolve_client(model_to_use)
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model_to_use,
                contents=[types.Content(role="user", parts=parts)],
                config=config,
            )

            if response.candidates:
                candidate = response.candidates[0]
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, "inline_data") and part.inline_data:
                            image_data = part.inline_data.data
                            if image_data is not None:
                                return {
                                    "success": True,
                                    "image_data": image_data,
                                    "mime_type": part.inline_data.mime_type,
                                    "prompt": prompt,
                                    "model": model_to_use,
                                    "visual_theme": style_preset,
                                    "aspect_ratio": aspect_ratio or "3:4",
                                    "image_size": image_size or "2K",
                                }

            return {"success": False, "error": "No image data found in response"}

        except Exception as e:
            logger.error("Image generation failed: %s", e)
            return {"success": False, "error": str(e)}

    def get_service_info(self) -> Dict[str, Any]:
        return {
            "service_type": "Gemini Image Generation",
            "model": self.model,
            "connected": self.connected,
        }


def create_gemini_image_service() -> GeminiImageService:
    service = GeminiImageService()
    if not service.connected:
        raise RuntimeError("Failed to connect to Gemini Image Service")
    return service

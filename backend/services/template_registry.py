import os
from typing import List, Dict, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class TemplateMetadata:
    """Metadata for a resume template"""
    id: str
    name: str
    description: str
    filename: str
    preview_image: Optional[str] = None
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []

class TemplateRegistry:
    """Registry for managing resume templates"""

    def __init__(self, templates_dir: Optional[str] = None):
        """
        Initialize Template Registry

        Args:
            templates_dir: Directory containing template files
        """
        if templates_dir is None:
            templates_dir = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'templates'
            )

        self.templates_dir = templates_dir
        self._templates: Dict[str, TemplateMetadata] = {}
        self._register_default_templates()

    def _register_default_templates(self):
        """Register default templates"""
        # Professional template with Cendien branding
        self.register_template(
            TemplateMetadata(
                id='professional',
                name='Cendien Professional',
                description='',
                filename='resume_template_professional.html',
                preview_image='/cendien-sample.png',
                tags=['professional', 'cendien', 'branded', 'legal']
            )
        )

        # Modern template without branding
        self.register_template(
            TemplateMetadata(
                id='modern',
                name='Modern',
                description='',
                filename='resume_template_modern.html',
                preview_image='/modern-sample.png',
                tags=['modern', 'creative', 'unbranded', 'letter']
            )
        )

        # Minimal template without branding
        self.register_template(
            TemplateMetadata(
                id='minimal',
                name='Minimal',
                description='',
                filename='resume_template_minimal.html',
                preview_image='/minimal-sample.png',
                tags=['minimal', 'simple', 'unbranded', 'letter']
            )
        )

    def register_template(self, template: TemplateMetadata) -> None:
        """
        Register a new template

        Args:
            template: Template metadata
        """
        self._templates[template.id] = template
        logger.info(f"Registered template: {template.name} ({template.id})")

    def get_template(self, template_id: str) -> Optional[TemplateMetadata]:
        """
        Get template metadata by ID

        Args:
            template_id: Template identifier

        Returns:
            Template metadata or None if not found
        """
        return self._templates.get(template_id)

    def list_templates(self) -> List[Dict]:
        """
        List all available templates

        Returns:
            List of template metadata as dictionaries
        """
        return [
            {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'preview_image': template.preview_image,
                'tags': template.tags,
                'available': self._is_template_available(template.filename)
            }
            for template in self._templates.values()
        ]

    def _is_template_available(self, filename: str) -> bool:
        """
        Check if template file exists

        Args:
            filename: Template filename

        Returns:
            True if template file exists
        """
        template_path = os.path.join(self.templates_dir, filename)
        return os.path.exists(template_path)

    def get_template_path(self, template_id: str) -> Optional[str]:
        """
        Get full path to template file

        Args:
            template_id: Template identifier

        Returns:
            Full path to template file or None
        """
        template = self.get_template(template_id)
        if not template:
            return None

        return os.path.join(self.templates_dir, template.filename)

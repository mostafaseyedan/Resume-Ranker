import os
from typing import Optional
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from .resume_models import ResumeModel
import logging

# Disable fontTools debug logging
logging.getLogger('fontTools').setLevel(logging.WARNING)
logging.getLogger('fontTools.subset').setLevel(logging.WARNING)
logging.getLogger('fontTools.ttLib').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

class ResumeGenerator:
    def __init__(self, template_path: Optional[str] = None):
        """
        Initialize Resume Generator

        Args:
            template_path: Path to the directory containing resume templates
        """
        if template_path is None:
            # Default to the services directory where templates are stored
            template_path = os.path.dirname(os.path.abspath(__file__))

        self.template_path = template_path
        self.env = Environment(loader=FileSystemLoader(template_path))

    def generate_pdf(self, resume_model: ResumeModel, template_name: str = "resume_template.html") -> bytes:
        """
        Generate PDF from ResumeModel

        Args:
            resume_model: Validated ResumeModel instance
            template_name: Name of the template file to use

        Returns:
            PDF file as bytes
        """
        try:
            # Convert ResumeModel to dictionary for template rendering
            template_data = resume_model.model_dump()

            # Prefer filesystem path for PDF rendering when available
            logo_file_path = template_data.pop('logo_file_path', None)
            if logo_file_path:
                template_data['logo_path'] = logo_file_path
            elif 'logo_path' in template_data and template_data['logo_path']:
                logo_path = template_data['logo_path']
                if logo_path.startswith('/'):
                    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    candidate_path = os.path.join(backend_root, logo_path.lstrip('/'))
                    if os.path.exists(candidate_path):
                        template_data['logo_path'] = candidate_path

            # Load and render template
            template = self.env.get_template(template_name)
            html_output = template.render(resume=template_data)

            # Generate PDF using WeasyPrint
            pdf_bytes = HTML(
                string=html_output,
                base_url=self.template_path
            ).write_pdf()

            if pdf_bytes is None:
                raise Exception("PDF generation failed - WeasyPrint returned None")

            logger.info(f"Successfully generated PDF for {resume_model.name}")
            return pdf_bytes

        except Exception as e:
            logger.error(f"Error generating PDF: {e}")
            raise Exception(f"Failed to generate resume PDF: {str(e)}")

    def generate_html_preview(self, resume_model: ResumeModel, template_name: str = "resume_template.html") -> str:
        """
        Generate HTML preview of the resume

        Args:
            resume_model: Validated ResumeModel instance
            template_name: Name of the template file to use

        Returns:
            HTML string
        """
        try:
            template_data = resume_model.model_dump()

            # Remove filesystem-only path and keep browser-friendly path if provided
            template_data.pop('logo_file_path', None)

            if 'logo_path' in template_data and template_data['logo_path']:
                logo_path = template_data['logo_path']
                if not logo_path.startswith('/'):
                    template_data['logo_path'] = f"/static/{os.path.basename(logo_path)}"

            template = self.env.get_template(template_name)
            html_output = template.render(resume=template_data)

            logger.info(f"Successfully generated HTML preview for {resume_model.name}")
            return html_output

        except Exception as e:
            logger.error(f"Error generating HTML preview: {e}")
            raise Exception(f"Failed to generate resume HTML: {str(e)}")

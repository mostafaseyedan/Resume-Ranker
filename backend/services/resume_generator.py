import os
from typing import Optional
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from html4docx import HtmlToDocx
from docx import Document
from datetime import datetime
from io import BytesIO
from .resume_models import ResumeModel
from .template_registry import TemplateRegistry
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
            # Default to the templates directory
            template_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'templates'
            )

        self.template_path = template_path
        self.env = Environment(loader=FileSystemLoader(template_path))
        self.template_registry = TemplateRegistry(template_path)

    def generate_pdf(self, resume_model: ResumeModel, template_name: str = "resume_template_professional.html") -> bytes:
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

    def generate_html_preview(self, resume_model: ResumeModel, template_name: str = "resume_template_professional.html") -> str:
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

    def generate_docx(self, resume_model: ResumeModel, template_name: str = "resume_template_professional.html") -> bytes:
        """
        Generate DOCX from ResumeModel

        Args:
            resume_model: Validated ResumeModel instance
            template_name: Name of the template file to use

        Returns:
            DOCX file as bytes
        """
        try:
            # Convert ResumeModel to dictionary for template rendering
            template_data = resume_model.model_dump()

            # Prefer filesystem path for DOCX rendering when available
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

            # Use DOCX-specific template with inline styles
            docx_template_name = template_name.replace('.html', '_docx.html')

            # Check if DOCX-specific template exists, otherwise fallback to regular template
            docx_template_path = os.path.join(self.template_path, docx_template_name)
            if not os.path.exists(docx_template_path):
                logger.warning(f"DOCX template {docx_template_name} not found, using {template_name}")
                docx_template_name = template_name

            # Load and render template
            template = self.env.get_template(docx_template_name)
            html_output = template.render(resume=template_data)

            # Generate DOCX using html4docx
            parser = HtmlToDocx()
            parser.table_style = 'Table Grid'

            # Create document
            document = Document()

            # Add metadata
            parser.set_initial_attrs(document)
            metadata = parser.metadata
            metadata.set_metadata(
                author=resume_model.name,
                title=f"Resume - {resume_model.title}",
                created=datetime.now().isoformat()
            )

            # Convert HTML to DOCX
            parser.add_html_to_document(html_output, document)

            # Remove leading empty paragraphs
            self._remove_leading_empty_paragraphs(document)

            # Resize logo if present
            if template_data.get('logo_path'):
                self._resize_logo_in_docx(document)

            # Apply table styling like PDF version
            self._apply_table_styling(document)

            # Fix table column widths
            self._fix_table_widths(document)

            # Apply page break controls
            self._apply_page_break_controls(document)

            # Add footer with company info
            if resume_model.footer:
                self._add_footer_to_docx(document, resume_model.footer)

            # Set default font to Calibri
            self._set_default_font(document, 'Calibri')

            # Set page margins to Normal
            self._set_page_margins(document)

            # Save to bytes
            docx_buffer = BytesIO()
            document.save(docx_buffer)
            docx_bytes = docx_buffer.getvalue()
            docx_buffer.close()

            if docx_bytes is None:
                raise Exception("DOCX generation failed")

            logger.info(f"Successfully generated DOCX for {resume_model.name}")
            return docx_bytes

        except Exception as e:
            logger.error(f"Error generating DOCX: {e}")
            raise Exception(f"Failed to generate resume DOCX: {str(e)}")

    def _remove_leading_empty_paragraphs(self, document: Document):
        """Remove empty paragraphs at the beginning of the document and in table cells"""
        try:
            from docx.oxml import CT_P
            from docx.oxml.ns import qn

            body = document._element.body
            paragraphs_to_remove = []

            # Find leading empty paragraphs in document body
            for element in body:
                if element.tag == qn('w:p'):
                    # Check if paragraph is empty (no text content)
                    text = ''.join(node.text for node in element.iter() if hasattr(node, 'text') and node.text)
                    if not text or text.isspace():
                        paragraphs_to_remove.append(element)
                    else:
                        # Stop at first non-empty paragraph
                        break
                else:
                    # Stop at first non-paragraph element (like table)
                    break

            # Remove the empty paragraphs from body
            for para in paragraphs_to_remove:
                body.remove(para)

            if paragraphs_to_remove:
                logger.info(f"Removed {len(paragraphs_to_remove)} leading empty paragraph(s) from document body")

            # Also remove leading empty paragraphs from table cells
            for table in document.tables:
                for row in table.rows:
                    for cell in row.cells:
                        cell_element = cell._element
                        cell_paras_to_remove = []

                        # Find leading empty paragraphs in this cell
                        for element in cell_element:
                            if element.tag == qn('w:p'):
                                text = ''.join(node.text for node in element.iter() if hasattr(node, 'text') and node.text)
                                # Check if it's empty and doesn't contain images
                                has_drawing = element.find(qn('w:r')) is not None and element.find('.//{}'.format(qn('w:drawing'))) is not None
                                if (not text or text.isspace()) and not has_drawing:
                                    cell_paras_to_remove.append(element)
                                else:
                                    # Stop at first non-empty paragraph or paragraph with image
                                    break

                        # Remove empty paragraphs from cell
                        for para in cell_paras_to_remove:
                            cell_element.remove(para)

        except Exception as e:
            logger.warning(f"Could not remove leading empty paragraphs: {e}")

    def _resize_logo_in_docx(self, document: Document):
        """Resize all images (logo) in the document to appropriate size"""
        try:
            from docx.shared import Inches

            target_width = Inches(0.7)

            # Search in both paragraphs and table cells
            def resize_images_in_element(element):
                for run in element.runs:
                    if hasattr(run, '_element'):
                        for drawing in run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'):
                            for inline in drawing.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}inline'):
                                extent = inline.find('.//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}extent')
                                if extent is not None:
                                    cx = int(extent.get('cx'))
                                    cy = int(extent.get('cy'))
                                    aspect_ratio = cy / cx if cx > 0 else 1

                                    new_cx = int(target_width)
                                    new_cy = int(target_width * aspect_ratio)

                                    extent.set('cx', str(new_cx))
                                    extent.set('cy', str(new_cy))

                                    for ext in inline.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}ext'):
                                        ext.set('cx', str(new_cx))
                                        ext.set('cy', str(new_cy))

                                    logger.info(f"Resized logo to {target_width / 914400:.2f} inches")
                                    return True
                return False

            # Check paragraphs
            for paragraph in document.paragraphs:
                if resize_images_in_element(paragraph):
                    return

            # Check table cells
            for table in document.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            if resize_images_in_element(paragraph):
                                return

        except Exception as e:
            logger.warning(f"Could not resize logo: {e}")

    def _fix_table_widths(self, document: Document):
        """Fix table column widths to match PDF template"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement
            from docx.shared import Inches

            # Standard page width for legal size with margins (8.5" - 2" margins = 6.5" usable)
            # In twips: 6.5 * 1440 = 9360
            page_width_twips = 9360

            skills_table_next = False

            for table_idx, table in enumerate(document.tables):
                # Get table text to identify which table this is
                table_text = table.rows[0].cells[0].text if table.rows else ""
                num_cols = len(table.rows[0].cells) if table.rows else 0
                num_rows = len(table.rows)

                if table_idx == 0:
                    # First table: Header table (logo + info)
                    # Logo: 0.7 inch = 1008 twips, increased to 1300 for better spacing
                    logo_width = 1300
                    info_width = page_width_twips - logo_width

                    self._set_table_column_widths(table, [logo_width, info_width])

                    # Remove borders from first column (logo cell)
                    if table.rows:
                        logo_cell = table.rows[0].cells[0]
                        self._remove_cell_borders(logo_cell)

                    logger.info(f"Set header table widths: logo={logo_width}, info={info_width}")

                elif "Key Expertise" in table_text or "Skills" in table_text:
                    # This is the skills title table
                    self._set_table_column_widths(table, [page_width_twips])
                    skills_table_next = True
                    logger.info("Found skills title table, next 2-column table will be skills data")

                elif skills_table_next and num_cols == 2 and num_rows > 1:
                    # This is the actual skills data table (right after the title)
                    # Skills table: 25% / 75% split
                    col1_width = int(page_width_twips * 0.25)
                    col2_width = page_width_twips - col1_width

                    self._set_table_column_widths(table, [col1_width, col2_width])
                    logger.info(f"Set skills table widths: category={col1_width}, details={col2_width}")
                    skills_table_next = False  # Reset flag

                elif num_cols == 1:
                    # Single column table (section title tables)
                    # Make them span full page width
                    self._set_table_column_widths(table, [page_width_twips])

                elif num_cols == 2 and num_rows == 2:
                    # Two row, two column tables (experience job entry headers)
                    col1_width = int(page_width_twips * 0.60)
                    col2_width = page_width_twips - col1_width
                    self._set_table_column_widths(table, [col1_width, col2_width])

        except Exception as e:
            logger.warning(f"Could not fix table widths: {e}")

    def _remove_cell_borders(self, cell):
        """Remove all borders from a table cell"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement

            tcPr = cell._element.find(qn('w:tcPr'))
            if tcPr is None:
                tcPr = OxmlElement('w:tcPr')
                cell._element.insert(0, tcPr)

            # Remove existing borders
            tcBorders = tcPr.find(qn('w:tcBorders'))
            if tcBorders is not None:
                tcPr.remove(tcBorders)

            # Add new borders with "nil" value (Word uses "nil" to hide borders)
            tcBorders = OxmlElement('w:tcBorders')
            for border_name in ['top', 'left', 'bottom', 'right']:
                border = OxmlElement(f'w:{border_name}')
                border.set(qn('w:val'), 'nil')
                tcBorders.append(border)

            tcPr.append(tcBorders)

        except Exception as e:
            logger.warning(f"Could not remove cell borders: {e}")

    def _set_table_column_widths(self, table, widths):
        """Set column widths for a table"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement

            # Update table grid
            tbl = table._element
            tblGrid = tbl.find(qn('w:tblGrid'))

            if tblGrid is not None:
                # Remove old grid columns
                for gridCol in list(tblGrid):
                    tblGrid.remove(gridCol)

                # Add new grid columns with correct widths
                for width in widths:
                    gridCol = OxmlElement('w:gridCol')
                    gridCol.set(qn('w:w'), str(width))
                    tblGrid.append(gridCol)

            # Update cell widths in each row
            for row in table.rows:
                for idx, cell in enumerate(row.cells):
                    if idx < len(widths):
                        tcPr = cell._element.find(qn('w:tcPr'))
                        if tcPr is None:
                            tcPr = OxmlElement('w:tcPr')
                            cell._element.insert(0, tcPr)

                        tcW = tcPr.find(qn('w:tcW'))
                        if tcW is None:
                            tcW = OxmlElement('w:tcW')
                            tcPr.append(tcW)

                        tcW.set(qn('w:type'), 'dxa')
                        tcW.set(qn('w:w'), str(widths[idx]))

        except Exception as e:
            logger.warning(f"Could not set table column widths: {e}")

    def _apply_table_styling(self, document: Document):
        """Apply styling to tables to match PDF version"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement

            for table in document.tables:
                # Apply table grid style for borders
                if table.style and 'Grid' not in str(table.style.name):
                    table.style = 'Table Grid'

                # Set table borders
                tbl = table._element
                tblPr = tbl.find(qn('w:tblPr'))
                if tblPr is None:
                    tblPr = OxmlElement('w:tblPr')
                    tbl.insert(0, tblPr)

                # Add borders
                tblBorders = OxmlElement('w:tblBorders')
                for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
                    border = OxmlElement(f'w:{border_name}')
                    border.set(qn('w:val'), 'single')
                    border.set(qn('w:sz'), '4')
                    border.set(qn('w:color'), '000000')
                    tblBorders.append(border)

                # Remove old borders and add new
                old_borders = tblPr.find(qn('w:tblBorders'))
                if old_borders is not None:
                    tblPr.remove(old_borders)
                tblPr.append(tblBorders)

        except Exception as e:
            logger.warning(f"Could not apply table styling: {e}")

    def _add_footer_to_docx(self, document: Document, footer_text: str):
        """Add footer to all pages of the document"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement
            from docx.shared import Pt

            section = document.sections[0]
            footer = section.footer

            # Clear existing footer content
            footer_para = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
            footer_para.clear()
            footer_para.alignment = 1  # Center alignment

            # Add top border to footer
            pPr = footer_para._element.get_or_add_pPr()
            pBdr = OxmlElement('w:pBdr')
            top = OxmlElement('w:top')
            top.set(qn('w:val'), 'single')
            top.set(qn('w:sz'), '4')
            top.set(qn('w:space'), '1')
            top.set(qn('w:color'), '000000')
            pBdr.append(top)
            pPr.append(pBdr)

            # Add footer text
            formatted_text = footer_text.replace('Phone: ', '').replace(' | ', '   •   ')
            run = footer_para.add_run(formatted_text)
            run.font.name = 'Calibri'
            run.font.size = Pt(8)

        except Exception as e:
            logger.warning(f"Could not add footer: {e}")

    def _apply_page_break_controls(self, document: Document):
        """Apply page break controls to prevent awkward breaks (similar to PDF template)"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement

            # Apply to tables (prevent skills table from breaking)
            for table_idx, table in enumerate(document.tables):
                table_text = table.rows[0].cells[0].text if table.rows else ""

                # Skills table and section title tables should not break
                if "Key Expertise" in table_text or "Skills" in table_text:
                    # Find the actual skills data table (next table after title)
                    if len(table.rows) == 1 and len(table.rows[0].cells) == 1:
                        if table_idx + 1 < len(document.tables):
                            skills_table = document.tables[table_idx + 1]
                            # Prevent each row from splitting
                            for row in skills_table.rows:
                                self._set_row_cant_split(row)

                # Experience job entry tables - prevent rows from splitting
                elif len(table.rows) == 2 and len(table.rows[0].cells) == 2:
                    # This looks like a job entry header table
                    for row in table.rows:
                        self._set_row_cant_split(row)

            # Apply to paragraphs
            section_markers = [
                "Professional Summary",
                "Key Expertise",
                "Professional Experience",
                "Education",
                "Certifications"
            ]

            # Track if we're in Core Competencies section to avoid applying keep-with-next
            in_core_competencies = False

            for para_idx, para in enumerate(document.paragraphs):
                para_text = para.text.strip()

                # Check if entering or leaving Core Competencies section
                if "Core Competencies" in para_text:
                    in_core_competencies = True
                    self._set_keep_with_next(para)  # Keep title with content
                    continue
                elif any(marker in para_text for marker in section_markers):
                    in_core_competencies = False

                # Keep section titles with next paragraph
                if any(marker in para_text for marker in section_markers):
                    self._set_keep_with_next(para)

                # Keep company/institution names with next paragraph (but not in Core Competencies)
                if not in_core_competencies and para_idx + 1 < len(document.paragraphs):
                    next_para = document.paragraphs[para_idx + 1]
                    # If this is bold text followed by a heading-like paragraph, keep together
                    if para.runs and any(run.bold for run in para.runs):
                        self._set_keep_with_next(para)

            logger.info("Applied page break controls to document")

        except Exception as e:
            logger.warning(f"Could not apply page break controls: {e}")

    def _set_keep_with_next(self, paragraph):
        """Set paragraph to keep with next paragraph"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement

            pPr = paragraph._element.get_or_add_pPr()
            keepNext = pPr.find(qn('w:keepNext'))
            if keepNext is None:
                keepNext = OxmlElement('w:keepNext')
                pPr.append(keepNext)
        except Exception as e:
            pass

    def _set_keep_lines_together(self, paragraph):
        """Set paragraph to keep all lines together"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement

            pPr = paragraph._element.get_or_add_pPr()
            keepLines = pPr.find(qn('w:keepLines'))
            if keepLines is None:
                keepLines = OxmlElement('w:keepLines')
                pPr.append(keepLines)
        except Exception as e:
            pass

    def _set_row_cant_split(self, row):
        """Prevent table row from splitting across pages"""
        try:
            from docx.oxml.ns import qn
            from docx.oxml import OxmlElement

            trPr = row._element.find(qn('w:trPr'))
            if trPr is None:
                trPr = OxmlElement('w:trPr')
                row._element.insert(0, trPr)

            cantSplit = trPr.find(qn('w:cantSplit'))
            if cantSplit is None:
                cantSplit = OxmlElement('w:cantSplit')
                trPr.append(cantSplit)
        except Exception as e:
            pass

    def _set_page_margins(self, document: Document):
        """Set page margins to Normal (1 inch all around) for legal size paper"""
        try:
            from docx.shared import Inches

            section = document.sections[0]

            # Set page size to legal (8.5" x 14")
            section.page_width = Inches(8.5)
            section.page_height = Inches(14)

            # Set margins to Normal (1 inch all around)
            section.top_margin = Inches(1.0)
            section.bottom_margin = Inches(1.0)
            section.left_margin = Inches(1.0)
            section.right_margin = Inches(1.0)

            logger.info("Set page margins to Normal (1 inch)")

        except Exception as e:
            logger.warning(f"Could not set page margins: {e}")

    def _set_default_font(self, document: Document, font_name: str):
        """Set default font for the entire document"""
        try:
            from docx.oxml.ns import qn

            # Set font for document defaults
            styles = document.styles
            style = styles['Normal']
            font = style.font
            font.name = font_name

            # Also set for East Asian and Complex scripts
            element = style.element
            rPr = element.get_or_add_rPr()
            rFonts = rPr.find(qn('w:rFonts'))
            if rFonts is None:
                from docx.oxml import OxmlElement
                rFonts = OxmlElement('w:rFonts')
                rPr.append(rFonts)
            rFonts.set(qn('w:ascii'), font_name)
            rFonts.set(qn('w:hAnsi'), font_name)
            rFonts.set(qn('w:cs'), font_name)

        except Exception as e:
            logger.warning(f"Could not set default font: {e}")

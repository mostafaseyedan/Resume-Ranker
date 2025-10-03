import json
import logging
from typing import Dict, Any, Optional, List, Union
from datetime import datetime, date
from .resume_models import ResumeModel, ContactInfo, ExperienceEntry, EducationEntry, SkillEntry, CompetencyEntry, ProjectEntry
from .resume_generator import ResumeGenerator
from google import genai
from google.genai import types
from pydantic import BaseModel


logger = logging.getLogger(__name__)

class ResumeService:
    def __init__(self, gemini_api_key: str, template_path: Optional[str] = None):
        """
        Initialize Resume Service

        Args:
            gemini_api_key: Google Gemini API key
            template_path: Path to resume templates directory
        """
        self.gemini_api_key = gemini_api_key
        self.client = genai.Client(api_key=gemini_api_key)
        self.resume_generator = ResumeGenerator(template_path)

    def improve_and_generate_pdf(self, candidate_data: Dict, job_data: Dict, company_info: Optional[Dict] = None, template_name: str = "resume_template_professional.html") -> bytes:
        """
        Generate improved resume PDF using Gemini structured output

        Args:
            candidate_data: Original candidate information from database
            job_data: Job description and requirements
            company_info: Company branding information (logo, footer, etc.)
            template_name: Name of the template file to use

        Returns:
            PDF bytes for download
        """
        try:
            # Step 1: Generate ResumeModel schema for Gemini
            schema = ResumeModel.model_json_schema()

            # Step 2: Create comprehensive prompt for Gemini
            prompt = self._create_improvement_prompt(candidate_data, job_data, schema)

            # Step 3: Get structured output from Gemini
            improved_data = self._get_gemini_structured_output(prompt, schema)

            # Step 4: Add company branding
            if company_info:
                improved_data = self._add_company_branding(improved_data, company_info)

            # Step 5: Validate and create ResumeModel
            resume_model = ResumeModel.model_validate(improved_data)

            # Step 6: Generate PDF with specified template
            pdf_bytes = self.resume_generator.generate_pdf(resume_model, template_name=template_name)

            logger.info(f"Successfully generated improved resume PDF for {candidate_data.get('name', 'unknown')}")
            return pdf_bytes

        except Exception as e:
            logger.error(f"Error in improve_and_generate_pdf: {e}")
            raise Exception(f"Failed to generate improved resume: {str(e)}")

    def improve_and_generate_docx(self, candidate_data: Dict, job_data: Dict, company_info: Optional[Dict] = None, template_name: str = "resume_template_professional.html") -> bytes:
        """
        Generate improved resume DOCX using Gemini structured output

        Args:
            candidate_data: Original candidate information from database
            job_data: Job description and requirements
            company_info: Company branding information (logo, footer, etc.)
            template_name: Name of the template file to use

        Returns:
            DOCX bytes for download
        """
        try:
            # Step 1: Generate ResumeModel schema for Gemini
            schema = ResumeModel.model_json_schema()

            # Step 2: Create comprehensive prompt for Gemini
            prompt = self._create_improvement_prompt(candidate_data, job_data, schema)

            # Step 3: Get structured output from Gemini
            improved_data = self._get_gemini_structured_output(prompt, schema)

            # Step 4: Add company branding
            if company_info:
                improved_data = self._add_company_branding(improved_data, company_info)

            # Step 5: Validate and create ResumeModel
            resume_model = ResumeModel.model_validate(improved_data)

            # Step 6: Generate DOCX with specified template
            docx_bytes = self.resume_generator.generate_docx(resume_model, template_name=template_name)

            logger.info(f"Successfully generated improved resume DOCX for {candidate_data.get('name', 'unknown')}")
            return docx_bytes

        except Exception as e:
            logger.error(f"Error in improve_and_generate_docx: {e}")
            raise Exception(f"Failed to generate improved resume: {str(e)}")

    def _create_improvement_prompt(self, candidate_data: Dict, job_data: Dict, schema: Dict) -> str:
        """Create comprehensive prompt for Gemini to improve resume"""

        # Extract the original resume text
        resume_text = candidate_data.get('resume_text', 'No original resume content available')

        # Format weaknesses as a list for the prompt
        weakness_list = "\n".join([f"- {w.get('weakness', '')}: {w.get('recommendation', '')}"
                                 for w in candidate_data.get('weaknesses', [])[:5]])

        # Format skill weights for prioritization
        skill_weights_text = ""
        if job_data.get('skill_weights'):
            skill_weights_text = f"""

**SKILL PRIORITIES (from job analysis):**
{json.dumps(job_data['skill_weights'], indent=2)}

CRITICAL: These weights (0-10 scale) indicate the importance of each skill for this role. Skills with weight 8-10 are MANDATORY and must be prominently featured.

You MUST:
- Feature ALL high-weight skills (8-12) in the professional summary
- Include ALL required skills in core competencies with detailed descriptions
- Demonstrate high-weight skills through specific projects and accomplishments in work experience
- Use exact keywords from job requirements multiple times throughout the resume
- For any skill with weight 9-10, provide at least 3-4 pieces of evidence across different sections
"""

        prompt = f"""
As an expert resume writer and career coach with 20+ years of experience, create an improved version of this resume that is perfectly tailored to the job description.

**ORIGINAL RESUME:**
{resume_text}

**TARGET JOB DESCRIPTION:**
- Job Title: {job_data.get('title', 'N/A')}
- Job Description: {job_data.get('description', 'N/A')}
{skill_weights_text}

**REQUIRED CERTIFICATIONS FROM JOB:**
Based on the job description, identify any required or preferred certifications, licenses, or professional credentials mentioned.

**IDENTIFIED WEAKNESSES TO ADDRESS:**
{weakness_list}

**CANDIDATE ANALYSIS:**
- Overall Score: {candidate_data.get('overall_score', 'N/A')}%
- Summary: {candidate_data.get('summary', 'N/A')}

**STRENGTHS:**
{self._format_strengths(candidate_data.get('strengths', []))}

**SKILLS ANALYSIS:**
{self._format_skills_analysis(candidate_data.get('skill_analysis', []))}

**RESUME IMPROVEMENT INSTRUCTIONS:**
Generate an improved resume that:

CRITICAL GOAL: The improved resume MUST score 95% or higher when analyzed against this job description. The current score is {candidate_data.get('overall_score', 'N/A')}% - you must dramatically improve it.

1. Is fully tailored to the job description with 100% alignment
2. Restructures content to highlight relevant skills and experience prominently
3. Uses keywords from the job description naturally and frequently throughout
4. Addresses ALL identified weaknesses comprehensively
5. Follows modern resume best practices
6. Optimizes for ATS (Applicant Tracking Systems)
7. Add, or make up experiences or skills for areas that are weak or missing
8. Every single requirement in the job description must be clearly demonstrated
9. Should be comprehensive and detailed - length is not a concern if it means better alignment
10. Emphasize high-weight skills from the job analysis in multiple sections
11. Should address all the requirements in the job description, do not leave any requirement unaddressed
12. Quantify achievements with metrics wherever possible to demonstrate impact

**FORMATTING REQUIREMENTS:**
- Write a compelling professional summary that highlights the candidate's value proposition for this specific role
- Transform work experience descriptions into achievement-focused bullet points with metrics when possible
- Organize skills into logical categories relevant to the job.
- Use action verbs and quantifiable achievements throughout
- Use realistic dates
- If end_date is missing, the position is current (set end_date to null)
- Include impactful bullet points per work experience
- Skills should be categorized and prioritized based on job requirements
- Professional summary should be concise but impactful for the target role

**CONTENT STRUCTURE:**
- Contact Information
- Professional Summary (tailored to the job)
- Core Competencies & Skills (organized by relevance)
- Professional Experience (achievement-focused)
- Education & Certifications

**CORE COMPETENCIES REQUIREMENTS:**
Generate 4-8 core competencies that are highly relevant to the target job:
- Each competency should have a title (the competency name) and description (1-3 lines explanation)
- Focus on high-level professional capabilities, methodologies, and domain expertise
- Align competencies with the job requirements and candidate's experience
- Examples: "Business Process Analysis & Optimization", "Agile Project Management", "Cloud Architecture & Design"
- Avoid generic skills - make them specific and impactful for the role

**PROFESSIONAL EXPERIENCE DETAILED REQUIREMENTS:**
For each professional experience entry, generate the following sections:
- Summary: 4-8 lines overall summary of the role and its relevance to the target job
- Notable Projects: 2-6 significant projects, each with a title (project name) and description (2-4 lines of detailed explanation showing impact and relevance)
- Responsibilities: 4-12 bullet points covering key job duties and responsibilities
- Accomplishments: 4-10 bullet points focusing on quantifiable achievements with metrics when possible
- Environment: Comma-separated list of technologies, tools, frameworks, and methodologies used (e.g., "ASP.NET 3.5, C# 3.0, WCF, Web Services, AJAX, ADO.NET, LINQ, XML")

**EDUCATION RELEVANCE REQUIREMENTS:**
- For each education entry, add 1-2 lines explaining how the degree/coursework is relevant to the target job
- Connect academic background to job requirements and industry needs
- Highlight relevant courses, projects, or specializations that align with the role

**CERTIFICATION REQUIREMENTS:**
- Generate relevant certifications based on the job requirements and industry standards
- Include certifications that are commonly expected for this role (e.g., PMP for project managers, AWS certifications for cloud roles, etc.)
- Use realistic certification names, issuers, and dates
- If the original resume mentions certifications, enhance and align them with job requirements
- Add 2-4 relevant certifications that would strengthen the candidate's profile for this specific role
- Include both technical certifications (if applicable) and professional/industry certifications
- Use recent dates (within last 3-5 years) for certifications

**CRITICAL REQUIREMENTS:**
- NEVER use placeholders anywhere - always use realistic, specific names and details
- DO focus on optimal presentation and positioning of existing qualifications
- DO ensure all content aligns with and supports the job requirements
- This should not be shorter than the orginal resume

Please generate the resume data following this JSON schema exactly:

{json.dumps(schema, indent=2)}

Ensure all fields are properly formatted and the response is valid JSON that matches the schema.
"""
        return prompt

    def _format_strengths(self, strengths: list) -> str:
        """Format strengths for prompt"""
        if not strengths:
            return "No specific strengths identified."

        formatted = []
        for i, strength in enumerate(strengths[:5], 1):  # Limit to top 5
            if isinstance(strength, dict):
                formatted.append(f"{i}. {strength.get('strength', 'N/A')} - {strength.get('evidence', 'N/A')}")

        return "\n".join(formatted) if formatted else "No specific strengths identified."

    def _format_weaknesses(self, weaknesses: list) -> str:
        """Format weaknesses for prompt"""
        if not weaknesses:
            return "No specific weaknesses identified."

        formatted = []
        for i, weakness in enumerate(weaknesses[:3], 1):  # Limit to top 3
            if isinstance(weakness, dict):
                formatted.append(f"{i}. {weakness.get('weakness', 'N/A')} - {weakness.get('recommendation', 'N/A')}")

        return "\n".join(formatted) if formatted else "No specific weaknesses identified."

    def _format_skills_analysis(self, skills: list) -> str:
        """Format skills analysis for prompt"""
        if not skills:
            return "No specific skills analysis available."

        formatted = []
        for skill in skills[:10]:  # Limit to top 10 skills
            if isinstance(skill, dict):
                score = skill.get('score', 0)
                formatted.append(f"- {skill.get('skill', 'N/A')}: {score}/10 ({skill.get('candidate_level', 'N/A')} level)")

        return "\n".join(formatted) if formatted else "No specific skills analysis available."

    def _get_gemini_structured_output(self, prompt: str, schema: Dict) -> Dict:
        """Get structured JSON output from Gemini"""
        try:
            # Generate content with structured JSON output
            response = self.client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ResumeModel,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=-1  # Dynamic thinking
                    )
                )
            )

            # Parse JSON response
            if response.text is None:
                raise ValueError("Gemini response text is None")
            result = json.loads(response.text)

            # Post-process dates to ensure they're in correct format
            result = self._process_dates(result)

            logger.info("Successfully generated structured resume data from Gemini")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            raise Exception("Gemini returned invalid JSON response")
        except Exception as e:
            logger.error(f"Error getting Gemini structured output: {e}")
            raise Exception(f"Failed to get improved resume data from AI: {str(e)}")

    def _process_dates(self, data: Dict) -> Dict:
        """Process date strings to ensure proper format"""
        try:
            # Process experience dates
            if 'experience' in data:
                for exp in data['experience']:
                    if 'start_date' in exp and isinstance(exp['start_date'], str):
                        exp['start_date'] = self._parse_date_string(exp['start_date'])
                    if 'end_date' in exp and exp['end_date'] and isinstance(exp['end_date'], str):
                        exp['end_date'] = self._parse_date_string(exp['end_date'])

            # Process education dates
            if 'education' in data:
                for edu in data['education']:
                    if 'graduation_date' in edu and isinstance(edu['graduation_date'], str):
                        edu['graduation_date'] = self._parse_date_string(edu['graduation_date'])

            # Process projects dates if present
            if 'projects' in data and data['projects']:
                for proj in data['projects']:
                    if 'start_date' in proj and isinstance(proj['start_date'], str):
                        proj['start_date'] = self._parse_date_string(proj['start_date'])
                    if 'end_date' in proj and proj['end_date'] and isinstance(proj['end_date'], str):
                        proj['end_date'] = self._parse_date_string(proj['end_date'])

            # Process certification dates if present
            if 'certifications' in data and data['certifications']:
                for cert in data['certifications']:
                    # Handle Gemini returning 'date' field - rename to 'issue_date' to avoid naming conflict
                    if 'date' in cert and cert['date']:
                        if isinstance(cert['date'], str):
                            cert['issue_date'] = self._parse_date_string(cert['date'])
                        else:
                            cert['issue_date'] = cert['date']
                        del cert['date']  # Remove the conflicting field
                    # Handle if Gemini already returns 'issue_date'
                    elif 'issue_date' in cert and cert['issue_date'] and isinstance(cert['issue_date'], str):
                        cert['issue_date'] = self._parse_date_string(cert['issue_date'])

            return data

        except Exception as e:
            logger.error(f"Error processing dates: {e}")
            return data

    def _parse_date_string(self, date_str: str) -> Union[date, str]:
        """Parse various date string formats to date object"""
        try:
            # Common date formats to try
            formats = [
                "%Y-%m-%d",      # 2023-01-15
                "%Y/%m/%d",      # 2023/01/15
                "%m/%d/%Y",      # 01/15/2023
                "%d/%m/%Y",      # 15/01/2023
                "%Y-%m",         # 2023-01 (add day)
                "%m/%Y",         # 01/2023 (add day)
            ]

            for fmt in formats:
                try:
                    if fmt in ["%Y-%m", "%m/%Y"]:
                        # For month/year formats, default to first day of month
                        parsed_date = datetime.strptime(date_str, fmt).replace(day=1)
                    else:
                        parsed_date = datetime.strptime(date_str, fmt)
                    return parsed_date.date()  # Return date object, not string
                except ValueError:
                    continue

            # If no format works, return original string
            logger.warning(f"Could not parse date string: {date_str}")
            return date_str

        except Exception as e:
            logger.error(f"Error parsing date string {date_str}: {e}")
            return date_str

    def _add_company_branding(self, resume_data: Dict, company_info: Dict) -> Dict:
        """Add company branding information to resume data"""
        try:
            # Add logo path if provided
            if 'logo_path' in company_info:
                resume_data['logo_path'] = company_info['logo_path']
            if 'logo_file_path' in company_info:
                resume_data['logo_file_path'] = company_info['logo_file_path']

            # Add footer if provided
            if 'footer' in company_info:
                resume_data['footer'] = company_info['footer']

            # Add any other company-specific branding
            return resume_data

        except Exception as e:
            logger.error(f"Error adding company branding: {e}")
            return resume_data

    def generate_html_preview(self, candidate_data: Dict, job_data: Dict, company_info: Optional[Dict] = None) -> str:
        """
        Generate HTML preview of improved resume

        Args:
            candidate_data: Original candidate information
            job_data: Job description and requirements
            company_info: Company branding information

        Returns:
            HTML string for preview
        """
        try:
            # Generate improved data (same as PDF but return HTML)
            schema = ResumeModel.model_json_schema()
            prompt = self._create_improvement_prompt(candidate_data, job_data, schema)
            improved_data = self._get_gemini_structured_output(prompt, schema)

            if company_info:
                improved_data = self._add_company_branding(improved_data, company_info)

            resume_model = ResumeModel.model_validate(improved_data)
            html_output = self.resume_generator.generate_html_preview(resume_model)

            logger.info(f"Successfully generated HTML preview for {candidate_data.get('name', 'unknown')}")
            return html_output

        except Exception as e:
            logger.error(f"Error generating HTML preview: {e}")
            raise Exception(f"Failed to generate resume preview: {str(e)}")

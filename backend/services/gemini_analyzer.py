from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import logging
import json
import io
import requests
import os

logger = logging.getLogger(__name__)

# PDF Processor Service URL
PDF_PROCESSOR_URL = "https://pdf-processor-service-352598512627.us-central1.run.app/process-rfp-pdf/"

# Pydantic models for structured output - avoid Dict which can cause additionalProperties issues
class SkillWeight(BaseModel):
    skill_name: str
    weight: float

class JobAnalysis(BaseModel):
    mandatory_skills: List[str]
    preferred_skills: List[str]
    experience_years: str
    education: List[str]
    soft_skills: List[str]
    skill_weights: List[SkillWeight]
    position_level: str
    key_responsibilities: List[str]

class Strength(BaseModel):
    strength: str
    relevance: str
    evidence: str

class Weakness(BaseModel):
    weakness: str
    importance: str
    impact: str
    recommendation: str

class SkillAnalysis(BaseModel):
    skill: str
    required_level: str
    candidate_level: str
    evidence: str
    score: int
    weight: float

class CompanyDetail(BaseModel):
    name: str
    location: str = ""
    start_date: str = ""
    end_date: str = ""

class InstitutionDetail(BaseModel):
    name: str
    location: str = ""
    start_date: str = ""
    end_date: str = ""

class ExperienceMatch(BaseModel):
    total_years: float
    relevant_years: float
    role_progression: str
    industry_match: str
    companies: List[CompanyDetail] = Field(default_factory=list, description="List of companies with details")

class EducationMatch(BaseModel):
    degree_relevance: str
    certifications: List[str]
    continuous_learning: str
    institutions: List[InstitutionDetail] = Field(default_factory=list, description="List of institutions with details")

class ResumeAnalysis(BaseModel):
    candidate_name: str
    candidate_email: str
    candidate_phone: str
    overall_score: int = Field(ge=0, le=100, description="Overall match score from 0-100")
    summary: str
    strengths: List[Strength]
    weaknesses: List[Weakness]
    skill_analysis: List[SkillAnalysis]
    experience_match: ExperienceMatch
    education_match: EducationMatch

class JobExtraction(BaseModel):
    job_title: str
    job_location: Optional[str] = Field(default=None, description="Job location (city, state, country) or null if remote/not specified")
    job_description_text: str
    required_skills: List[str]
    preferred_skills: List[str]
    experience_requirements: str
    education_requirements: List[str]
    certifications: List[str]
    key_responsibilities: List[str]
    soft_skills: List[str]
    other: List[str]
    questions_for_candidate: List[str] = Field(default_factory=list)

class GeminiAnalyzer:
    def __init__(self, api_key):
        self.client = genai.Client(api_key=api_key)
        self.supported_formats = ['.pdf', '.docx', '.doc']

    def _extract_text_with_processor(self, file):
        """Extract text from file using PDF processor service"""
        try:
            file_content = file.read()
            file.seek(0)

            filename = file.filename
            mime_type = "application/pdf" if filename.lower().endswith('.pdf') else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

            files = {"files": (filename, io.BytesIO(file_content), mime_type)}
            response = requests.post(PDF_PROCESSOR_URL, files=files, timeout=120)

            if response.status_code != 200:
                logger.error(f"PDF processor returned status {response.status_code}: {response.text}")
                raise ValueError(f"Failed to extract text from {filename}")

            result = response.json()
            extracted_text = result.get("extracted_text", "")

            if not extracted_text:
                raise ValueError(f"No text extracted from {filename}")

            logger.info(f"Extracted {len(extracted_text)} characters from {filename} using PDF processor")
            return extracted_text

        except Exception as e:
            logger.error(f"Error extracting text from {file.filename} using PDF processor: {e}")
            raise

    def _upload_file_to_gemini(self, file):
        """Upload file directly to Gemini and return file object"""
        try:
            file_content = file.read()
            if file_content is None:
                raise ValueError("Failed to read file content")
            file.seek(0)

            file_data = io.BytesIO(file_content)

            filename = file.filename.lower()
            if filename.endswith('.pdf'):
                mime_type = "application/pdf"
            elif filename.endswith(('.docx', '.doc')):
                mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            else:
                raise ValueError(f"Unsupported file format. Supported formats: {self.supported_formats}")

            uploaded_file = self.client.files.upload(
                file=file_data,
                config={"mime_type": mime_type}
            )

            logger.info(f"Successfully uploaded file {file.filename} to Gemini")
            return uploaded_file

        except Exception as e:
            logger.error(f"Error uploading file {file.filename} to Gemini: {e}")
            raise

    def validate_file(self, file):
        """Validate uploaded file"""
        if not file or file.filename == '':
            return False, "No file provided"

        if not any(file.filename.lower().endswith(ext) for ext in self.supported_formats):
            return False, f"Unsupported file format. Supported: {', '.join(self.supported_formats)}"

        file.seek(0, 2)
        size = file.tell()
        file.seek(0)

        if size > 20 * 1024 * 1024:
            return False, "File too large. Maximum size: 20MB"

        return True, "File is valid"

    def analyze_job_description(self, job_description):
        """Analyze job description to extract requirements and assign skill weights"""
        try:
            response = self.client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
                contents=f"""
            Job Description:
            {job_description}
            """,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JobAnalysis,
                    system_instruction="""
                    As an expert technical recruiter, analyze the provided job description and extract structured information.

                    Instructions:
                    1. Assign weights (0-10) based on importance in the job description
                    2. Higher weights for skills mentioned multiple times or marked as "required"
                    3. Consider the seniority level when assigning weights
                    4. Extract both technical and soft skills
                    """,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=-1  # Dynamic thinking
                    )
                )
            )

            if response.text is None:
                raise ValueError("Gemini response text is None")
            return json.loads(response.text)

        except Exception as e:
            logger.error(f"Error analyzing job description: {e}")
            raise Exception(f"Failed to analyze job description: {str(e)}")

    def analyze_job_description_from_file(self, file):
        """Extract structured job information from file using PDF processor + Gemini"""
        try:
            # Extract text using PDF processor service
            job_description_text = self._extract_text_with_processor(file)

            response = self.client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
                contents=f"Job Description:\n{job_description_text}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JobExtraction,
                    system_instruction="""
                    You are an expert technical recruiter. Analyze the provided job description text and extract all relevant information including the job title, job location, complete description text, required and preferred skills, experience requirements, education requirements, certifications, responsibilities, soft skills, and any other important details.

                    JOB LOCATION:
                    Extract the job location (city, state, country) if mentioned. Examples:
                    - "Oakland County, Michigan" or "Oakland County, MI"
                    - "San Francisco, CA"
                    - "New York, NY"
                    - "Remote" if fully remote
                    Set to null if location is not specified or unclear.

                    CRITICAL FORMATTING INSTRUCTION:
                    For the 'job_description_text' field, you MUST rewrite the text into clean, readable Markdown.
                    - Use '## ' for section headers (e.g., '## Responsibilities').
                    - YOU MUST PUT TWO NEWLINES BEFORE EVERY HEADER. (e.g., '\\n\\n## Header').
                    - Fix any run-on text or glued headers.
                    - Use bullet points for lists.

                    QUESTIONS FOR CANDIDATE:
                    Generate 5-10 assessment questions based on the job description. Focus on:
                    - Technical skills and competencies required for the role
                    - Relevant work experience and past projects
                    Make questions specific to the job requirements and suitable for candidate assessment emails.
                    """
                )
            )

            if response.text is None or not response.text.strip():
                logger.error(f"Gemini returned empty response for {file.filename}")
                raise ValueError("Gemini response is empty")

            logger.info(f"Raw Gemini response for {file.filename}: {response.text[:200]}...")

            extracted_data = json.loads(response.text)
            logger.info(f"Extracted structured job info from {file.filename}: {extracted_data.get('job_title', 'Unknown Title')}")

            return extracted_data

        except Exception as e:
            logger.error(f"Error extracting job info from {file.filename} using Gemini: {e}")
            raise


    def analyze_resume(self, file, job_description, skill_weights=None):
        """Analyze resume file against job requirements - PDF processor + Gemini analysis"""
        try:
            # Extract text using PDF processor service
            resume_text = self._extract_text_with_processor(file)

            skill_weights_text = ""
            if skill_weights and isinstance(skill_weights, dict):
                skill_weights_text = f"""

SKILL IMPORTANCE WEIGHTS (0-10 scale from job analysis):
{json.dumps(skill_weights, indent=2)}

Use these weights when evaluating skills in the skill_analysis section. Each skill's weight field should match the importance from this list.
"""

            response = self.client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
                contents=f"""
RESUME TEXT:
{resume_text}

JOB DESCRIPTION:
{job_description}
{skill_weights_text}
""",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ResumeAnalysis,
                    system_instruction="""
As an expert technical recruiter with 20+ years of experience, analyze the candidate's resume against the job requirements.

SCORING METHODOLOGY:
You must calculate the overall_score (0-100) using this weighted formula:

1. Skills Match (40% of total score):
   - For each skill in skill_analysis, assign a score (0-10) based on candidate's proficiency
   - Use the skill's weight from SKILL IMPORTANCE WEIGHTS (higher weight = more important)
   - Calculate weighted average: sum(skill_score * skill_weight) / sum(skill_weights)
   - Convert to percentage: (weighted_average / 10) * 100
   - Multiply by 0.40 for final skills component

2. Experience Match (30% of total score):
   - Evaluate total_years: Does candidate meet minimum requirements? (0-10)
   - Evaluate relevant_years: How much experience is directly relevant? (0-10)
   - Evaluate role_progression: Clear career growth and increasing responsibility? (0-10)
   - Evaluate industry_match: Experience in same/similar industry? (0-10)
   - **BONUS**: If candidate worked for US-based companies, increase the experience score by up to 10 points (max 10 total).
   - Average these four scores (including bonus in calculation), convert to percentage, multiply by 0.30

3. Education Match (20% of total score):
   - Evaluate degree_relevance: How relevant is education to the role? (0-10)
   - Evaluate certifications: Does candidate have required/preferred certifications? (0-10)
   - Evaluate continuous_learning: Evidence of ongoing professional development? (0-10)
   - **BONUS**: If candidate attended US-based universities/institutions, increase the education score by up to 10 points (max 10 total).
   - Average these three scores (including bonus), convert to percentage, multiply by 0.20

4. Soft Skills Match (10% of total score):
   - Evaluate communication, leadership, teamwork, problem-solving based on resume evidence (0-10)
   - Convert to percentage, multiply by 0.10

OVERALL_SCORE = (Skills Component) + (Experience Component) + (Education Component) + (Soft Skills Component)

DETAILED INSTRUCTIONS:

For skill_analysis:
- Include all skills mentioned in SKILL IMPORTANCE WEIGHTS
- For each skill, provide:
  - skill: The skill name (must match job requirements)
  - required_level: Level needed for the job (e.g., "Expert", "Advanced", "Intermediate")
  - candidate_level: Candidate's actual level based on resume evidence
  - evidence: Specific examples from resume showing this skill
  - score: 0-10 rating of candidate's proficiency
  - weight: The importance weight from SKILL IMPORTANCE WEIGHTS (0-10)

For experience_match:
- total_years: Total years of professional experience (numeric)
- relevant_years: Years of directly relevant experience (numeric)
- role_progression: Description of career progression with assessment
- industry_match: Description of industry alignment with assessment
- companies: List ALL companies with detailed information:
  - name: Company name (normalize, e.g., "Google Inc." -> "Google")
  - location: City, State or City, Country (e.g., "Dallas, Texas" or "London, UK")
  - start_date: Start date in MM/DD/YYYY format
  - end_date: End date in MM/DD/YYYY format or "Present" if current

For education_match:
- degree_relevance: Explanation of how education relates to role
- certifications: List of all certifications found in resume
- continuous_learning: Evidence of recent training, courses, self-study
- institutions: List ALL universities and educational institutions with detailed information:
  - name: Institution name
  - location: City, State or City, Country
  - start_date: Start date in MM/DD/YYYY format
  - end_date: End date in MM/DD/YYYY format or "Present" if current

For strengths:
- Identify 3-5 top strengths with specific evidence from resume
- Focus on strengths most relevant to job requirements

For weaknesses:
- Identify 3-5 gaps or areas for improvement
- Provide specific, actionable recommendations for each
- Assess importance (Critical/High/Medium/Low) and impact on job performance

SCORING GUIDELINES:
- Be objective but fair in your assessment
- If a resume demonstrates ALL required skills and experience, it should score 90%+
- If a resume has minor gaps but strong overall alignment, score should be 80-89%
- If a resume is comprehensively tailored with all requirements met and excellent presentation, score should be 95%+
- Give credit for skills demonstrated through project descriptions and accomplishments, not just listed skills
- Consider the overall package - strong alignment across multiple areas should result in high scores
"""
                )
            )

            if response.text is None:
                raise ValueError("Gemini response text is None")

            result = json.loads(response.text)

            if not (0 <= result.get('overall_score', -1) <= 100):
                logger.warning(f"Overall score out of range: {result.get('overall_score')}, clamping to 0-100")
                result['overall_score'] = max(0, min(100, result.get('overall_score', 0)))

            # Add the extracted text from PDF processor to the result
            result['extracted_text'] = resume_text

            logger.info(f"Analyzed resume file {file.filename} - Score: {result.get('overall_score')}")
            return result

        except Exception as e:
            logger.error(f"Error analyzing resume: {e}")
            raise Exception(f"Failed to analyze resume: {str(e)}")



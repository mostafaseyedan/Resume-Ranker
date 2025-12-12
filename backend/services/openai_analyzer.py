import json
import logging
import io
import requests
import os
from typing import Any, Dict
from openai import OpenAI
from services.gemini_analyzer import JobExtraction, JobAnalysis, ResumeAnalysis

logger = logging.getLogger(__name__)

# Reuse the same PDF processor used by Gemini flows
PDF_PROCESSOR_URL = "https://pdf-processor-service-352598512627.us-central1.run.app/process-rfp-pdf/"


class OpenAIAnalyzer:
    """
    Minimal OpenAI-backed analyzer to mirror the GeminiAnalyzer interface.
    Uses OpenAI Responses/Chat API to return JSON matching existing schemas.
    """

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAIAnalyzer")

        self.client = OpenAI(api_key=api_key)
        self.supported_formats = ['.pdf', '.docx', '.doc']
        self.job_model = os.getenv("OPENAI_JOB_MODEL", "gpt-5.1")
        self.resume_model = os.getenv("OPENAI_RESUME_MODEL", "gpt-5.1")

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

    def _extract_text_with_processor(self, file):
        """Extract text from file using the shared PDF processor."""
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

            logger.info(f"[OpenAI] Extracted {len(extracted_text)} characters from {filename}")
            return extracted_text

        except Exception as e:
            logger.error(f"Error extracting text from {file.filename} using PDF processor: {e}")
            raise

    def _parse_completion(self, model: str, prompt: str, response_model: Any) -> Any:
        """
        Call OpenAI with Structured Outputs (parse) to ensure strict schema adherence.
        """
        try:
            completion = self.client.beta.chat.completions.parse(
                model=model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                response_format=response_model,
                # Set reasoning effort to low as requested
                reasoning_effort="low",
                # Set verbosity to low via extra_body for Chat Completions
                extra_body={ "verbosity": "low" }
            )
            
            # OpenAI returns a parsed Pydantic object
            return completion.choices[0].message.parsed.model_dump()
            
        except Exception as e:
            logger.error(f"OpenAI parsing failed: {e}")
            raise ValueError(f"OpenAI structured output failed: {e}")

    def analyze_job_description(self, job_description):
        """Analyze job description to extract requirements and assign skill weights"""
        try:
            # Note: We pass the Pydantic class directly, not the schema dict
            prompt = f"""
            Job Description:
            {job_description}
            
            As an expert technical recruiter, analyze the provided job description and extract structured information.
            
            Instructions:
            1. Assign weights (0-10) based on importance in the job description
            2. Higher weights for skills mentioned multiple times or marked as "required"
            3. Consider the seniority level when assigning weights
            4. Extract both technical and soft skills
            """
            
            # Use strict parsing with the JobAnalysis Pydantic model
            result = self._parse_completion(self.job_model, prompt, JobAnalysis)
            return result
        except Exception as e:
            logger.error(f"Error analyzing job description: {e}")
            raise Exception(f"Failed to analyze job description: {str(e)}")
            
    def analyze_job_description_from_file(self, file):
        """Extract structured job information using OpenAI."""
        try:
            job_description_text = self._extract_text_with_processor(file)

            prompt = f"""
Analyze the provided job description text and extract all relevant information including the job title, complete description text, required and preferred skills, experience requirements, education requirements, certifications, responsibilities, soft skills, and any other important details.

Job Description:
{job_description_text}

CRITICAL FORMATTING INSTRUCTION:
For the 'job_description_text' field, you MUST rewrite the text into clean, readable Markdown.
- Use '## ' for section headers (e.g., '## Responsibilities').
- YOU MUST PUT TWO NEWLINES BEFORE EVERY HEADER. (e.g., '\\n\\n## Header').
- Fix any run-on text or glued headers.
- Use bullet points for lists.
- EXCLUDE all administrative headers (Requisition #, Date, Contact Name, Email, Phone).
- EXCLUDE application instructions (e.g., 'Please respond by logging in...', 'submit candidate').
- Focus ONLY on the Role Summary, Technical Environment, and Requirements.
- The output should look like a clean, professional job posting summary.

QUESTIONS FOR CANDIDATE:
Generate 5-10 assessment questions based on the job description. Focus on:
- Technical skills and competencies required for the role
- Relevant work experience and past projects
Make questions specific to the job requirements and suitable for candidate assessment emails.
"""
            # Use strict parsing with the JobExtraction Pydantic model
            result = self._parse_completion(self.job_model, prompt, JobExtraction)
            
            logger.info(f"[OpenAI] Extracted structured job info for {file.filename}")
            return result
        except Exception as e:
            logger.error(f"OpenAI job extraction failed for {file.filename}: {e}")
            raise

    def analyze_resume(self, file, job_description: str, skill_weights=None):
        """Analyze a resume against a job description using OpenAI."""
        try:
            resume_text = self._extract_text_with_processor(file)
            

            skill_weights_text = ""
            if skill_weights and isinstance(skill_weights, dict):
                skill_weights_text = f"\nSKILL IMPORTANCE WEIGHTS (0-10):\n{json.dumps(skill_weights, indent=2)}\n"

            prompt = f"""
RESUME TEXT:
{resume_text}

JOB DESCRIPTION:
{job_description}
{skill_weights_text}

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
            # Use strict parsing with the ResumeAnalysis Pydantic model
            result = self._parse_completion(self.resume_model, prompt, ResumeAnalysis)

            # Clamp overall_score to 0-100
            score = result.get('overall_score', 0)
            if not isinstance(score, (int, float)) or score < 0 or score > 100:
                result['overall_score'] = max(0, min(100, int(score) if isinstance(score, (int, float)) else 0))

            result['extracted_text'] = resume_text
            logger.info(f"[OpenAI] Analyzed resume {file.filename} - Score: {result.get('overall_score')}")
            return result
        except Exception as e:
            logger.error(f"OpenAI resume analysis failed for {file.filename}: {e}")
            raise

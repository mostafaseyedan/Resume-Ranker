from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Dict
import logging
import json

logger = logging.getLogger(__name__)

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

class ExperienceMatch(BaseModel):
    total_years: float
    relevant_years: float
    role_progression: str
    industry_match: str

class EducationMatch(BaseModel):
    degree_relevance: str
    certifications: List[str]
    continuous_learning: str

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

class GeminiAnalyzer:
    def __init__(self, api_key):
        self.client = genai.Client(api_key=api_key)

    def analyze_job_description(self, job_description):
        """Analyze job description to extract requirements and assign skill weights"""
        try:
            prompt = f"""
            As an expert technical recruiter, analyze this job description and extract structured information.

            Job Description:
            {job_description}

            Instructions:
            1. Assign weights (0-10) based on importance in the job description
            2. Higher weights for skills mentioned multiple times or marked as "required"
            3. Consider the seniority level when assigning weights
            4. Extract both technical and soft skills
            """

            response = self.client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JobAnalysis,
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

    def analyze_resume(self, resume_text, job_description, skill_weights=None):
        """Analyze resume against job requirements and provide detailed scoring"""
        try:
            # Format skill weights for prompt
            skill_weights_text = ""
            if skill_weights and isinstance(skill_weights, dict):
                skill_weights_text = f"""

SKILL IMPORTANCE WEIGHTS (0-10 scale from job analysis):
{json.dumps(skill_weights, indent=2)}

Use these weights when evaluating skills in the skill_analysis section. Each skill's weight field should match the importance from this list.
"""

            prompt = f"""
As an expert technical recruiter with 20+ years of experience, analyze this candidate's resume against the job requirements.

JOB DESCRIPTION:
{job_description}
{skill_weights_text}

RESUME TEXT:
{resume_text}

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
   - Average these four scores, convert to percentage, multiply by 0.30

3. Education Match (20% of total score):
   - Evaluate degree_relevance: How relevant is education to the role? (0-10)
   - Evaluate certifications: Does candidate have required/preferred certifications? (0-10)
   - Evaluate continuous_learning: Evidence of ongoing professional development? (0-10)
   - Average these three scores, convert to percentage, multiply by 0.20

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

For education_match:
- degree_relevance: Explanation of how education relates to role
- certifications: List of all certifications found in resume
- continuous_learning: Evidence of recent training, courses, self-study

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

            response = self.client.models.generate_content(
                model="gemini-flash-latest",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ResumeAnalysis,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=-1  # Dynamic thinking
                    )
                )
            )

            if response.text is None:
                raise ValueError("Gemini response text is None")

            result = json.loads(response.text)

            # Validate that overall_score is within range
            if not (0 <= result.get('overall_score', -1) <= 100):
                logger.warning(f"Overall score out of range: {result.get('overall_score')}, clamping to 0-100")
                result['overall_score'] = max(0, min(100, result.get('overall_score', 0)))

            return result

        except Exception as e:
            logger.error(f"Error analyzing resume: {e}")
            raise Exception(f"Failed to analyze resume: {str(e)}")



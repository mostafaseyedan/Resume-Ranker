from google import genai
from google.genai import types
from pydantic import BaseModel
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
    overall_score: int
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
                model="gemini-2.5-flash-lite",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JobAnalysis,
                )
            )

            if response.text is None:
                raise ValueError("Gemini response text is None")
            return json.loads(response.text)

        except Exception as e:
            logger.error(f"Error analyzing job description: {e}")
            return {"requirements": {}, "skill_weights": {}}

    def analyze_resume(self, resume_text, job_description, skill_weights=None):
        """Analyze resume against job requirements and provide detailed scoring"""
        try:
            prompt = f"""
            As an expert technical recruiter with 20+ years of experience, analyze this candidate's resume against the job requirements.

            JOB DESCRIPTION:
            {job_description}

            RESUME TEXT:
            {resume_text}

            Instructions:
            1. Calculate overall_score using weighted average of all factors
            2. Focus on job-specific requirements and skills
            3. Identify top 3-5 strengths and weaknesses
            4. Provide specific, actionable recommendations
            5. Consider years of experience, role progression, and skill depth
            6. Be objective and critical in your assessment
            """

            response = self.client.models.generate_content(
                model="gemini-2.5-pro",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ResumeAnalysis,
                )
            )

            if response.text is None:
                raise ValueError("Gemini response text is None")
            return json.loads(response.text)

        except Exception as e:
            logger.error(f"Error analyzing resume: {e}")
            return {"overall_score": 0, "summary": "Analysis failed"}



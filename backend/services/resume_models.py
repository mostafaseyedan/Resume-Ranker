from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, HttpUrl
from datetime import date

class ContactInfo(BaseModel):
    email: EmailStr
    phone: Optional[str] = None
    linkedin: Optional[HttpUrl] = None
    github: Optional[HttpUrl] = None
    portfolio: Optional[HttpUrl] = None

class ProjectEntry(BaseModel):
    title: str
    description: str

class ExperienceEntry(BaseModel):
    role: str = Field(min_length=3)
    company: str = Field(min_length=2)
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    summary: Optional[str] = None  # 4-8 lines overall summary
    notable_projects: Optional[List[ProjectEntry]] = None  # 2-6 projects with title and description
    responsibilities: Optional[List[str]] = None  # 4-12 bullet points
    accomplishments: Optional[List[str]] = None  # 4-10 bullet points (quantifiable)
    environment: Optional[List[str]] = None  # Comma-separated tech list
    description: Optional[List[str]] = None  # Keep for backward compatibility
    tech_stack: Optional[List[str]] = None  # Keep for backward compatibility

class EducationEntry(BaseModel):
    institution: str
    degree: str
    location: Optional[str] = None
    graduation_date: date
    relevance: Optional[str] = None  # 1-2 lines explaining relevance to job
    gpa: Optional[float] = Field(None, ge=0, le=4.0)

class SkillEntry(BaseModel):
    category: str
    details: str

class CertificationEntry(BaseModel):
    name: str
    issue_date: Optional[date] = None
    description: Optional[str] = None

class CompetencyEntry(BaseModel):
    title: str
    description: str

class ResumeModel(BaseModel):
    name: str = Field(min_length=3, max_length=50)
    title: str = Field(min_length=5)
    summary: str
    contact: ContactInfo
    skills: List[SkillEntry]
    core_competencies: List[CompetencyEntry]
    experience: List[ExperienceEntry]
    education: List[EducationEntry]
    certifications: Optional[List[CertificationEntry]] = None
    projects: Optional[List[ExperienceEntry]] = None
    logo_path: Optional[str] = None
    logo_file_path: Optional[str] = None
    footer: Optional[str] = None

#!/usr/bin/env python3
"""Test script to generate a sample resume with footer for design verification"""

import sys
import os
from datetime import date

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.resume_models import ResumeModel, ContactInfo, ExperienceEntry, EducationEntry, SkillEntry
from services.resume_generator import ResumeGenerator

def create_sample_resume():
    """Create a sample resume with minimal data to test footer design"""

    resume = ResumeModel(
        name="John Doe",
        title="Senior Software Engineer",
        contact=ContactInfo(
            email="john.doe@example.com",
            phone="(214) 555-1234"
        ),
        summary="Experienced Software Engineer with 5+ years of expertise in full-stack development.",
        skills=[
            SkillEntry(category="Programming Languages", details="Python, JavaScript, Java, C++"),
            SkillEntry(category="Frameworks", details="React, Django, Spring Boot, Node.js"),
            SkillEntry(category="Tools & Technologies", details="Git, Docker, AWS, Kubernetes, CI/CD")
        ],
        experience=[
            ExperienceEntry(
                role="Senior Software Engineer",
                company="Tech Corp",
                location="Dallas, TX",
                start_date=date(2020, 1, 1),
                end_date=None,  # Current position
                summary="Lead development of cloud-based applications using modern technologies.",
                description=[
                    "Architected and implemented microservices architecture",
                    "Mentored junior developers and conducted code reviews",
                    "Collaborated with cross-functional teams to deliver products",
                    "Reduced application load time by 40% through optimization",
                    "Implemented CI/CD pipeline reducing deployment time by 60%"
                ],
                responsibilities=[
                    "Architected and implemented microservices architecture",
                    "Mentored junior developers and conducted code reviews",
                    "Collaborated with cross-functional teams to deliver products"
                ],
                accomplishments=[
                    "Reduced application load time by 40% through optimization",
                    "Implemented CI/CD pipeline reducing deployment time by 60%"
                ],
                environment=["Python", "React", "AWS", "Docker", "Kubernetes"]
            )
        ],
        education=[
            EducationEntry(
                degree="Bachelor of Science in Computer Science",
                institution="University of Texas",
                location="Austin, TX",
                graduation_date=date(2018, 5, 15),
                relevance="Focused on software engineering and algorithm design"
            )
        ],
        footer="Arisma Group LLC dba Cendien | 1846 E Rosemead Pkwy Ste. 200 Carrollton, TX 75007 | Phone: (214) 245-4580 | http://www.cendien.com",
        logo_file_path="static/cendien_corp_logo.jpg"
    )

    return resume

def main():
    """Generate test resume PDF"""
    try:
        print("Creating sample resume...")
        resume = create_sample_resume()

        print("Initializing resume generator...")
        generator = ResumeGenerator()

        print("Generating PDF...")
        pdf_bytes = generator.generate_pdf(resume)

        # Save to file
        output_path = "test_resume_with_footer.pdf"
        with open(output_path, 'wb') as f:
            f.write(pdf_bytes)

        print(f"✅ Success! Resume generated: {os.path.abspath(output_path)}")
        print(f"   File size: {len(pdf_bytes)} bytes")
        print(f"\nOpen the PDF to verify the enhanced footer design:")
        print(f"   - Professional blue borders (top: 2px, bottom: 0.5px)")
        print(f"   - Improved spacing and padding")
        print(f"   - Better readability with #333 color")
        print(f"   - Increased letter-spacing and line-height")

    except Exception as e:
        print(f"❌ Error generating resume: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
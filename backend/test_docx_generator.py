"""
Test DOCX Generator
Creates a mock resume DOCX to test the current DOCX generation implementation
"""
import os
import sys
from datetime import date

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.resume_models import (
    ResumeModel,
    ContactInfo,
    ExperienceEntry,
    EducationEntry,
    SkillEntry,
    CompetencyEntry,
    ProjectEntry,
    CertificationEntry
)
from services.resume_generator import ResumeGenerator

def create_mock_resume() -> ResumeModel:
    """Create a comprehensive mock resume for testing"""

    contact = ContactInfo(
        email="john.doe@example.com",
        phone="(214) 555-1234",
        location="Dallas, TX"
    )

    skills = [
        SkillEntry(
            category="Programming Languages",
            details="Python, JavaScript, Java, C#, SQL, TypeScript, Go"
        ),
        SkillEntry(
            category="Frameworks & Libraries",
            details="React, Angular, Django, Flask, .NET Core, Spring Boot, Node.js"
        ),
        SkillEntry(
            category="Cloud & DevOps",
            details="AWS (EC2, S3, Lambda), Azure, Docker, Kubernetes, Jenkins, CI/CD"
        ),
        SkillEntry(
            category="Databases",
            details="PostgreSQL, MySQL, MongoDB, Redis, SQL Server, Oracle"
        ),
        SkillEntry(
            category="Tools & Technologies",
            details="Git, JIRA, Confluence, Agile/Scrum, Microservices, REST APIs"
        )
    ]

    competencies = [
        CompetencyEntry(
            title="Full-Stack Development",
            description="Expert in designing and implementing end-to-end solutions using modern web technologies, with strong emphasis on scalable architecture and best practices."
        ),
        CompetencyEntry(
            title="Cloud Architecture & Migration",
            description="Proven track record of migrating legacy systems to cloud platforms, optimizing for performance, cost-efficiency, and reliability."
        ),
        CompetencyEntry(
            title="Agile Project Leadership",
            description="Experience leading cross-functional teams in Agile environments, delivering high-quality software solutions on schedule and within budget."
        ),
        CompetencyEntry(
            title="API Design & Integration",
            description="Extensive experience designing RESTful APIs, implementing microservices architecture, and integrating third-party services."
        )
    ]

    experience = [
        ExperienceEntry(
            company="Tech Solutions Inc.",
            location="Dallas, TX",
            role="Senior Software Engineer",
            start_date=date(2021, 3, 1),
            end_date=None,  # Current position
            summary="Lead developer for enterprise-level web applications serving 100,000+ users. Architected and implemented cloud-native solutions resulting in 40% improvement in system performance and 30% reduction in infrastructure costs.",
            notable_projects=[
                ProjectEntry(
                    title="E-Commerce Platform Modernization",
                    description="Led the migration of legacy monolithic application to microservices architecture using Docker and Kubernetes. Implemented React-based frontend and Node.js backend services. Reduced deployment time from 4 hours to 15 minutes and improved system uptime to 99.9%."
                ),
                ProjectEntry(
                    title="Real-Time Analytics Dashboard",
                    description="Developed comprehensive analytics platform using React, Python Flask, and PostgreSQL. Implemented real-time data processing pipeline handling 1M+ events per day. Enabled data-driven decision making across organization."
                ),
                ProjectEntry(
                    title="Payment Gateway Integration",
                    description="Designed and implemented secure payment processing system integrating multiple payment providers (Stripe, PayPal, Square). Achieved PCI DSS compliance and processed $5M+ in transactions monthly."
                )
            ],
            responsibilities=[
                "Architect and develop scalable web applications using modern frameworks and cloud technologies",
                "Lead code reviews and establish coding standards for team of 8 developers",
                "Collaborate with product managers and stakeholders to define technical requirements",
                "Mentor junior developers and conduct technical training sessions",
                "Implement CI/CD pipelines and automated testing frameworks"
            ],
            accomplishments=[
                "Reduced application load time by 60% through performance optimization and caching strategies",
                "Designed and implemented automated deployment system reducing release cycle from 2 weeks to 2 days",
                "Increased test coverage from 45% to 85% by implementing comprehensive unit and integration tests",
                "Received 'Innovation Award' for developing internal tool that improved developer productivity by 35%",
                "Successfully led migration of 20+ legacy applications to AWS cloud platform"
            ],
            environment=[
                "React 18", "Node.js", "Python 3.11", "Django 4.2", "PostgreSQL 15",
                "Docker", "Kubernetes", "AWS (EC2, S3, Lambda, RDS)", "Redis",
                "Jenkins", "Git", "JIRA", "Agile/Scrum"
            ]
        ),
        ExperienceEntry(
            company="Digital Innovations LLC",
            location="Austin, TX",
            role="Software Engineer",
            start_date=date(2018, 6, 1),
            end_date=date(2021, 2, 28),
            summary="Full-stack developer responsible for building and maintaining multiple client-facing web applications. Contributed to successful delivery of 15+ projects with 100% client satisfaction rate.",
            notable_projects=[
                ProjectEntry(
                    title="Customer Portal Development",
                    description="Built customer self-service portal using Angular and .NET Core, serving 50,000+ users. Implemented role-based access control, document management, and automated workflows. Reduced customer support tickets by 40%."
                ),
                ProjectEntry(
                    title="Mobile Application Backend",
                    description="Developed RESTful API backend for iOS and Android applications using Node.js and MongoDB. Implemented JWT authentication, push notifications, and real-time sync. Supported 25,000+ active users."
                )
            ],
            responsibilities=[
                "Develop full-stack web applications using Angular, React, and .NET Core",
                "Design and implement RESTful APIs and database schemas",
                "Participate in Agile ceremonies and sprint planning",
                "Write comprehensive unit tests and perform code reviews",
                "Troubleshoot production issues and provide technical support"
            ],
            accomplishments=[
                "Developed reusable component library adopted across 10+ projects, reducing development time by 25%",
                "Implemented automated testing framework achieving 90% code coverage",
                "Optimized database queries reducing response time by 70%",
                "Received 'Employee of the Quarter' award for exceptional performance and teamwork"
            ],
            environment=[
                "Angular 12", ".NET Core 3.1", "Node.js", "MongoDB", "SQL Server",
                "Azure DevOps", "Docker", "Git", "TypeScript", "C#"
            ]
        ),
        ExperienceEntry(
            company="StartupXYZ",
            location="San Francisco, CA",
            role="Junior Software Developer",
            start_date=date(2016, 7, 1),
            end_date=date(2018, 5, 31),
            summary="Contributed to development of SaaS platform for small businesses. Gained hands-on experience with modern web technologies and Agile methodologies while working in fast-paced startup environment.",
            notable_projects=[
                ProjectEntry(
                    title="Billing System Implementation",
                    description="Implemented automated billing and subscription management system using Stripe API. Processed recurring payments for 5,000+ subscribers with 99.5% success rate."
                )
            ],
            responsibilities=[
                "Develop new features and fix bugs in React-based web application",
                "Write and maintain automated tests using Jest and Cypress",
                "Collaborate with designers to implement responsive UI components",
                "Participate in daily standups and sprint retrospectives"
            ],
            accomplishments=[
                "Implemented user authentication system supporting OAuth and SSO",
                "Improved application performance by optimizing React component rendering",
                "Created comprehensive API documentation using Swagger"
            ],
            environment=[
                "React 16", "Redux", "Node.js", "Express", "PostgreSQL", "Stripe API",
                "Jest", "Cypress", "Git", "Heroku"
            ]
        )
    ]

    education = [
        EducationEntry(
            institution="University of Texas at Austin",
            location="Austin, TX",
            degree="Bachelor of Science in Computer Science",
            graduation_date=date(2016, 5, 15),
            relevance="Comprehensive computer science curriculum with focus on software engineering, algorithms, and database systems. Completed senior capstone project developing a machine learning-based recommendation system. Relevant coursework: Data Structures, Web Development, Database Management, Software Engineering, Computer Networks."
        )
    ]

    certifications = [
        CertificationEntry(
            name="AWS Certified Solutions Architect - Associate",
            issuer="Amazon Web Services",
            issue_date=date(2023, 8, 15),
            description="Demonstrated expertise in designing distributed systems on AWS platform"
        ),
        CertificationEntry(
            name="Certified Kubernetes Application Developer (CKAD)",
            issuer="Cloud Native Computing Foundation",
            issue_date=date(2023, 3, 22),
            description="Validated skills in designing, building, and deploying cloud-native applications for Kubernetes"
        ),
        CertificationEntry(
            name="Professional Scrum Master I (PSM I)",
            issuer="Scrum.org",
            issue_date=date(2022, 11, 10),
            description="Demonstrated fundamental knowledge of Scrum framework and Agile principles"
        ),
        CertificationEntry(
            name="Microsoft Certified: Azure Developer Associate",
            issuer="Microsoft",
            issue_date=date(2022, 6, 5),
            description="Certified in designing, building, testing, and maintaining cloud applications on Azure"
        )
    ]

    resume = ResumeModel(
        name="John Doe",
        title="Senior Full-Stack Software Engineer",
        contact=contact,
        summary="Results-driven Senior Software Engineer with 8+ years of experience designing and implementing scalable web applications and cloud-native solutions. Proven expertise in full-stack development using React, Node.js, Python, and .NET Core. Strong background in cloud architecture (AWS, Azure), microservices, and DevOps practices. Demonstrated ability to lead technical initiatives, mentor development teams, and deliver high-quality software solutions that drive business value. Passionate about clean code, best practices, and continuous learning.",
        skills=skills,
        core_competencies=competencies,
        experience=experience,
        education=education,
        certifications=certifications,
        logo_path="/static/cendien_corp_logo.jpg",
        logo_file_path=None,
        footer="Arisma Group LLC dba Cendien | 1846 E Rosemead Pkwy Ste. 200 Carrollton, TX 75007 | Phone: (214) 245-4580 | http://www.cendien.com"
    )

    return resume


def main():
    """Generate test DOCX file"""
    print("Creating mock resume data...")
    resume = create_mock_resume()

    print("Initializing resume generator...")
    generator = ResumeGenerator()

    # Set logo path to actual file if it exists
    logo_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        'static',
        'cendien_corp_logo.jpg'
    )

    if os.path.exists(logo_path):
        resume.logo_file_path = logo_path
        print(f"Logo found at: {logo_path}")
    else:
        print(f"Warning: Logo not found at {logo_path}")
        resume.logo_path = None
        resume.logo_file_path = None

    # Generate DOCX (professional template via direct python-docx)
    print("Generating DOCX file (professional template - direct python-docx)...")
    try:
        docx_bytes = generator.generate_docx_professional_direct(resume)

        output_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'test_resume_output_professional.docx'
        )

        with open(output_path, 'wb') as f:
            f.write(docx_bytes)

        print(f"\nSuccess! Professional DOCX file generated at: {output_path}")
        print(f"File size: {len(docx_bytes):,} bytes")

    except Exception as e:
        print(f"\nError generating professional direct DOCX: {e}")
        import traceback
        traceback.print_exc()

    # Generate DOCX (modern template via direct python-docx)
    print("Generating DOCX file (modern template - direct python-docx)...")
    try:
        docx_bytes = generator.generate_docx_modern_direct(resume)

        output_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'test_resume_output_modern.docx'
        )

        with open(output_path, 'wb') as f:
            f.write(docx_bytes)

        print(f"\nSuccess! Modern DOCX file generated at: {output_path}")
        print(f"File size: {len(docx_bytes):,} bytes")

    except Exception as e:
        print(f"\nError generating modern direct DOCX: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { parseResume } = require('./resumeParser');
const { analyzeJob } = require('./jobAnalyzer');
const { optimizeResume } = require('./resumeOptimizer');
const { generateCoverLetter } = require('./coverLetterGenerator');

const SAMPLE_RESUME = `
Rory Mitchell
Wilmington, Delaware 19805 • rorym2@gmail.com • 7329106714

Summary
Agile-certified Product Delivery professional with enterprise banking experience supporting cross-functional QA, product, and engineering teams. Skilled in translating business requirements into prioritized backlogs, improving release readiness, and driving process optimization in regulated environments. SAFe Product Owner/Product Manager and Certified Scrum Master focused on delivering efficient, high-quality outcomes in complex systems.

Experience

J.P Morgan Chase — Wilmington, DE
AI & Process Innovation Lead | August 2025 – Present
• Integrated AI tools into QA workflows to streamline test case development, defect documentation, and validation processes, reducing documentation time by approximately 30–50%.
• Built structured prompting methods to translate business requirements and meeting discussions into clear, standardized testing artifacts used by engineering and product teams.
• Used generative AI to review requirements and draft test scenarios, improving coverage efficiency and accelerating preparation across multiple releases.
• Applied AI-assisted analysis during regression cycles to surface edge cases and clarify defect reporting, supporting faster triage and reduced rework.

J.P Morgan Chase — Wilmington, DE
Product Delivery Associate | June 2023 – Present
• Executed manual and automated test strategies for internal application releases, contributing to improved process efficiency.
• Partnered with testing leads to manage risk assessments and resolve issues, ensuring timely QA status updates.
• Forged strong cross-functional relationships with product analysts and developers to clearly define release scope and business requirements.
• Utilized Agile methodologies with JIRA and Confluence to plan sprints and track test cases, driving efficient collaboration.
• Conducted gap analysis to identify process bottlenecks, recommending workflow automation and enhancements.

Santander Bank — Holmdel, NJ
Quality Assurance Analyst | July 2020 – May 2023
• Partnered with stakeholders to refine end-to-end business processes and translate requirements into backlog-ready user stories, improving sprint planning and delivery alignment.
• Facilitated process reviews and gap analysis sessions, identifying automation opportunities and converting findings into prioritized backlog items and workflow enhancements.
• Supported Workday integration efforts through coordinated testing and cross-functional collaboration, strengthening release readiness and deployment stability.

Education

Wilmington University — Wilmington, DE
Master of Business Administration, Organizational Leadership

Stockton University — Galloway, NJ
Bachelor of Science, Computer Information Systems

Certifications & Skills

Certifications
• Certified SAFe 6 Product Owner/Product Manager (POPM), Certified Scrum Master (CSM)

Business Analysis & Documentation
• Business Process Analysis, Requirements Gathering, System Documentation, Gap Analysis, Process Flowcharts

Agile & Project Management
• Agile Methodologies, Scrum, Project Management, UAT, JIRA, Confluence

AI Workflow & Automations
• AI Agents, Gen AI, N8N, Zapier, Relevance AI, Worked to Implement Custom GPT at Chase
`;

const SAMPLE_JOB = `
Senior Associate, Product Management: Retail Bank Data
Capital One — Wilmington, DE

About the Role:
Capital One is seeking a Senior Associate Product Manager to modernize data publishing and consumption across the Retail Bank. This role focuses on building and executing the strategy to modernize how we publish and consume data.

Key Responsibilities:
• Define central data strategy for Retail Bank operations
• Develop data platforms enabling real-time, intelligent business decisions
• Collaborate with customers, engineers, designers, and data scientists
• Drive innovation through testing and iterative problem-solving
• Build community support for data initiatives
• Make strategic decisions about which problems to solve

Required Qualifications:
• Minimum 2 years working with cross-functional teams on consumer experiences
• Minimum 2 years building core product platforms for digital experiences
• Minimum 2 years digital industry experience for consumers
• Bachelor's degree or military experience

Preferred Qualifications:
• 3+ years with web and mobile platforms
• 2+ years as Product Owner in Agile processes
• MBA
• Experience with databases, ETL processes, and data infrastructure

Compensation: $101,100 - $115,400 annually plus performance-based incentives
`;

async function runPipeline() {
  console.log('\n====================================================');
  console.log('  ResumeForge AI — Pipeline Test');
  console.log('====================================================\n');

  try {
    console.log('Step 1/4 — Parsing resume...');
    const parsedResume = await parseResume(SAMPLE_RESUME);
    console.log('\n✓ Parsed Resume JSON:');
    console.log(JSON.stringify(parsedResume, null, 2));

    console.log('\n----------------------------------------------------');
    console.log('Step 2/4 — Analyzing job listing...');
    const jobAnalysis = await analyzeJob(SAMPLE_JOB);
    console.log('\n✓ Job Analysis JSON:');
    console.log(JSON.stringify(jobAnalysis, null, 2));

    console.log('\n----------------------------------------------------');
    console.log('Step 3/4 — Optimizing resume for the job...');
    const optimizedResume = await optimizeResume(parsedResume, jobAnalysis);
    console.log('\n✓ Optimized Resume JSON:');
    console.log(JSON.stringify(optimizedResume, null, 2));

    console.log('\n----------------------------------------------------');
    console.log('Step 4/4 — Generating cover letter...');
    const coverLetter = await generateCoverLetter(optimizedResume, jobAnalysis);
    console.log('\n✓ Cover Letter:');
    console.log(`Subject: ${coverLetter.subject_line}\n`);
    console.log(coverLetter.body);

    // Save raw JSON
    const output = {
      parsed_resume: parsedResume,
      job_analysis: jobAnalysis,
      optimized_resume: optimizedResume,
      cover_letter: coverLetter,
    };
    const outputDir = path.join(__dirname, '../../test-output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'pipeline-result.json'), JSON.stringify(output, null, 2));

    // Save human-readable text file
    const exp = optimizedResume.experience.map(e =>
      `${e.organization} — ${e.location}\n${e.title} | ${e.start_date} – ${e.end_date}\n${e.bullets.map(b => `  • ${b}`).join('\n')}`
    ).join('\n\n');

    const skills = [
      optimizedResume.skills.technical.length ? `Technical: ${optimizedResume.skills.technical.join(', ')}` : '',
      optimizedResume.skills.other.length ? `Other: ${optimizedResume.skills.other.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const readable = `
=====================================
  OPTIMIZED RESUME
  Target: ${jobAnalysis.job_title} @ ${jobAnalysis.company}
=====================================

--- CONTACT ---
${optimizedResume.contact.name}
${optimizedResume.contact.location}
${optimizedResume.contact.email} | ${optimizedResume.contact.phone}

--- SUMMARY ---
${optimizedResume.summary}

--- EXPERIENCE ---
${exp}

--- EDUCATION ---
${optimizedResume.education.map(e => `${e.institution} — ${e.location}\n${e.degree}`).join('\n\n')}

--- SKILLS ---
${skills}

=====================================
  COVER LETTER
=====================================

Subject: ${coverLetter.subject_line}

${coverLetter.body}
`.trim();

    fs.writeFileSync(path.join(outputDir, 'pipeline-result.txt'), readable);

    console.log('\n====================================================');
    console.log('  Pipeline complete!');
    console.log(`  Output saved to: test-output/pipeline-result.txt (readable)`);
    console.log(`                   test-output/pipeline-result.json (raw data)`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n✗ Pipeline failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runPipeline();

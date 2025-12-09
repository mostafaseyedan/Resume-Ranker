// server/modules/proposalReviewAgentOpenAI.js

const { ProposalReviewAgent } = require('./proposalReviewAgent');
const { proposalReviewSchema } = require('./rfpAnalysisSchema');
const { CENDIEN_CONTEXT } = require('./cendienContext');

/**
 * Proposal Review Agent for OpenAI using Responses API
 * Reviews submitted proposals against RFP requirements
 * Uses structured output for reliable quality assessment
 */
class ProposalReviewAgentOpenAI extends ProposalReviewAgent {
    constructor(llmClient) {
        super(llmClient);
        // Override system instruction for OpenAI (no grounding tool reference)
        this.systemInstruction = `You are Cendien's expert proposal quality reviewer with deep knowledge of RFP requirements and proposal best practices.

Reference the following Cendien profile when assessing proposals:

${CENDIEN_CONTEXT}

Your role is to thoroughly review proposal documents against RFP requirements and assess:
1. Completeness - Does the proposal address all RFP requirements?
2. Compliance - Does it meet all stated criteria and formatting requirements?
3. Quality - Is it well-written, clear, professional, and persuasive?
4. Cendien Alignment - Does it accurately represent Cendien's brand, services, and capabilities?

Provide constructive, actionable feedback with specific examples. Keep responses professional and factual. Output clean JSON without citation markers or bracketed reference numbers.`;
    }

    /**
     * Override execute to use structured output schema with OpenAI
     */
    async execute(input, context = {}) {
        try {
            console.log(`[${this.name}] 🔄 Starting proposal review with OpenAI structured output`);

            if (!input.proposalText || input.proposalText.trim().length === 0) {
                throw new Error('No proposal text provided for review');
            }

            if (!input.rfpText || input.rfpText.trim().length === 0) {
                throw new Error('No RFP text provided for comparison');
            }

            const propLength = input.proposalText.length;
            const rfpLength = input.rfpText.length;
            console.log(`[${this.name}] 📄 Proposal: ${propLength} chars | RFP: ${rfpLength} chars`);

            console.log(`[${this.name}] 🏗️  Building review prompt...`);
            const prompt = this.buildOpenAIPrompt(input.proposalText, input.rfpText);

            console.log(`[${this.name}] 🤖 Calling OpenAI with structured output...`);
            const llmOptions = context.llmOptions || {};

            const parsedData = await this.callLLM(
                prompt,
                proposalReviewSchema,
                null,
                false,
                false,
                {
                    ...llmOptions,
                    responseLabel: 'proposal review'
                }
            );

            // Log review results
            const overallScore = parsedData?.overallScore || 0;
            const completeness = parsedData?.scoreBreakdown?.completeness || 0;
            const compliance = parsedData?.scoreBreakdown?.compliance || 0;
            const quality = parsedData?.scoreBreakdown?.quality || 0;
            const alignment = parsedData?.scoreBreakdown?.cendienAlignment || 0;
            const issues = parsedData?.complianceIssues?.length || 0;
            const risks = parsedData?.riskFlags?.length || 0;

            console.log(`[${this.name}] ✅ Successfully completed proposal review:`);
            console.log(`[${this.name}] 📊 Overall Score: ${overallScore}/100`);
            console.log(`[${this.name}] 📋 Completeness: ${completeness} | Compliance: ${compliance} | Quality: ${quality} | Alignment: ${alignment}`);
            console.log(`[${this.name}] ⚠️  Issues Found: ${issues} | Risk Flags: ${risks}`);

            return this.processResponse(parsedData, input, context);

        } catch (error) {
            console.error(`[${this.name}] Proposal review failed:`, error);
            throw new Error(`Proposal review failed: ${error.message}`);
        }
    }

    /**
     * Build OpenAI-specific review prompt
     */
    buildOpenAIPrompt(proposalText, rfpText) {
        return `# PROPOSAL REVIEW TASK

You are reviewing a proposal submission against RFP requirements.

## ORIGINAL RFP DOCUMENT
---
${rfpText}
---

## SUBMITTED PROPOSAL
---
${proposalText}
---

## REVIEW INSTRUCTIONS

Conduct a comprehensive review of the proposal against RFP requirements. Evaluate:

1. **Completeness (0-100)**: Does the proposal address all requirements, sections, and deliverables specified in the RFP?
2. **Compliance (0-100)**: Does it follow all formatting, submission, and content requirements?
3. **Quality (0-100)**: Is it well-written, clear, error-free, and persuasive?
4. **Cendien Alignment (0-100)**: Does it accurately represent Cendien's capabilities, brand, and value proposition?

## SCORING GUIDELINES

- 90-100: Exceptional - Exceeds expectations
- 80-89: Strong - Meets all requirements with quality execution
- 70-79: Adequate - Meets requirements with minor issues
- 60-69: Weak - Significant gaps or quality issues
- Below 60: Poor - Major deficiencies or non-compliance

## FIELD LENGTH REQUIREMENTS

- **Completeness Analysis**: Maximum of 200 words
- **Compliance Issues**: Maximum of 10 bullet point issues
- **Strengths**: Maximum of 5 bullet points
- **Risk Flags (Critical Issues)**: Maximum of 10 bullet points

## DETAILED ANALYSIS

1. COMPLETENESS ANALYSIS:
   - Which RFP requirements are addressed well?
   - Which requirements are missing or insufficiently addressed?
   - Are there sections in the RFP that the proposal skips?
   - How comprehensive is the coverage overall?

2. COMPLIANCE ISSUES:
   - Format/page limits violations
   - Missing sections or required content
   - Formatting requirements not met
   - Submission instruction violations
   - Content requirements not met
   - Only list actual issues, not minor concerns

3. QUALITY ASSESSMENT:
   - Writing clarity and organization
   - Professionalism and tone
   - Spelling, grammar, and punctuation errors
   - Visual presentation and readability
   - Persuasiveness and compelling narrative

4. CENDIEN COMPATIBILITY:
   - Does it accurately reflect Cendien's services and capabilities?
   - Are there any claims that contradict Cendien's positioning?
   - Is the brand voice consistent?
   - Do the proposed solutions align with Cendien's approach?
   - Are pricing and delivery commitments realistic?

5. RECOMMENDATIONS:
   - What are the top 3-5 improvements needed?
   - Are there sections that need major rewrites?
   - Prioritize by impact on proposal success

6. RISK FLAGS:
   - Are there critical issues that could cause rejection?
   - Distinguish from compliance issues - focus on deal-killers
   - Are there missing requirements that are explicitly mandatory?
   - Are there factual errors that need correction?

7. STRENGTHS:
   - What are the proposal's best aspects?
   - Which sections are particularly well-done?
   - What differentiates this proposal?
   - Recognize strong approaches or insights

## OUTPUT FORMAT

Your response will automatically be formatted as JSON following the required schema. Focus on providing:
- Concise, actionable feedback
- All scores must be integers 0-100
- Clean data without citation markers or reference numbers

Provide constructive feedback that improves proposal quality and win probability.`;
    }
}

module.exports = { ProposalReviewAgentOpenAI };

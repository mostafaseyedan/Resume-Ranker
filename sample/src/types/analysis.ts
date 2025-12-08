// Analysis-related TypeScript types
// Based on server/modules/rfpAnalysisSchema.js

export interface ExecutiveSummary {
  projectOverview: string
  keyOpportunities: string[]
  criticalConcerns: string[]
  recommendedAction: string
  recommendationReasoning?: string
  estimatedValue: string
  timeframe: string
}

export interface Requirement {
  requirement: string
  cendienCapability?: string
  capabilityConfidence?: string
  capabilityScore?: number | string
  capabilityDetails: string
  priority: string
  priorityWeight?: number
}

export interface RequirementsAnalysis {
  technicalRequirements: Requirement[]
  functionalRequirements: Requirement[]
  capabilityMatch: string
  keyGaps?: string[]
  recommendedPartners?: string[]
}

export interface QuestionsClarifications {
  questions: string[]
  priorityLevel: string
  recommendedApproach: string
}

export interface Milestone {
  milestone: string
  date: string
  importance: string
}

export type TimelinePhase =
  | string
  | {
      phase?: string
      name?: string
      duration?: string
      keyDeliverables?: string[] | string
      resources?: string
    }

export interface TimelineMilestone {
  milestone?: string
  date?: string
  description?: string
  [key: string]: any
}

export interface DeadlinesTimeline {
  submissionDeadline: string
  projectStartDate?: string
  projectDuration?: string
  keyMilestones?: TimelineMilestone[]
  milestones?: TimelinePhase[]
  phaseBreakdown?: TimelinePhase[]
}

export interface Contact {
  name: string
  title: string
  role?: string
  department?: string
  email: string
  phone?: string
  influence: string
}

export interface Stakeholders {
  primaryContacts: Contact[]
  decisionMakers: Contact[]
  relationshipHistory?: string
  communicationPreferences?: string
  politicalLandscape?: string
}

export interface BudgetItem {
  category: string
  estimatedCost?: string
  amount?: string
  percentage?: string
  notes?: string
}

export interface BudgetAnalysis {
  totalBudget?: string
  budgetBreakdown?: BudgetItem[]
  cendienCostEstimate?: string
  profitabilityAnalysis?: string
  budgetRisks?: string[]
  recommendedPricing?: string
  pricingStrategy?: string
  paymentTerms?: string
  competitivePricing?: string
  costRisks?: string[]
  profitMarginEstimate?: string
  proposedPricing?: {
    totalProjectCost?: string
    implementationCost?: string
    ongoingSupportCost?: string
    monthlyRate?: string
    hourlyRates?: string
    pricingJustification?: string
  }
}

export interface Risk {
  risk: string
  likelihood: string
  impact: string
  mitigation: string
}

export interface RiskAssessment {
  technicalRisks: Risk[]
  businessRisks: Risk[]
  contractualRisks: Risk[]
  overallRiskLevel: string
  riskScore?: number
  redFlags?: string[]
}

export interface RegistrationRequirement {
  registration?: string
  certification?: string
  name?: string
  cendienStatus?: string
  authority?: string
  timeToObtain?: string
  cost?: string
  teamMemberStatus?: string
  [key: string]: any
}

export interface RegistrationRequirements {
  requiredRegistrations?: RegistrationRequirement[]
  requiredCertifications?: RegistrationRequirement[]
  complianceRequirements?: string[]
  gapsToAddress?: string[]
  complianceRisk?: string
}

export interface Competitor {
  competitor?: string
  name?: string
  strengths?: string[]
  weaknesses?: string[]
  winProbability?: string
  notes?: string
  [key: string]: any
}

export interface CompetitiveLandscape {
  cendienAdvantages?: string[]
  likelyCompetitors?: Competitor[]
  competitiveRisks?: string[]
  marketPosition?: string
  winStrategy?: string
  competitiveScoring?: {
    cendienScore?: string
    avgCompetitorScore?: string
    cendienPosition?: string
  }
}

export interface WinProbability {
  probabilityScore?: number
  confidenceLevel?: string
  summary?: string
  scoringFactors?: Array<{
    factor?: string
    weight?: number | { value?: number }
    cendienScore?: number | { value?: number }
    reasoning?: string
    [key: string]: any
  }>
  strengthAreas?: string[]
  improvementAreas?: string[]
  dealBreakers?: string[]
}

export interface ResourcePlanning {
  estimatedEffort?: string
  teamComposition?: string
  recruitmentNeeds?: string
  requiredSkills?: Array<
    | string
    | {
        skill?: string
        level?: string
        duration?: string
        availability?: string
      }
  >
  resourceGaps?: string[]
  capacityRisks?: string[]
  partnerStrategy?: string
  benchStrategy?: string
}

export interface StrategicRecommendation {
  recommendation?: string
  priority?: string
  rationale?: string
  implementation?: string
}

export interface StrategicRecommendations {
  goNoGoRecommendation?: string
  reasoning?: string
  keyActions?: string[]
  successFactors?: string[]
  alternativeStrategies?: string[]
  investmentLevel?: string
  timelineRecommendation?: string
  positioningStrategy?: string
  pursuitFocus?: string
  riskPosition?: string
}

export interface ImplementationPhase {
  phase?: string
  duration?: string
  keyDeliverables?: string[] | string
  resources?: string
  risks?: string[]
  [key: string]: any
}

export interface ImplementationRoadmap {
  phaseBreakdown?: ImplementationPhase[]
  criticalPath?: string[]
  dependencies?: string[]
  qualityGates?: string[]
  riskMitigation?: string
  successMetrics?: string[]
}

// Complete RFP Analysis Result
export interface RFPAnalysisResult {
  id: string
  rfpId: string
  rfpTitle: string
  submittedBy: string
  createdAt: string
  status: 'completed' | 'not_pursuing' | 'archived' | 'in_progress'
  provider?: string
  llmProvider?: string
  selectedProvider?: string
  model?: string
  llmModel?: string
  llmOptions?: {
    provider?: string
    model?: string
    reasoningEffort?: string
    verbosity?: string
  }

  // 13 Analysis Sections (matching backend server property names)
  executiveSummary?: ExecutiveSummary
  requirementsAnalysis?: RequirementsAnalysis
  questionsAndClarifications?: QuestionsClarifications
  deadlinesAndTimeline?: DeadlinesTimeline
  stakeholdersAndContacts?: Stakeholders
  budgetAnalysis?: BudgetAnalysis
  riskAssessment?: RiskAssessment
  registrationAndCompliance?: RegistrationRequirements
  competitiveLandscape?: CompetitiveLandscape
  winProbability?: WinProbability
  resourcePlanning?: ResourcePlanning
  strategicRecommendations?: StrategicRecommendations
  implementationRoadmap?: ImplementationRoadmap

  // Additional fields
  foiaEmailTemplate?: string
  organizationName?: string
  fileNames?: string[]
  fileCount?: number
}

// SharePoint File type
export interface SharePointFile {
  id: string
  name: string
  path: string
  size: number
  web_url: string
  download_url: string
  site_id?: string
  drive_id?: string
  created?: string
  modified?: string
}

// Analysis Progress
export interface AnalysisProgress {
  stage: string
  percentage: number
  message: string
  completedSections: string[]
}

// Proposal Review Types
export interface ProposalReviewScoreBreakdown {
  completeness: number
  compliance: number
  quality: number
  cendienAlignment: number
}

export interface ProposalReview {
  id: string
  reviewId: string
  rfpId: string
  overallScore: number
  scoreBreakdown: ProposalReviewScoreBreakdown
  completenessAnalysis: string
  complianceIssues: string[]
  qualityAssessment: string
  cendienCompatibility: string
  recommendations: string[]
  riskFlags: string[]
  strengths: string[]
  createdAt: any // Firestore Timestamp
  reviewedBy: string
  metadata?: {
    fileCount?: number
    fileNames?: string[]
    [key: string]: any
  }
  provider?: string
  model?: string
  llmReasoningEffort?: string
  llmVerbosity?: string
}

// FOIA Analysis Types
export interface FOIADetectionResult {
  cendienProposalFound: boolean
  cendienProposalIdentifier: string | null
}

export interface FOIAOverallInsights {
  winnerName: string
  winnerScore: number | null
  cendienScore: number | null
  totalBidders: number
  keyTakeaways: string[]
}

export interface FOIAPricingInfo {
  total: string
  breakdown: string
}

export interface FOIAOtherBidder {
  company: string
  total: string
  rank: number
}

export interface FOIAPricingComparison {
  winnerPricing: FOIAPricingInfo
  cendienPricing: FOIAPricingInfo | null
  otherBidders: FOIAOtherBidder[]
  analysis: string
}

export interface FOIATechnicalApproach {
  winnerApproach: string
  cendienApproach: string | null
  keyDifferences: string[]
  strengthsOfWinner: string[]
}

export interface FOIAScoringDifference {
  category: string
  winner: number
  cendien: number | null
}

export interface FOIAWinLossFactors {
  whyWinnerWon: string[]
  whyCendienLost: string[] | null
  scoringDifferences: FOIAScoringDifference[]
}

export interface FOIARecommendations {
  improvementAreas: string[]
  strengthsToLeverage: string[]
  strategicActions: string[]
}

export interface FOIABidderSummary {
  company: string
  totalScore: number
  rank: number
  technicalScore?: number
  pricingScore?: number
}

export interface FOIAAnalysis {
  id: string
  analysisId: string
  rfpId: string
  analyzedBy: string
  createdAt: any // Firestore Timestamp
  fileCount: number
  metadata?: {
    fileNames?: string[]
    [key: string]: any
  }
  provider?: string
  model?: string
  llmReasoningEffort?: string
  llmVerbosity?: string
  detectionResult: FOIADetectionResult
  overallInsights: FOIAOverallInsights
  pricingComparison: FOIAPricingComparison
  technicalApproach: FOIATechnicalApproach
  winLossFactors: FOIAWinLossFactors
  recommendations: FOIARecommendations
  bidderSummary: FOIABidderSummary[]
}

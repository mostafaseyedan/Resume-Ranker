import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import apiClient from '@/services/apiClient'
import type { RFPAnalysisResult } from '@/types/analysis'
import { extractProvider, getProviderDetails } from '@/utils/providerBadges'
import AnalysisList from './AnalysisList'
import ExecutiveSummarySection from './analysis/ExecutiveSummarySection'
import RequirementsSection from './analysis/RequirementsSection'
import QuestionsSection from './analysis/QuestionsSection'
import TimelineSection from './analysis/TimelineSection'
import StakeholdersSection from './analysis/StakeholdersSection'
import BudgetSection from './analysis/BudgetSection'
import RisksSection from './analysis/RisksSection'
import RegistrationSection from './analysis/RegistrationSection'
import CompetitionSection from './analysis/CompetitionSection'
import WinProbabilitySection from './analysis/WinProbabilitySection'
import ResourcesSection from './analysis/ResourcesSection'
import StrategySection from './analysis/StrategySection'
import ImplementationSection from './analysis/ImplementationSection'

interface AnalysisTabProps {
  rfpId: string
  sharePointUrl: string | null
  rfpTitle: string
}

type SectionKey =
  | 'executive-summary'
  | 'requirements'
  | 'questions'
  | 'timeline'
  | 'stakeholders'
  | 'budget'
  | 'risks'
  | 'registration'
  | 'competition'
  | 'win-probability'
  | 'resources'
  | 'strategy'
  | 'implementation'

const SECTION_DEFINITIONS = [
  { key: 'executive-summary', label: 'Executive Summary', dataKey: 'executiveSummary' },
  { key: 'requirements', label: 'Requirements', dataKey: 'requirementsAnalysis' },
  { key: 'questions', label: 'Questions', dataKey: 'questionsAndClarifications' },
  { key: 'timeline', label: 'Timeline', dataKey: 'deadlinesAndTimeline' },
  { key: 'stakeholders', label: 'Stakeholders', dataKey: 'stakeholdersAndContacts' },
  { key: 'budget', label: 'Budget', dataKey: 'budgetAnalysis' },
  { key: 'risks', label: 'Risks', dataKey: 'riskAssessment' },
  { key: 'registration', label: 'Registration', dataKey: 'registrationAndCompliance' },
  { key: 'competition', label: 'Competition', dataKey: 'competitiveLandscape' },
  { key: 'win-probability', label: 'Win Probability', dataKey: 'winProbability' },
  { key: 'resources', label: 'Resources', dataKey: 'resourcePlanning' },
  { key: 'strategy', label: 'Strategy', dataKey: 'strategicRecommendations' },
  { key: 'implementation', label: 'Implementation', dataKey: 'implementationRoadmap' }
] as const

const AnalysisTab = ({ rfpId }: AnalysisTabProps) => {
  const [analyses, setAnalyses] = useState<RFPAnalysisResult[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<RFPAnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('executive-summary')

  useEffect(() => {
    setSelectedAnalysis(null)
    setActiveSection('executive-summary')
    loadAnalyses()
  }, [rfpId])

  useEffect(() => {
    const handleAnalysisComplete = () => {
      console.log('Analysis complete event received, reloading analyses...')
      loadAnalyses()
    }

    window.addEventListener('rfp-analysis-complete', handleAnalysisComplete)
    return () => {
      window.removeEventListener('rfp-analysis-complete', handleAnalysisComplete)
    }
  }, [rfpId])

  const loadAnalyses = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.get('/rfp-analyses', {
        params: { rfpId }
      })

      const analysesList = response.data.analyses || []
      setAnalyses(analysesList)
    } catch (err: any) {
      console.error('Failed to load analyses:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load analyses'
      setError(errorMsg)
      toast.error('Failed to load analyses', {
        description: errorMsg
      })
    } finally {
      setLoading(false)
    }
  }

  const loadAnalysisDetail = async (analysisId: string) => {
    try {
      const detailResponse = await apiClient.get(`/rfp-analysis/${analysisId}`)
      setSelectedAnalysis(detailResponse.data)
    } catch (err: any) {
      console.error('Failed to load analysis detail:', err)
      toast.error('Failed to load analysis detail')
    }
  }

  const handleSelectAnalysis = (analysis: RFPAnalysisResult) => {
    loadAnalysisDetail(analysis.id)
  }

  const handleBackToList = () => {
    setSelectedAnalysis(null)
    setActiveSection('executive-summary')
  }

  const sections = SECTION_DEFINITIONS

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-[#9699a6]">Loading analyses...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadAnalyses}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-[#0060b9]"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!selectedAnalysis) {
    return (
      <AnalysisList
        analyses={analyses}
        loading={loading}
        onSelectAnalysis={handleSelectAnalysis}
        onAnalysisDeleted={loadAnalyses}
      />
    )
  }

  const fileNames = selectedAnalysis.fileNames || []
  const primaryFile = fileNames[0] || selectedAnalysis.rfpTitle
  const secondaryFiles = fileNames.slice(1)
  const additionalFilesCount = secondaryFiles.length
  const providerDetails = getProviderDetails(extractProvider(selectedAnalysis))

  return (
    <div className="flex flex-col">
      {/* Top context bar */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] px-4 py-3 flex items-center justify-between">
        <button
          onClick={handleBackToList}
          className="text-sm text-gray-700 dark:text-[#d5d8df] hover:text-primary flex items-center gap-2 font-medium transition-colors"
        >
          <span>←</span>
          <span>All Analyses</span>
        </button>

        <div className="text-sm text-gray-600 dark:text-[#9699a6]">
          {selectedAnalysis.submittedBy}
        </div>
      </div>

      {/* File names header */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69] px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-[#d5d8df]">{primaryFile}</h2>
          {additionalFilesCount > 0 && (
            <div className="mt-2 text-xs text-gray-600 dark:text-[#9699a6]">
              <span
                className="font-medium cursor-help"
                title={secondaryFiles.join('\n')}
              >
                {additionalFilesCount} Additional File{additionalFilesCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <img
          src={providerDetails.image}
          alt={`${providerDetails.label} badge`}
          className={`${providerDetails.iconClass} object-contain ${providerDetails.label === 'ChatGPT' ? 'dark:invert' : ''}`}
          title={providerDetails.description}
        />
      </div>

      {/* Secondary Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-[#4b4e69]">
        <nav className="flex w-full items-center gap-1 flex-wrap px-1 py-1">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key as SectionKey)}
              className={`whitespace-nowrap border-b-2 px-2 py-1.5 text-sm font-medium transition-colors ${activeSection === section.key
                  ? 'border-primary text-primary dark:border-[#69a7ef] dark:text-[#69a7ef]'
                  : 'border-transparent text-gray-500 dark:text-[#9699a6] hover:text-gray-700 dark:hover:text-[#d5d8df] hover:border-gray-300 dark:hover:border-[#4b4e69]'
                }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      <div className="py-6">
        {activeSection === 'executive-summary' && (
          <ExecutiveSummarySection data={selectedAnalysis.executiveSummary} />
        )}
        {activeSection === 'requirements' && (
          <RequirementsSection data={selectedAnalysis.requirementsAnalysis} />
        )}
        {activeSection === 'questions' && (
          <QuestionsSection
            data={selectedAnalysis.questionsAndClarifications}
            primaryContactEmail={selectedAnalysis.stakeholdersAndContacts?.primaryContacts?.[0]?.email}
            organizationName={selectedAnalysis.organizationName}
          />
        )}
        {activeSection === 'timeline' && (
          <TimelineSection data={selectedAnalysis.deadlinesAndTimeline} />
        )}
        {activeSection === 'stakeholders' && (
          <StakeholdersSection
            data={selectedAnalysis.stakeholdersAndContacts}
            foiaEmailTemplate={selectedAnalysis.foiaEmailTemplate}
            organizationName={selectedAnalysis.organizationName}
            rfpTitle={selectedAnalysis.rfpTitle}
          />
        )}
        {activeSection === 'budget' && (
          <BudgetSection data={selectedAnalysis.budgetAnalysis} />
        )}
        {activeSection === 'risks' && (
          <RisksSection data={selectedAnalysis.riskAssessment} />
        )}
        {activeSection === 'registration' && (
          <RegistrationSection data={selectedAnalysis.registrationAndCompliance} />
        )}
        {activeSection === 'competition' && (
          <CompetitionSection data={selectedAnalysis.competitiveLandscape} />
        )}
        {activeSection === 'win-probability' && (
          <WinProbabilitySection data={selectedAnalysis.winProbability} />
        )}
        {activeSection === 'resources' && (
          <ResourcesSection data={selectedAnalysis.resourcePlanning} />
        )}
        {activeSection === 'strategy' && (
          <StrategySection data={selectedAnalysis.strategicRecommendations} />
        )}
        {activeSection === 'implementation' && (
          <ImplementationSection data={selectedAnalysis.implementationRoadmap} />
        )}
      </div>
    </div>
  )
}

export default AnalysisTab

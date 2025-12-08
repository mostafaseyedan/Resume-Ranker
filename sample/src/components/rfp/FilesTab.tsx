import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { SplitButton, SplitButtonMenu, MenuItem } from '@vibe/core'
import '@vibe/core/tokens'
import apiClient from '@/services/apiClient'
import { emitNotification } from '@/utils/notificationUtils'
import { FileProcessor, FileReference, FileProcessingProgress } from '@/utils/fileProcessor'
import { BsFiletypePdf, BsFiletypeDocx, BsFiletypeXlsx } from 'react-icons/bs'
import * as Checkbox from '@radix-ui/react-checkbox'
import { AiOutlineFile } from 'react-icons/ai'

interface SharePointFile {
  id: string
  name: string
  size: number
  webUrl: string
  downloadUrl: string
  path?: string
  isFolder: boolean
  siteId?: string
  driveId?: string
  modified?: string
  created?: string
}

interface FilesTabProps {
  sharePointFolderId: string | null
  sharePointUrl: string | null
  rfpId: string // Monday RFP ID for metadata
  onAnalysisSuccess?: () => void
  onReviewSuccess?: () => void
  onFoiaSuccess?: () => void
}

const FilesTab = ({ sharePointFolderId, sharePointUrl, rfpId, onAnalysisSuccess, onReviewSuccess, onFoiaSuccess }: FilesTabProps) => {
  const [files, setFiles] = useState<SharePointFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisPhase, setAnalysisPhase] = useState<'extracting' | 'analyzing' | null>(null)
  const [progress, setProgress] = useState<FileProcessingProgress | null>(null)
  const [currentAgent, setCurrentAgent] = useState<string>('Requirement Agent')
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reviewPhase, setReviewPhase] = useState<'extracting' | 'reviewing' | null>(null)
  const [foiaReviewing, setFoiaReviewing] = useState(false)
  const [foiaPhase, setFoiaPhase] = useState<'extracting' | 'analyzing' | null>(null)
  const [analysisProvider, setAnalysisProvider] = useState<'gemini' | 'openai'>('gemini')
  const [proposalProvider, setProposalProvider] = useState<'gemini' | 'openai'>('gemini')
  const [foiaProvider, setFoiaProvider] = useState<'gemini' | 'openai'>('gemini')

  useEffect(() => {
    if (sharePointFolderId || sharePointUrl) {
      loadSharePointFiles()
    } else {
      setLoading(false)
    }
  }, [sharePointFolderId, sharePointUrl])

  // Agent progression timer for analysis phase
  useEffect(() => {
    if (analysisPhase === 'analyzing' && analysisStartTime) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - analysisStartTime

        // Agent progression: each agent gets 30 seconds except the last one
        if (elapsed < 30000) {
          setCurrentAgent('Requirement Agent')
        } else if (elapsed < 60000) {
          setCurrentAgent('Risk Assessment Agent')
        } else if (elapsed < 90000) {
          setCurrentAgent('Strategy Agent')
        } else {
          setCurrentAgent('Executive Agent')
        }
      }, 1000) // Check every second

      return () => clearInterval(interval)
    }
  }, [analysisPhase, analysisStartTime])

  const mapSharePointFile = (file: any): SharePointFile => ({
    id: file.id,
    name: file.fileName || file.name,
    size: file.size || 0,
    webUrl: file.webUrl || '',
    downloadUrl: file.downloadUrl || '',
    path: file.path || '',
    isFolder: Boolean(file.isFolder || file.type === 'folder'),
    siteId: file.siteId,
    driveId: file.driveId,
    modified: file.modified || file.lastModifiedDateTime,
    created: file.created || file.createdDateTime
  })

  // Detect file type based on filename and path with priority: FOIA > Proposal (including "signed" and "Submission" folder) > RFP
  const getFileType = (fileName: string, filePath?: string): 'FOIA' | 'Proposal' | 'RFP' => {
    const nameLower = fileName.toLowerCase()
    const pathLower = (filePath || '').toLowerCase()

    if (nameLower.includes('foia') || pathLower.includes('foia')) {
      return 'FOIA'
    }
    if (nameLower.includes('proposal') || nameLower.includes('_signed') || pathLower.includes('submission')) {
      return 'Proposal'
    }
    return 'RFP'
  }

  // Get badge styling based on file type
  const getFileTypeBadge = (fileType: 'FOIA' | 'Proposal' | 'RFP') => {
    switch (fileType) {
      case 'FOIA':
        return { bg: '#9333EA', label: 'FOIA' } // Purple
      case 'Proposal':
        return { bg: '#10B981', label: 'Proposal' } // Green
      case 'RFP':
        return { bg: '#3B82F6', label: 'RFP' } // Blue
    }
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return ''
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return ''
    }
  }

  // Get file type icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const iconProps = { className: "w-4 h-4 flex-shrink-0", style: { color: '#666' } }

    switch (ext) {
      case 'pdf':
        return <BsFiletypePdf {...iconProps} style={{ color: '#DC2626' }} />
      case 'doc':
      case 'docx':
        return <BsFiletypeDocx {...iconProps} style={{ color: '#2563EB' }} />
      case 'xls':
      case 'xlsx':
        return <BsFiletypeXlsx {...iconProps} style={{ color: '#059669' }} />
      default:
        return <AiOutlineFile {...iconProps} />
    }
  }

  const transformSharePointResponse = (data: any): SharePointFile[] => {
    const aggregated: SharePointFile[] = []

    if (data?.mainRfp) {
      aggregated.push(mapSharePointFile(data.mainRfp))
    }

    if (Array.isArray(data?.addendums)) {
      data.addendums.forEach((file: any) => {
        aggregated.push(mapSharePointFile(file))
      })
    }

    return aggregated
  }

  const fetchFilesById = async (): Promise<SharePointFile[]> => {
    if (!sharePointFolderId) {
      return []
    }

    const response = await apiClient.get(`/rfp-folder-contents/${sharePointFolderId}`)
    return transformSharePointResponse(response.data)
  }

  const fetchFilesByUrl = async (): Promise<SharePointFile[]> => {
    if (!sharePointUrl) {
      return []
    }

    const response = await apiClient.get('/rfp-folder-contents/by-url', {
      params: { url: sharePointUrl }
    })
    return transformSharePointResponse(response.data)
  }

  const loadSharePointFiles = async () => {
    try {
      setLoading(true)
      setError(null)

      let fetchedFiles: SharePointFile[] = []
      let firstError: any = null

      if (sharePointUrl) {
        try {
          fetchedFiles = await fetchFilesByUrl()
        } catch (err: any) {
          firstError = err
        }
      }

      if ((!fetchedFiles || fetchedFiles.length === 0) && sharePointFolderId) {
        try {
          fetchedFiles = await fetchFilesById()
        } catch (err: any) {
          firstError = firstError || err
        }
      }

      if ((!fetchedFiles || fetchedFiles.length === 0) && firstError) {
        throw firstError
      }

      const fileOnly = fetchedFiles.filter((file) => !file.isFolder)
      setFiles(fileOnly)
      setSelectedFiles((prev) => {
        const allowed = new Set(fileOnly.map((file) => file.id))
        const next = new Set<string>()
        prev.forEach((id) => {
          if (allowed.has(id)) {
            next.add(id)
          }
        })
        return next
      })
    } catch (err: any) {
      console.error('Failed to load SharePoint files:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load files'
      setError(errorMsg)
      toast.error('Failed to load SharePoint files', {
        description: errorMsg
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileToggle = (fileId: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }
    setSelectedFiles(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)))
    }
  }

  const downloadSharePointFile = async (fileId: string, fileName: string): Promise<File> => {
    try {
      const fileInfo = files.find((f) => f.id === fileId)

      // Get file content from SharePoint via backend
      const response = await apiClient.get(`/rfp-unprocessed-file/${fileId}`, {
        responseType: 'arraybuffer',
        params: {
          siteId: fileInfo?.siteId,
          driveId: fileInfo?.driveId
        }
      })

      // Determine MIME type based on file extension
      const extension = fileName.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        txt: 'text/plain'
      }

      const mimeType = mimeTypes[extension] || 'application/octet-stream'
      const blob = new Blob([response.data], { type: mimeType })

      return new File([blob], fileName, { type: mimeType })
    } catch (error: any) {
      console.error(`Failed to download file ${fileName}:`, error)
      throw new Error(`Failed to download ${fileName}: ${error.message}`)
    }
  }

  const deriveAnalysisTitle = (selectedFileInfos: SharePointFile[]): string => {
    if (!selectedFileInfos.length) {
      return `RFP Analysis - ${new Date().toLocaleDateString()}`
    }

    const fileNames = selectedFileInfos
      .map((file) => file.name?.trim())
      .filter((name): name is string => Boolean(name))

    if (fileNames.length === 1) {
      return fileNames[0]
    }

    const folderCandidates = selectedFileInfos
      .map((file) => {
        if (!file.path) return null
        const segments = file.path.split(/[\\/]/).filter(Boolean)
        if (segments.length <= 1) return null
        return segments[segments.length - 2]
      })
      .filter((name): name is string => Boolean(name))

    if (folderCandidates.length && new Set(folderCandidates).size === 1) {
      const folder = folderCandidates[0]
      return `${folder} (${fileNames.length} files)`
    }

    const MAX_NAMES = 3
    const displayed = fileNames.slice(0, MAX_NAMES)
    const remainder = fileNames.length - MAX_NAMES

    return remainder > 0
      ? `${displayed.join(', ')} +${remainder} more`
      : displayed.join(', ')
  }

  const handleAnalyze = async () => {
    if (selectedFiles.size === 0) {
      toast.error('No files selected', {
        description: 'Please select at least one file to analyze'
      })
      return
    }

    try {
      setAnalyzing(true)
      setError(null)
      setProgress(null)
      setAnalysisPhase('extracting')

      // Prepare file references for processing
      const selectedFileInfos = files.filter(f => selectedFiles.has(f.id))
      const selectedFileRefs: FileReference[] = selectedFileInfos.map(f => ({
        id: f.id,
        fileName: f.name
      }))

      const analysisTitle = deriveAnalysisTitle(selectedFileInfos)

      // Create FileProcessor instance
      const fileProcessor = new FileProcessor(downloadSharePointFile)

      // Extract text from all selected files with progress tracking
      const extractedTexts = await fileProcessor.extractTextFromFiles(
        selectedFileRefs,
        (progressUpdate: FileProcessingProgress) => {
          setProgress(progressUpdate)
        }
      )

      // Combine all extracted text
      const combinedText = extractedTexts.join('\n\n')

      // Switch to analyzing phase
      setAnalysisPhase('analyzing')
      setProgress(null)
      setAnalysisStartTime(Date.now()) // Start the agent timer
      setCurrentAgent('Requirement Agent') // Initialize with first agent

      // Send to RFP analysis endpoint
      const analysisResponse = await apiClient.post('/rfp-analysis', {
        rfpText: combinedText,
        rfpTitle: analysisTitle,
        rfpType: 'General',
        provider: analysisProvider,
        metadata: JSON.stringify({
          rfpId: rfpId,
          fileCount: selectedFiles.size,
          fileNames: selectedFileRefs.map(f => f.fileName)
        })
      })

      if (analysisResponse.data.success) {
        toast.success('Analysis completed successfully!', {
          description: 'Switch to the Analysis tab to view results',
          duration: 5000
        })

        emitNotification(
          'rfp_analysis_completed',
          'RFP Analysis Completed',
          `Analysis completed for ${analysisTitle}`
        )
        setSelectedFiles(new Set()) // Clear selection

        // Trigger a custom event to notify AnalysisTab to refresh
        window.dispatchEvent(new CustomEvent('rfp-analysis-complete', {
          detail: { analysisId: analysisResponse.data.analysisId }
        }))
        // Switch to Analysis tab via callback
        onAnalysisSuccess?.()
      } else {
        throw new Error(analysisResponse.data.error || 'Analysis failed')
      }
    } catch (err: any) {
      console.error('Analysis failed:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to analyze files'
      setError(errorMsg)
      toast.error('Analysis failed', {
        description: errorMsg,
        duration: 8000
      })
    } finally {
      setAnalyzing(false)
      setAnalysisPhase(null)
      setProgress(null)
      setAnalysisStartTime(null)
      setCurrentAgent('Requirement Agent')
    }
  }

  const handleReviewProposal = async () => {
    if (selectedFiles.size === 0) {
      toast.error('No files selected', {
        description: 'Please select at least one file to review'
      })
      return
    }

    try {
      setReviewing(true)
      setError(null)
      setProgress(null)
      setReviewPhase('extracting')

      // Prepare file references for processing
      const selectedFileRefs: FileReference[] = files
        .filter(f => selectedFiles.has(f.id))
        .map(f => ({
          id: f.id,
          fileName: f.name
        }))

      // Create FileProcessor instance
      const fileProcessor = new FileProcessor(downloadSharePointFile)

      // Extract text from all selected files with progress tracking
      const extractedTexts = await fileProcessor.extractTextFromFiles(
        selectedFileRefs,
        (progressUpdate: FileProcessingProgress) => {
          setProgress(progressUpdate)
        }
      )

      // Combine all extracted text
      const proposalText = extractedTexts.join('\n\n')

      // Switch to reviewing phase
      setReviewPhase('reviewing')
      setProgress(null)

      // Fetch the RFP analysis to get originalRfpFullText
      const analysisResponse = await apiClient.get('/rfp-analyses', {
        params: { rfpId: rfpId }
      })

      if (!analysisResponse.data.analyses || analysisResponse.data.analyses.length === 0) {
        throw new Error('No RFP analysis found. Please analyze the RFP first.')
      }

      // Get the most recent analysis
      const latestAnalysis = analysisResponse.data.analyses[0]

      // Fetch the full analysis details to get originalRfpFullText
      const analysisDetailResponse = await apiClient.get(`/rfp-analysis/${latestAnalysis.id}`)
      const rfpText = analysisDetailResponse.data.originalRfpFullText

      if (!rfpText) {
        throw new Error('Original RFP text not found in analysis. Please re-analyze the RFP.')
      }

      // Send to proposal review endpoint
      const reviewResponse = await apiClient.post('/proposal-review', {
        proposalText: proposalText,
        rfpText: rfpText,
        rfpId: rfpId,
        provider: proposalProvider,
        metadata: {
          fileCount: selectedFiles.size,
          fileNames: selectedFileRefs.map(f => f.fileName)
        }
      })

      if (reviewResponse.data.success) {
        toast.success('Proposal review completed successfully!', {
          description: 'Check the Proposals tab to view the review results',
          duration: 5000
        })

        emitNotification(
          'proposal_review_completed',
          'Proposal Review Completed',
          'Proposal review completed successfully'
        )
        setSelectedFiles(new Set()) // Clear selection

        // Trigger a custom event to notify ProposalsTab to refresh
        window.dispatchEvent(new CustomEvent('proposal-review-complete', {
          detail: { reviewId: reviewResponse.data.reviewId, rfpId: rfpId }
        }))
        // Switch to Proposals tab via callback
        onReviewSuccess?.()
      } else {
        throw new Error(reviewResponse.data.error || 'Review failed')
      }
    } catch (err: any) {
      console.error('Proposal review failed:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to review proposal'
      setError(errorMsg)
      toast.error('Proposal review failed', {
        description: errorMsg,
        duration: 8000
      })
    } finally {
      setReviewing(false)
      setReviewPhase(null)
      setProgress(null)
    }
  }

  const handleFOIAReview = async () => {
    if (selectedFiles.size === 0) {
      toast.error('No files selected', {
        description: 'Please select at least one FOIA file to analyze'
      })
      return
    }

    try {
      setFoiaReviewing(true)
      setError(null)
      setProgress(null)
      setFoiaPhase('extracting')

      // Prepare file references for processing
      const selectedFileRefs: FileReference[] = files
        .filter(f => selectedFiles.has(f.id))
        .map(f => ({
          id: f.id,
          fileName: f.name
        }))

      // Create FileProcessor instance
      const fileProcessor = new FileProcessor(downloadSharePointFile)

      // Extract text from all selected files with progress tracking
      const extractedTexts = await fileProcessor.extractTextFromFiles(
        selectedFileRefs,
        (progressUpdate: FileProcessingProgress) => {
          setProgress(progressUpdate)
        }
      )

      // Combine all extracted text
      const combinedFoiaText = extractedTexts.join('\n\n===== FILE SEPARATOR =====\n\n')

      // Switch to analyzing phase
      setFoiaPhase('analyzing')
      setProgress(null)

      // Send to FOIA analysis endpoint
      const analysisResponse = await apiClient.post('/foia-analysis', {
        combinedFoiaText: combinedFoiaText,
        rfpId: rfpId,
        provider: foiaProvider,
        metadata: {
          fileCount: selectedFiles.size,
          fileNames: selectedFileRefs.map(f => f.fileName)
        }
      })

      if (analysisResponse.data.success) {
        toast.success('FOIA analysis completed successfully!', {
          description: 'Check the FOIA tab to view competitive intelligence',
          duration: 5000
        })

        emitNotification(
          'foia_analysis_completed',
          'FOIA Analysis Completed',
          'FOIA analysis completed successfully'
        )
        setSelectedFiles(new Set()) // Clear selection

        // Trigger a custom event to notify FOIATab to refresh
        window.dispatchEvent(new CustomEvent('foia-analysis-complete', {
          detail: { analysisId: analysisResponse.data.analysisId, rfpId: rfpId }
        }))
        // Switch to FOIA tab via callback
        onFoiaSuccess?.()
      } else {
        throw new Error(analysisResponse.data.error || 'FOIA analysis failed')
      }
    } catch (err: any) {
      console.error('FOIA analysis failed:', err)
      const errorMsg = err.response?.data?.error || err.message || 'Failed to analyze FOIA files'
      setError(errorMsg)
      toast.error('FOIA analysis failed', {
        description: errorMsg,
        duration: 8000
      })
    } finally {
      setFoiaReviewing(false)
      setFoiaPhase(null)
      setProgress(null)
    }
  }

  const getProgressPercentage = (): number => {
    if (!progress) return 0

    // Calculate progress considering both file index and stage within each file
    // Each file has 3 stages: download (0%), process (50%), completed (100%)
    const completedFiles = progress.index - 1 // Files fully completed

    let currentFileProgress = 0
    switch (progress.stage) {
      case 'download':
        currentFileProgress = 0
        break
      case 'process':
        currentFileProgress = 0.5
        break
      case 'completed':
        currentFileProgress = 1
        break
    }

    const totalProgress = (completedFiles + currentFileProgress) / progress.total
    return Math.round(totalProgress * 100)
  }

  const getProgressMessage = (): string => {
    if (!progress) return ''

    switch (progress.stage) {
      case 'download':
        return `Downloading ${progress.fileName}... (${progress.index}/${progress.total})`
      case 'process':
        return `Processing ${progress.fileName}... (${progress.index}/${progress.total})`
      case 'completed':
        return `Completed ${progress.fileName} (${progress.index}/${progress.total})`
      default:
        return ''
    }
  }

  // Show message if no SharePoint folder is linked
  if (!sharePointFolderId && !sharePointUrl) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No SharePoint Folder Linked</h3>
        <p className="text-gray-500">
          This RFP doesn't have a SharePoint folder associated with it in Monday.com.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Please add a SharePoint link in the Monday.com board to access files.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-[#9699a6]">Loading files...</span>
      </div>
    )
  }

  if (error && files.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={loadSharePointFiles}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-[#0060b9]"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center space-x-4 text-sm">
          <button
            onClick={handleSelectAll}
            className="text-primary hover:text-[#0060b9] dark:text-[#69a7ef] dark:hover:text-[#8bbef5]"
          >
            {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-gray-600 dark:text-[#9699a6]">
            {selectedFiles.size} of {files.length} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* FOIA Review Split Button */}
          <SplitButton
            id="foia-split-button"
            ariaLabel="FOIA Review split button"
            onClick={handleFOIAReview}
            disabled={selectedFiles.size === 0 || foiaReviewing || reviewing || analyzing}
            size="small"
            kind="primary"
            className={selectedFiles.size === 0 || foiaReviewing || reviewing || analyzing ? undefined : "foia-purple-split-btn"}
            secondaryDialogPosition="bottom-end"
            secondaryDialogContent={
              <SplitButtonMenu id="foia-menu">
                <MenuItem
                  id="foia-gemini"
                  title="Gemini 3.0 (Knows everything about Cendien)"
                  onClick={() => setFoiaProvider('gemini')}
                  rightIcon={foiaProvider === 'gemini' ? () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : undefined}
                />
                <MenuItem
                  id="foia-openai"
                  title="ChatGPT 5.1 (General Knowledge)"
                  onClick={() => setFoiaProvider('openai')}
                  rightIcon={foiaProvider === 'openai' ? () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : undefined}
                />
              </SplitButtonMenu>
            }
          >
            {foiaReviewing
              ? foiaPhase === 'extracting'
                ? 'Extracting Files...'
                : 'Analyzing FOIA...'
              : 'FOIA Review'}
          </SplitButton>

          {/* Review Proposal Split Button */}
          <SplitButton
            id="proposal-split-button"
            ariaLabel="Review Proposal split button"
            onClick={handleReviewProposal}
            disabled={selectedFiles.size === 0 || reviewing || analyzing || foiaReviewing}
            size="small"
            kind="primary"
            color="positive"
            secondaryDialogPosition="bottom-end"
            secondaryDialogContent={
              <SplitButtonMenu id="proposal-menu">
                <MenuItem
                  id="proposal-gemini"
                  title="Gemini 3.0 (Knows everything about Cendien)"
                  onClick={() => setProposalProvider('gemini')}
                  rightIcon={proposalProvider === 'gemini' ? () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : undefined}
                />
                <MenuItem
                  id="proposal-openai"
                  title="ChatGPT 5.1 (General Knowledge)"
                  onClick={() => setProposalProvider('openai')}
                  rightIcon={proposalProvider === 'openai' ? () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : undefined}
                />
              </SplitButtonMenu>
            }
          >
            {reviewing
              ? reviewPhase === 'extracting'
                ? 'Extracting Files...'
                : 'Reviewing Proposal...'
              : 'Review Proposal'}
          </SplitButton>

          {/* Analyze RFP Split Button */}
          <SplitButton
            id="analysis-split-button"
            ariaLabel="Analyze RFP split button"
            onClick={handleAnalyze}
            disabled={selectedFiles.size === 0 || analyzing || reviewing || foiaReviewing}
            size="small"
            kind="primary"
            secondaryDialogPosition="bottom-end"
            secondaryDialogContent={
              <SplitButtonMenu id="analysis-menu">
                <MenuItem
                  id="analysis-gemini"
                  title="Gemini 3.0 (Knows everything about Cendien)"
                  onClick={() => setAnalysisProvider('gemini')}
                  rightIcon={analysisProvider === 'gemini' ? () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : undefined}
                />
                <MenuItem
                  id="analysis-openai"
                  title="ChatGPT 5.1 (General Knowledge)"
                  onClick={() => setAnalysisProvider('openai')}
                  rightIcon={analysisProvider === 'openai' ? () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : undefined}
                />
              </SplitButtonMenu>
            }
          >
            {analyzing
              ? analysisPhase === 'extracting'
                ? 'Extracting Files...'
                : 'Analyzing RFP...'
              : 'Analyze RFP'}
          </SplitButton>
        </div>
      </div>

      {/* Progress Bar for Analysis */}
      {analyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-800">
                {analysisPhase === 'extracting' && progress
                  ? getProgressMessage()
                  : analysisPhase === 'analyzing'
                    ? `Analyzing RFP with ${currentAgent}...`
                    : 'Processing...'}
              </span>
              {analysisPhase === 'extracting' && progress && (
                <span className="text-blue-800 font-medium">{getProgressPercentage()}%</span>
              )}
              {analysisPhase === 'analyzing' && analysisStartTime && (
                <span className="text-blue-800 font-medium">
                  {(() => {
                    const elapsed = Date.now() - analysisStartTime
                    if (elapsed < 30000) return `${Math.round((elapsed / 30000) * 25)}%`
                    if (elapsed < 60000) return `${25 + Math.round(((elapsed - 30000) / 30000) * 25)}%`
                    if (elapsed < 90000) return `${50 + Math.round(((elapsed - 60000) / 30000) * 25)}%`
                    return '75%+'
                  })()}
                </span>
              )}
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className={`bg-primary h-2 rounded-full transition-all duration-300 ${analysisPhase === 'analyzing' ? 'animate-pulse' : ''
                  }`}
                style={{
                  width:
                    analysisPhase === 'extracting' && progress
                      ? `${getProgressPercentage()}%`
                      : analysisPhase === 'analyzing' && analysisStartTime
                        ? (() => {
                          const elapsed = Date.now() - analysisStartTime
                          if (elapsed < 30000) return `${(elapsed / 30000) * 25}%`
                          if (elapsed < 60000) return `${25 + ((elapsed - 30000) / 30000) * 25}%`
                          if (elapsed < 90000) return `${50 + ((elapsed - 60000) / 30000) * 25}%`
                          return '75%'
                        })()
                        : '0%'
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar for Review */}
      {reviewing && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-800">
                {reviewPhase === 'extracting' && progress
                  ? getProgressMessage()
                  : reviewPhase === 'reviewing'
                    ? 'Reviewing proposal with AI...'
                    : 'Processing...'}
              </span>
              {reviewPhase === 'extracting' && progress && (
                <span className="text-green-800 font-medium">{getProgressPercentage()}%</span>
              )}
            </div>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div
                className={`bg-green-600 h-2 rounded-full transition-all duration-300 ${reviewPhase === 'reviewing' ? 'animate-pulse' : ''
                  }`}
                style={{
                  width:
                    reviewPhase === 'extracting' && progress
                      ? `${getProgressPercentage()}%`
                      : reviewPhase === 'reviewing'
                        ? '100%'
                        : '0%'
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar for FOIA Review */}
      {foiaReviewing && (
        <div className="bg-purple-50 border border-purple-200 rounded p-4">
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-purple-800">
                {foiaPhase === 'extracting' && progress
                  ? getProgressMessage()
                  : foiaPhase === 'analyzing'
                    ? 'Analyzing FOIA documents with AI...'
                    : 'Processing...'}
              </span>
              {foiaPhase === 'extracting' && progress && (
                <span className="text-purple-800 font-medium">{getProgressPercentage()}%</span>
              )}
            </div>
            <div className="w-full bg-purple-200 rounded-full h-2">
              <div
                className={`bg-purple-600 h-2 rounded-full transition-all duration-300 ${foiaPhase === 'analyzing' ? 'animate-pulse' : ''
                  }`}
                style={{
                  width:
                    foiaPhase === 'extracting' && progress
                      ? `${getProgressPercentage()}%`
                      : foiaPhase === 'analyzing'
                        ? '100%'
                        : '0%'
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-[#9699a6]">
          <p>No files found in SharePoint folder</p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-[#4b4e69] rounded">
          {files.map((file, index) => (
            <div
              key={file.id}
              onClick={() => !analyzing && !reviewing && !foiaReviewing && handleFileToggle(file.id)}
              className={`flex items-center bg-white dark:bg-[#30324e] p-3 transition-all cursor-pointer ${index !== files.length - 1 ? 'border-b border-gray-200 dark:border-[#4b4e69]' : ''
                } ${selectedFiles.has(file.id)
                  ? 'bg-blue-50 dark:bg-[#13377433]'
                  : 'hover:bg-gray-50 dark:hover:bg-[#323861]'
                } ${analyzing || reviewing || foiaReviewing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Checkbox.Root
                checked={selectedFiles.has(file.id)}
                disabled={analyzing || reviewing || foiaReviewing}
                aria-label="Select file"
                className="h-4 w-4 inline-flex items-center justify-center rounded border border-gray-300 dark:border-[#4b4e69] bg-white dark:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-[#69a7ef] data-[state=checked]:bg-primary dark:data-[state=checked]:bg-[#69a7ef] data-[state=checked]:border-primary dark:data-[state=checked]:border-[#69a7ef] text-white pointer-events-none"
              >
                <Checkbox.Indicator className="text-white">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </Checkbox.Indicator>
              </Checkbox.Root>

              <div className="ml-3 flex-1 flex items-start justify-between gap-3">
                {/* Left side: Badge, filename, and path */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {(() => {
                      const fileType = getFileType(file.name, file.path)
                      const badge = getFileTypeBadge(fileType)
                      return (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white flex-shrink-0"
                          style={{ backgroundColor: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      )
                    })()}
                    <a
                      href={file.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()} // Prevent file selection when clicking link
                      className="text-sm font-medium text-gray-700 dark:text-[#d5d8df] hover:text-gray-900 dark:hover:text-[#ffffff] hover:underline truncate"
                    >
                      {file.name}
                    </a>
                    {getFileIcon(file.name)}
                  </div>
                  {file.path && (
                    <div className="text-xs text-gray-500 dark:text-[#9699a6]">
                      {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/') + 1) : ''}
                    </div>
                  )}
                </div>

                {/* Right side: Size and date stacked */}
                <div className="text-xs text-gray-500 text-right flex-shrink-0">
                  <div>{Math.round(file.size / 1024)} KB</div>
                  {file.modified && (
                    <div className="mt-1">{formatDate(file.modified)}</div>
                  )}
                  {!file.modified && file.created && (
                    <div className="mt-1">{formatDate(file.created)}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sharePointUrl && (
        <div className="mt-4 text-right text-sm">
          <a
            href={sharePointUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-[#0060b9] dark:text-[#69a7ef] dark:hover:text-[#8bbcf3]"
          >
            Open SharePoint folder →
          </a>
        </div>
      )}
    </div>
  )
}

export default FilesTab

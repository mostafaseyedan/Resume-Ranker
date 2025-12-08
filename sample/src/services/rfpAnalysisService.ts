import apiClient from './apiClient'
import type { RFPAnalysisResult, AnalysisProgress } from '../types/analysis'

export const rfpAnalysisService = {
  /**
   * Get all RFP analyses
   */
  async getAllAnalyses(): Promise<RFPAnalysisResult[]> {
    try {
      const response = await apiClient.get('/rfp-analyses')
      return response.data.analyses || []
    } catch (error) {
      console.error('Failed to fetch RFP analyses:', error)
      throw error
    }
  },

  /**
   * Get a specific RFP analysis by ID
   */
  async getAnalysisById(analysisId: string): Promise<RFPAnalysisResult> {
    try {
      const response = await apiClient.get(`/rfp-analyses/${analysisId}`)
      return response.data
    } catch (error) {
      console.error(`Failed to fetch analysis ${analysisId}:`, error)
      throw error
    }
  },

  /**
   * Trigger RFP analysis for selected files
   */
  async analyzeRFP(rfpId: string, fileIds: string[]): Promise<{ analysisId: string; success: boolean }> {
    try {
      const response = await apiClient.post('/analyze-rfp', {
        rfpId,
        fileIds
      })
      return response.data
    } catch (error) {
      console.error('Failed to start RFP analysis:', error)
      throw error
    }
  },

  /**
   * Get analysis progress (for polling during analysis)
   */
  async getAnalysisProgress(analysisId: string): Promise<AnalysisProgress> {
    try {
      const response = await apiClient.get(`/rfp-analyses/${analysisId}/progress`)
      return response.data
    } catch (error) {
      console.error(`Failed to fetch analysis progress:`, error)
      throw error
    }
  },

  /**
   * Delete an RFP analysis
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    try {
      await apiClient.delete(`/rfp-analyses/${analysisId}`)
    } catch (error) {
      console.error(`Failed to delete analysis ${analysisId}:`, error)
      throw error
    }
  },

  /**
   * Update analysis status (completed, not_pursuing, archived)
   */
  async updateAnalysisStatus(
    analysisId: string,
    status: 'completed' | 'not_pursuing' | 'archived'
  ): Promise<void> {
    try {
      await apiClient.patch(`/rfp-analyses/${analysisId}/status`, { status })
    } catch (error) {
      console.error(`Failed to update analysis status:`, error)
      throw error
    }
  }
}

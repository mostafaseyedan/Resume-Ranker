import apiClient from './apiClient'

export interface MondayStatusMetadata {
  label?: string | null
  index?: number | null
  post_id?: string | null
}

export interface MondayRfpItem {
  id: string
  mondayId: string
  title: string
  fileName: string
  createdAt: string | null
  groupId?: string | null
  group?: string | null
  groupColor?: string | null
  groupPosition?: number | null
  solutionType?: string | null
  rfpType?: string | null
  rfpTypeColor?: string | null
  projectStatus?: string | null
  projectStatusColor?: string | null
  statusMetadata?: MondayStatusMetadata | null
  sharePointUrl?: string | null
  sharePointFolderId?: string | null
  proposalDue?: string | null
  source?: string
}

export const mondayService = {
  async getRFPItems(): Promise<MondayRfpItem[]> {
    try {
      const response = await apiClient.get('/monday/rfp-items')
      return response.data.items || []
    } catch (error) {
      console.error('Failed to fetch RFP items from Monday.com:', error)
      throw error
    }
  },

  async getRFPsAddedToday(): Promise<MondayRfpItem[]> {
    try {
      const items = await this.getRFPItems()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const todayItems = items.filter(item => {
        if (!item.createdAt) return false
        const createdDate = new Date(item.createdAt)
        createdDate.setHours(0, 0, 0, 0)
        return createdDate.getTime() === today.getTime()
      })

      return todayItems
    } catch (error) {
      console.error('Failed to fetch RFPs added today:', error)
      return []
    }
  },
}

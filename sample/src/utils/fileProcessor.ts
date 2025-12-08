import { envPdfProcessorUrl } from '@/utils/pdfProcessorConfig'

export type FileProcessingStage = 'download' | 'process' | 'completed'

export interface FileProcessingProgress {
  stage: FileProcessingStage
  index: number
  total: number
  fileName: string
}

export interface FileReference {
  id: string
  fileName: string
}

type DownloadFn = (fileId: string, fileName: string) => Promise<File>

const DEFAULT_BATCH_SIZE = 2
const DEFAULT_DELAY_MS = 500
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export class FileProcessor {
  private readonly downloadFn: DownloadFn
  private readonly pdfProcessorUrl: string

  constructor(downloadFn: DownloadFn, pdfProcessorUrl?: string) {
    this.downloadFn = downloadFn
    this.pdfProcessorUrl = pdfProcessorUrl ?? envPdfProcessorUrl()

    if (!this.pdfProcessorUrl) {
      throw new Error('PDF processor URL is not configured')
    }
  }

  async extractTextFromFiles(
    files: FileReference[],
    onProgress?: (progress: FileProcessingProgress) => void,
    batchSize: number = DEFAULT_BATCH_SIZE
  ): Promise<string[]> {
    const results: string[] = []

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const batchPromises = batch.map(async (fileRef, batchIndex) => {
        const globalIndex = i + batchIndex
        onProgress?.({
          stage: 'download',
          index: globalIndex + 1,
          total: files.length,
          fileName: fileRef.fileName,
        })

        const file = await this.downloadFn(fileRef.id, fileRef.fileName)

        onProgress?.({
          stage: 'process',
          index: globalIndex + 1,
          total: files.length,
          fileName: fileRef.fileName,
        })

        const content = await this.processFileByType(file)

        onProgress?.({
          stage: 'completed',
          index: globalIndex + 1,
          total: files.length,
          fileName: fileRef.fileName,
        })

        return content
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      if (i + batchSize < files.length) {
        await this.delay(DEFAULT_DELAY_MS)
      }
    }

    return results
  }

  private async processFileByType(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

    switch (extension) {
      case 'pdf':
      case 'docx':
      case 'doc':
      case 'xlsx':
      case 'xls':
        return this.processWithPdfProcessor(file, extension.toUpperCase())
      case 'txt':
        return this.processText(file)
      default:
        throw new Error(`Unsupported file type: ${extension || 'unknown'}`)
    }
  }

  private async processWithPdfProcessor(file: File, label: string, timeoutMs = 120000): Promise<string> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const formData = new FormData()
      formData.append('files', file)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(this.pdfProcessorUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status === 503 && attempt < MAX_RETRIES) {
            await this.delay(RETRY_DELAY_MS)
            continue
          }
          throw new Error(`${label} processing failed: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        const extractedText =
          result.extracted_text ?? result.markdown ?? result.text ?? result.content ?? ''

        if (!extractedText) {
          throw new Error(`No text content extracted from ${file.name}`)
        }

        return `--- Content from ${file.name} ---\n${extractedText}`
      } catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`${label} processing timed out after ${timeoutMs / 1000} seconds.`)
        }

        const message = error instanceof Error ? error.message : String(error)
        const shouldRetry = attempt < MAX_RETRIES && (message.includes('Failed to fetch') || message.includes('503'))

        if (shouldRetry) {
          await this.delay(RETRY_DELAY_MS)
          continue
        }

        if (message.includes('Failed to fetch') || message.includes('5')) {
          return `--- Content from ${file.name} ---\n[Document processing service unavailable. Please try again later.]`
        }

        throw error
      }
    }

    return `--- Content from ${file.name} ---\n[Failed to process after ${MAX_RETRIES} attempts]`
  }

  private async processText(file: File): Promise<string> {
    const text = await file.text()
    return `--- Content from ${file.name} ---\n${text}`
  }

  private delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
}

export function inferMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  const supportedMimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    txt: 'text/plain',
  }

  return supportedMimeTypes[extension] ?? 'application/octet-stream'
}

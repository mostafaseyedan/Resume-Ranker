import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  DEFAULT_JOB_INFOGRAPHIC_VISUAL_THEME,
  JobInfographicVisualTheme,
} from '@/lib/jobInfographicThemes';
import {
  apiService,
  Job,
  JobInfographic,
  JobInfographicAspectRatio,
  JobInfographicQuality,
} from '../services/apiService';

export type JobInfographicDialogMode = 'view' | 'generate';

type DialogState = {
  open: boolean;
  mode: JobInfographicDialogMode;
};

export function useJobInfographic(job: Job, onJobUpdated?: (job: Job) => void) {
  const [generatingInfographic, setGeneratingInfographic] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    mode: 'generate',
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  // null = latest (job.infographic); otherwise a specific version's file_id.
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<JobInfographicAspectRatio>(
    job.infographic?.aspect_ratio || '3:4'
  );
  const [imageQuality, setImageQuality] = useState<JobInfographicQuality>(
    job.infographic?.image_quality || '2K'
  );
  const [visualTheme, setVisualTheme] = useState<JobInfographicVisualTheme>(
    (job.infographic?.visual_theme as JobInfographicVisualTheme) ||
      DEFAULT_JOB_INFOGRAPHIC_VISUAL_THEME
  );

  const dialogOpen = dialogState.open;
  const dialogMode = dialogState.mode;

  // The record currently being viewed: the selected version, or the latest.
  const selectedInfographic = useMemo<JobInfographic | undefined>(() => {
    const latest = job.infographic;
    if (!selectedFileId) return latest;
    const all = [latest, ...(job.infographic_versions || [])].filter(
      (r): r is JobInfographic => Boolean(r)
    );
    return all.find((r) => r.file_id === selectedFileId) || latest;
  }, [selectedFileId, job.infographic, job.infographic_versions]);

  const selectVersion = useCallback((fileId: string | null) => {
    setSelectedFileId(fileId);
  }, []);

  useEffect(() => {
    setAspectRatio(job.infographic?.aspect_ratio || '3:4');
    setImageQuality(job.infographic?.image_quality || '2K');
    setVisualTheme(
      (job.infographic?.visual_theme as JobInfographicVisualTheme) ||
        DEFAULT_JOB_INFOGRAPHIC_VISUAL_THEME
    );
  }, [
    job.id,
    job.infographic?.aspect_ratio,
    job.infographic?.image_quality,
    job.infographic?.visual_theme,
  ]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const applyPreviewBlob = useCallback((blob: Blob) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }, []);

  useEffect(() => {
    if (!dialogOpen || dialogMode !== 'view' || !job.infographic) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPreview(true);
      try {
        const blob = await apiService.downloadJobInfographicBlob(
          job.id,
          selectedFileId ?? undefined
        );
        if (cancelled) return;
        applyPreviewBlob(blob);
      } catch {
        if (!cancelled) {
          toast.error('Failed to load poster preview');
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    dialogOpen,
    dialogMode,
    job.id,
    job.infographic?.generated_at,
    selectedFileId,
    applyPreviewBlob,
  ]);

  const openDialog = useCallback((mode: JobInfographicDialogMode) => {
    setSelectedFileId(null);
    setDialogState({ open: true, mode });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }));
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLoadingPreview(false);
  }, []);

  const switchDialogMode = useCallback((mode: JobInfographicDialogMode) => {
    setDialogState((prev) => ({ ...prev, mode }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!job.description?.trim()) {
      toast.error('Add a job description before generating a poster');
      return;
    }
    setGeneratingInfographic(true);
    try {
      const response = await apiService.generateJobInfographic(job.id, {
        visualTheme,
        aspectRatio,
        imageQuality,
      });
      if (response.job && onJobUpdated) {
        onJobUpdated(response.job);
      }
      if (response.image_base64) {
        const binary = atob(response.image_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const mime = response.infographic?.mime_type || 'image/png';
        applyPreviewBlob(new Blob([bytes], { type: mime }));
      }
      const savedToSharePoint = Boolean(response.infographic?.sharepoint_web_url);
      toast.success(
        savedToSharePoint
          ? 'Poster generated and saved to the job SharePoint folder'
          : 'Poster generated, but SharePoint save is unavailable'
      );
      setSelectedFileId(null); // show the freshly generated poster, not a previously viewed version
      setDialogState({ open: true, mode: 'view' });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to generate poster');
      toast.error(message);
    } finally {
      setGeneratingInfographic(false);
    }
  }, [job.id, job.description, visualTheme, aspectRatio, imageQuality, onJobUpdated, applyPreviewBlob]);

  const handleDeleteVersion = useCallback(async () => {
    const fileId = selectedInfographic?.file_id;
    if (!fileId) {
      toast.error('This version cannot be deleted (not saved to SharePoint)');
      return;
    }
    setDeleting(true);
    try {
      const response = await apiService.deleteJobInfographicVersion(job.id, fileId);
      if (response.job && onJobUpdated) {
        onJobUpdated(response.job);
      }
      setSelectedFileId(null);
      toast.success('Poster version deleted');
      if (!response.job?.infographic) {
        closeDialog();
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete poster';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }, [job.id, selectedInfographic, onJobUpdated, closeDialog]);

  const handleDownload = useCallback(async () => {
    const record = selectedInfographic;
    const filename =
      record?.filename ||
      `hiring_infographic_${job.title.replace(/[^\w-]+/g, '_').slice(0, 60)}.png`;
    try {
      // Session-only version (never saved to SharePoint): can only be downloaded
      // from the in-memory preview blob.
      if (!record?.sharepoint_web_url && previewUrl) {
        const anchor = document.createElement('a');
        anchor.href = previewUrl;
        anchor.download = filename;
        anchor.click();
        toast.success('Poster downloaded');
        return;
      }

      const blob = await apiService.downloadJobInfographicBlob(
        job.id,
        selectedFileId ?? undefined
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Poster downloaded');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to download poster';
      toast.error(message);
    }
  }, [job.id, job.title, selectedInfographic, selectedFileId, previewUrl]);

  return {
    generatingInfographic,
    dialogOpen,
    dialogMode,
    openDialog,
    switchDialogMode,
    closeDialog,
    previewUrl,
    loadingPreview,
    aspectRatio,
    setAspectRatio,
    imageQuality,
    setImageQuality,
    visualTheme,
    setVisualTheme,
    handleGenerate,
    handleDownload,
    handleDeleteVersion,
    deleting,
    selectedInfographic,
    activeFileId: selectedFileId,
    selectVersion,
    canGenerate: Boolean(job.description?.trim()),
    hasInfographic: Boolean(job.infographic),
  };
}

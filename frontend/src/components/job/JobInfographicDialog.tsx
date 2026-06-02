import React, { useEffect, useState } from 'react';
import { Button } from '@vibe/core';
import '@vibe/core/tokens';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  sectionCardBodyClass,
  sectionCardTitleClass,
} from '../analysis/sectionLayout';
import { focusVisibleRing, loadingText, loadingWell, spinner } from '@/lib/semanticColors';
import { cn } from '@/lib/utils';
import { radiusControl } from '@/lib/radius';
import {
  JOB_INFOGRAPHIC_VISUAL_THEMES,
  JobInfographicVisualTheme,
  JOB_INFOGRAPHIC_QUALITY_OPTIONS,
  posterQualityLabel,
} from '@/lib/jobInfographicThemes';
import type { JobInfographicDialogMode } from '@/hooks/useJobInfographic';
import {
  apiService,
  Job,
  JobInfographic,
  JobInfographicAspectRatio,
  JobInfographicQuality,
} from '../../services/apiService';

const visualThemeLabel = (slug: string) =>
  JOB_INFOGRAPHIC_VISUAL_THEMES.find((t) => t.value === slug)?.text ?? slug;

const aspectRatioOptions = [
  { value: '3:4', text: 'Vertical social' },
  { value: '16:9', text: 'LinkedIn banner' },
] as const;

interface JobInfographicHeaderActionsProps {
  hasInfographic: boolean;
  canGenerate: boolean;
  generating: boolean;
  onRegenerate: () => void;
  onView: () => void;
}

export const JobInfographicHeaderActions: React.FC<JobInfographicHeaderActionsProps> = ({
  hasInfographic,
  canGenerate,
  generating,
  onRegenerate,
  onView,
}) => (
  <>
    {hasInfographic ? (
      <Button
        onClick={onRegenerate}
        size="small"
        kind="primary"
        disabled={generating || !canGenerate}
        ariaLabel="Open poster regeneration options"
        loading={generating}
      >
        Regenerate poster
      </Button>
    ) : (
      <Button
        onClick={onRegenerate}
        size="small"
        kind="primary"
        disabled={generating || !canGenerate}
        ariaLabel={
          canGenerate ? 'Generate hiring poster' : 'Add a job description before generating'
        }
        loading={generating}
      >
        Generate poster
      </Button>
    )}
    {hasInfographic && (
      <Button onClick={onView} size="small" kind="secondary" ariaLabel="View hiring poster">
        View poster
      </Button>
    )}
  </>
);

interface JobInfographicDialogProps {
  job: Job;
  open: boolean;
  mode: JobInfographicDialogMode;
  onOpenChange: (open: boolean) => void;
  onSwitchToView?: () => void;
  previewUrl: string | null;
  loadingPreview: boolean;
  generating: boolean;
  canGenerate: boolean;
  /** The record currently being previewed (selected version, or latest). */
  selectedInfographic?: JobInfographic;
  /** file_id of the version being viewed; null = latest. */
  activeFileId: string | null;
  onSelectVersion: (fileId: string | null) => void;
  onDownload: () => void;
  onDeleteVersion: () => void;
  deleting: boolean;
  onGenerate: () => void;
  aspectRatio: JobInfographicAspectRatio;
  onAspectRatioChange: (value: JobInfographicAspectRatio) => void;
  imageQuality: JobInfographicQuality;
  onImageQualityChange: (value: JobInfographicQuality) => void;
  visualTheme: JobInfographicVisualTheme;
  onVisualThemeChange: (value: JobInfographicVisualTheme) => void;
}

function PosterMetadata({
  infographic,
  visualTheme,
  aspectRatio,
  imageQuality,
}: {
  infographic: JobInfographic;
  visualTheme: JobInfographicVisualTheme;
  aspectRatio: JobInfographicAspectRatio;
  imageQuality: JobInfographicQuality;
}) {
  const ratio = (infographic.aspect_ratio || aspectRatio) as JobInfographicAspectRatio;
  const quality = (infographic.image_quality || imageQuality) as JobInfographicQuality;

  return (
    <p className={cn(sectionCardBodyClass, 'shrink-0 text-xs text-gray-500 dark:text-ink-muted')}>
      {visualThemeLabel(infographic.visual_theme || visualTheme)} · {ratio} ·{' '}
      {posterQualityLabel(ratio, quality)}
    </p>
  );
}

function PosterPreviewFrame({
  jobTitle,
  previewUrl,
  loadingPreview,
  emptyMessage,
}: {
  jobTitle: string;
  previewUrl: string | null;
  loadingPreview: boolean;
  emptyMessage: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      {loadingPreview && (
        <div
          className={cn(
            loadingWell,
            'flex items-center justify-center gap-2 border-0 bg-transparent'
          )}
        >
          <div className={cn('h-5 w-5 animate-spin rounded-full border-2', spinner)} />
          <span className={loadingText}>Loading preview...</span>
        </div>
      )}
      {!loadingPreview && previewUrl && (
        <img
          src={previewUrl}
          alt={`Hiring poster for ${jobTitle}`}
          className="block max-h-full max-w-full object-contain"
          draggable={false}
        />
      )}
      {!loadingPreview && !previewUrl && (
        <p className={cn(sectionCardBodyClass, 'p-4 text-center text-sm')}>{emptyMessage}</p>
      )}
    </div>
  );
}

function VersionThumbnail({
  jobId,
  version,
  label,
  active,
  onSelect,
}: {
  jobId: string;
  version: JobInfographic;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const fileId = version.file_id;

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    apiService
      .downloadJobInfographicBlob(jobId, fileId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        /* leave the placeholder in place */
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [jobId, fileId]);

  const title = `${label} — ${visualThemeLabel(version.visual_theme || '')} · ${version.aspect_ratio || '3:4'}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      aria-label={title}
      title={title}
      className={cn(
        'relative h-20 shrink-0 overflow-hidden border bg-gray-50 transition-all dark:bg-canvas-deep',
        radiusControl,
        focusVisibleRing,
        active
          ? 'border-brand ring-2 ring-brand'
          : 'border-gray-200 hover:border-gray-400 dark:border-line dark:hover:border-ink-muted'
      )}
      style={{ aspectRatio: (version.aspect_ratio || '3:4').replace(':', ' / ') }}
    >
      {url ? (
        <img src={url} alt={title} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-surface-raised" />
      )}
    </button>
  );
}

type SegmentedOption<T extends string> = {
  value: T;
  text: string;
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-1 border border-gray-200 bg-gray-50 p-1 shadow-inner dark:border-line dark:bg-canvas',
        radiusControl,
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-8 whitespace-nowrap px-3 text-sm font-medium transition-colors',
              radiusControl,
              focusVisibleRing,
              selected
                ? 'bg-white text-brand shadow-sm ring-1 ring-gray-200 dark:bg-surface-raised dark:text-brand-on-dark dark:ring-line'
                : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-ink-muted dark:hover:bg-surface dark:hover:text-ink'
            )}
          >
            {option.text}
          </button>
        );
      })}
    </div>
  );
}

function OptionField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <h3 className={cn(sectionCardTitleClass, 'pt-2')}>{label}</h3>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GenerateOptionsPanel({
  visualTheme,
  onVisualThemeChange,
  aspectRatio,
  onAspectRatioChange,
  imageQuality,
  onImageQualityChange,
}: {
  visualTheme: JobInfographicVisualTheme;
  onVisualThemeChange: (value: JobInfographicVisualTheme) => void;
  aspectRatio: JobInfographicAspectRatio;
  onAspectRatioChange: (value: JobInfographicAspectRatio) => void;
  imageQuality: JobInfographicQuality;
  onImageQualityChange: (value: JobInfographicQuality) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <OptionField label="Visual theme">
        <SegmentedControl
          options={JOB_INFOGRAPHIC_VISUAL_THEMES}
          value={visualTheme}
          onChange={onVisualThemeChange}
        />
      </OptionField>
      <OptionField label="Aspect ratio">
        <SegmentedControl
          options={aspectRatioOptions}
          value={aspectRatio}
          onChange={onAspectRatioChange}
        />
      </OptionField>
      <OptionField label="Quality">
        <SegmentedControl
          options={JOB_INFOGRAPHIC_QUALITY_OPTIONS}
          value={imageQuality}
          onChange={onImageQualityChange}
        />
      </OptionField>
    </div>
  );
}

export const JobInfographicDialog: React.FC<JobInfographicDialogProps> = ({
  job,
  open,
  mode,
  onOpenChange,
  onSwitchToView,
  previewUrl,
  loadingPreview,
  generating,
  canGenerate,
  selectedInfographic,
  activeFileId,
  onSelectVersion,
  onDownload,
  onDeleteVersion,
  deleting,
  onGenerate,
  aspectRatio,
  onAspectRatioChange,
  imageQuality,
  onImageQualityChange,
  visualTheme,
  onVisualThemeChange,
}) => {
  const infographic: JobInfographic | undefined = job.infographic;
  // The record actually on screen: the selected version, or the latest.
  const viewed = selectedInfographic ?? infographic;
  const versions = job.infographic_versions || [];
  // Only versions saved to SharePoint can be re-fetched as thumbnails.
  const selectableVersions = versions.filter((v) => v.file_id);
  const effectiveFileId = activeFileId ?? infographic?.file_id ?? null;
  const isViewMode = mode === 'view';
  const isGenerateMode = mode === 'generate';
  const canDelete = Boolean(viewed?.file_id);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Reset the confirm prompt when the dialog opens/closes or the viewed version changes.
  useEffect(() => {
    setConfirmingDelete(false);
  }, [open, mode, activeFileId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(92dvh,calc(100dvh-1.5rem))] w-[min(44rem,calc(100vw-1.5rem))] max-w-none flex-col gap-0 overflow-hidden p-0',
          isViewMode && 'w-[min(64rem,calc(100vw-1.5rem))]',
          isViewMode && 'h-[min(92dvh,calc(100dvh-1.5rem))]'
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="line-clamp-2 pr-6">{job.title}</DialogTitle>
          {isViewMode && viewed && (
            <PosterMetadata
              infographic={viewed}
              visualTheme={visualTheme}
              aspectRatio={aspectRatio}
              imageQuality={imageQuality}
            />
          )}
          {isGenerateMode && (
            <DialogDescription className="sr-only">Poster generation options</DialogDescription>
          )}
        </DialogHeader>

        {isGenerateMode && (
          <div key="generate" className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <GenerateOptionsPanel
              visualTheme={visualTheme}
              onVisualThemeChange={onVisualThemeChange}
              aspectRatio={aspectRatio}
              onAspectRatioChange={onAspectRatioChange}
              imageQuality={imageQuality}
              onImageQualityChange={onImageQualityChange}
            />
          </div>
        )}

        {isViewMode && (
          <div
            key="view"
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4"
          >
            {infographic ? (
              <>
                <PosterPreviewFrame
                  jobTitle={job.title}
                  previewUrl={previewUrl}
                  loadingPreview={loadingPreview}
                  emptyMessage="Preview unavailable. Try downloading or regenerating."
                />
                <div className="min-h-0 shrink-0 overflow-y-auto">
                  {!viewed?.sharepoint_web_url && (
                    <p
                      className={cn(
                        sectionCardBodyClass,
                        'text-xs text-amber-700 dark:text-amber-300'
                      )}
                    >
                      This version is only in the current session preview (not saved to SharePoint).
                    </p>
                  )}
                  {selectableVersions.length > 1 && (
                    <div className="mt-1">
                      <h3 className={sectionCardTitleClass}>Versions</h3>
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {selectableVersions.slice(0, 10).map((version) => {
                          const originalIndex = versions.indexOf(version);
                          return (
                            <VersionThumbnail
                              key={version.file_id || version.version || originalIndex}
                              jobId={job.id}
                              version={version}
                              label={
                                originalIndex === 0
                                  ? 'Latest'
                                  : `Version ${version.version || originalIndex + 1}`
                              }
                              active={version.file_id === effectiveFileId}
                              onSelect={() => onSelectVersion(version.file_id ?? null)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className={cn(sectionCardBodyClass, 'text-sm')}>
                No poster yet. Use Generate poster to create one.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 justify-between sm:justify-between">
          {isViewMode ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {canDelete &&
                  (confirmingDelete ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 dark:text-ink-muted">
                        Delete this version?
                      </span>
                      <Button
                        onClick={onDeleteVersion}
                        size="small"
                        kind="primary"
                        color="negative"
                        loading={deleting}
                        disabled={deleting}
                      >
                        Confirm
                      </Button>
                      <Button
                        onClick={() => setConfirmingDelete(false)}
                        size="small"
                        kind="tertiary"
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <Button
                      onClick={() => setConfirmingDelete(true)}
                      size="small"
                      kind="tertiary"
                      color="negative"
                    >
                      Delete
                    </Button>
                  ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => onOpenChange(false)} size="small" kind="secondary">
                  Close
                </Button>
                <Button
                  onClick={onDownload}
                  size="small"
                  kind="primary"
                  disabled={
                    !viewed || loadingPreview || (!viewed.sharepoint_web_url && !previewUrl)
                  }
                >
                  Download
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={() => onOpenChange(false)}
                size="small"
                kind="tertiary"
                disabled={generating}
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                {infographic && onSwitchToView && (
                  <Button onClick={onSwitchToView} size="small" kind="secondary" disabled={generating}>
                    View current
                  </Button>
                )}
                <Button
                  onClick={onGenerate}
                  size="small"
                  kind="primary"
                  disabled={generating || !canGenerate}
                  loading={generating}
                >
                  {infographic ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

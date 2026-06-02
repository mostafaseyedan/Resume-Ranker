import type {
  JobInfographicAspectRatio,
  JobInfographicQuality,
} from '../services/apiService';

/** Must match backend `THEME_VARIANTS` keys in `job_infographic_service.py`. */
export const JOB_INFOGRAPHIC_VISUAL_THEMES = [
  { value: 'corporate-modular', text: 'Corporate modular' },
  { value: 'soft-3d-glossy', text: 'Soft 3D glossy' },
  { value: 'photo-overlay', text: 'Photo overlay' },
  { value: 'editorial-magazine', text: 'Editorial magazine' },
  { value: 'isometric', text: 'Isometric' },
] as const;

export type JobInfographicVisualTheme =
  (typeof JOB_INFOGRAPHIC_VISUAL_THEMES)[number]['value'];

export const DEFAULT_JOB_INFOGRAPHIC_VISUAL_THEME: JobInfographicVisualTheme =
  'corporate-modular';

/** Gemini 3 image output sizes (Google image generation docs). */
const GEMINI_POSTER_PIXELS: Record<
  JobInfographicAspectRatio,
  Record<JobInfographicQuality, { width: number; height: number }>
> = {
  '3:4': {
    '1K': { width: 896, height: 1200 },
    '2K': { width: 1792, height: 2400 },
    '4K': { width: 3584, height: 4800 },
  },
  '16:9': {
    '1K': { width: 1376, height: 768 },
    '2K': { width: 2752, height: 1536 },
    '4K': { width: 5504, height: 3072 },
  },
};

export function posterPixelSize(
  aspectRatio: JobInfographicAspectRatio,
  quality: JobInfographicQuality
): string {
  const { width, height } = GEMINI_POSTER_PIXELS[aspectRatio][quality];
  return `${width}×${height}`;
}

/** Button labels match API `image_size` / `image_quality` values. */
export const JOB_INFOGRAPHIC_QUALITY_OPTIONS = [
  { value: '1K' as const, text: '1K' },
  { value: '2K' as const, text: '2K' },
  { value: '4K' as const, text: '4K' },
];

export function posterQualityLabel(
  aspectRatio: JobInfographicAspectRatio,
  quality: JobInfographicQuality
): string {
  return `${quality} (${posterPixelSize(aspectRatio, quality)})`;
}

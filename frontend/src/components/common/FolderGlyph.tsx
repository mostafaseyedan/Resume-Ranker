type FolderGlyphProps = {
  className?: string;
};

export function FolderGlyph({ className = '' }: FolderGlyphProps) {
  return (
    <span className={`relative inline-block h-4 w-5 shrink-0 ${className}`} aria-hidden>
      <span className="absolute left-0.5 top-0 h-1.5 w-2.5 rounded-t-sm bg-amber-300" />
      <span className="absolute inset-x-0 bottom-0 h-3 rounded-sm bg-amber-400 shadow-[inset_0_-1px_0_rgba(146,64,14,0.28)] dark:bg-amber-300" />
    </span>
  );
}

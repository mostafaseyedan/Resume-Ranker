import React, { useEffect, useRef, useState } from 'react';

const CENDIEN_APPS = [
  { label: 'RFPHub', href: 'https://reconrfp.cendien.com' },
  { label: 'SalesIQ', href: 'https://sales.cendien.com' },
  { label: 'Monday', href: 'https://cendien.monday.com/boards/18004940852' },
  { label: 'RAG', href: 'https://rag.cendien.com' },
] as const;

const linkClassName =
  'block rounded-md px-3 py-2 text-sm font-medium text-gray-700 dark:text-ink transition-colors hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-white';

const desktopLinkClassName =
  'rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-white';

const CendienAppsNav: React.FC = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <>
      <nav className="hidden md:flex items-center gap-1 text-sm text-gray-600 dark:text-ink-muted">
        {CENDIEN_APPS.map((app) => (
          <a
            key={app.href}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className={desktopLinkClassName}
          >
            {app.label}
          </a>
        ))}
      </nav>

      <div ref={rootRef} className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md px-2 py-1 text-sm font-medium text-gray-600 dark:text-ink-muted transition-colors hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-white"
          aria-expanded={open}
          aria-haspopup="true"
        >
          Apps
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border border-gray-200 dark:border-line bg-white dark:bg-surface py-1 shadow-elev-2"
          >
            {CENDIEN_APPS.map((app) => (
              <a
                key={app.href}
                role="menuitem"
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
                onClick={() => setOpen(false)}
              >
                {app.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default CendienAppsNav;

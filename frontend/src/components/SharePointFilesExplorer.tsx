import React, { useMemo, useState } from 'react';
import { Label, Checkbox } from '@vibe/core';
import { PDF, File as FileIcon, Doc, Table } from '@vibe/icons';
import { Icon } from '@vibe/core';
import '@vibe/core/tokens';
import { FolderGlyph } from './common/FolderGlyph';
import EmptyState from './common/EmptyState';
import {
  countFilesUnderFolder,
  getSharePointFileKey,
  getSharePointFilePath,
  partitionFilesByPath,
  type SharePointFileLike,
} from '../utils/sharepointFolderNav';
import { cn } from '@/lib/utils';
import { radiusControl, radiusPill, radiusSurface } from '@/lib/radius';
import { textPrimary } from '@/lib/semanticColors';

export type SharePointExplorerFile = SharePointFileLike & {
  web_url?: string;
  size?: number;
  site_id?: string;
  drive_id?: string;
};

export type SharePointFileKind = 'job' | 'resume' | null;

interface SharePointFilesExplorerProps {
  files: SharePointExplorerFile[];
  selectedKeys: Set<string>;
  onToggleFile: (key: string) => void;
  getFileKind: (file: SharePointExplorerFile) => SharePointFileKind;
  navigationDisabled?: boolean;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <Icon icon={PDF} iconSize={16} className="shrink-0 text-red-600" />;
  if (ext === 'doc' || ext === 'docx') return <Icon icon={Doc} iconSize={16} className={cn('shrink-0', textPrimary)} />;
  if (ext === 'xls' || ext === 'xlsx') return <Icon icon={Table} iconSize={16} className="shrink-0 text-emerald-600" />;
  return <Icon icon={FileIcon} iconSize={16} className="shrink-0 text-gray-500 dark:text-ink-muted" />;
}

const SharePointFilesExplorer: React.FC<SharePointFilesExplorerProps> = ({
  files,
  selectedKeys,
  onToggleFile,
  getFileKind,
  navigationDisabled = false,
}) => {
  const [currentPath, setCurrentPath] = useState('');

  const { subFolders, filesInFolder } = useMemo(
    () => partitionFilesByPath(files, currentPath),
    [files, currentPath]
  );

  const breadcrumbs = currentPath ? currentPath.split('/') : [];
  const parentPath = breadcrumbs.slice(0, -1).join('/');
  if (files.length === 0) {
    return (
      <div className={cn(radiusSurface, 'border border-dashed border-gray-300 dark:border-line bg-gray-50 dark:bg-canvas')}>
        <EmptyState
          icon={<FolderGlyph />}
          title="No files found"
          description="This SharePoint folder does not contain files yet."
          className="py-10"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 border-y border-gray-200 dark:border-line py-2',
          currentPath ? 'justify-between' : 'justify-start'
        )}
      >
        {currentPath && (
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setCurrentPath(parentPath)}
              className={cn(
                'mr-1 inline-flex h-7 items-center gap-1 px-1 pr-3 text-brand transition-colors hover:text-brand-hover dark:text-brand-on-dark',
                radiusControl
              )}
              aria-label="Up one folder"
            >
              <span aria-hidden>↑</span>
              <span>Up</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentPath('')}
              className={cn(
                'inline-flex h-7 max-w-full items-center px-1 text-brand transition-colors hover:text-brand-hover dark:text-brand-on-dark',
                radiusControl
              )}
            >
              <span className="truncate">Root</span>
            </button>
            <span className="text-gray-400 dark:text-ink-faint">/</span>
            {breadcrumbs.map((segment, index) => {
              const target = breadcrumbs.slice(0, index + 1).join('/');
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={target} className="flex min-w-0 items-center gap-1">
                  {isLast ? (
                    <span
                      className={cn(
                        'inline-flex h-7 max-w-[18rem] items-center px-1 font-medium text-gray-900 dark:text-ink',
                        radiusControl
                      )}
                    >
                      <span className="truncate">{segment}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCurrentPath(target)}
                      className={cn(
                        'inline-flex h-7 max-w-[14rem] items-center px-2 text-brand transition-colors hover:bg-gray-100 dark:hover:bg-surface-hover dark:text-brand-on-dark',
                        radiusControl
                      )}
                    >
                      <span className="truncate">{segment}</span>
                    </button>
                  )}
                  {!isLast && <span className="text-gray-400 dark:text-ink-faint">/</span>}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-ink-muted">
          <span>
            {subFolders.length} {subFolders.length === 1 ? 'folder' : 'folders'}
          </span>
          <span className="text-gray-300 dark:text-ink-faint">·</span>
          <span>
            {filesInFolder.length} {filesInFolder.length === 1 ? 'file' : 'files'}
          </span>
          <span className="text-gray-300 dark:text-ink-faint">·</span>
          <span>{selectedKeys.size} selected</span>
        </div>
      </div>

      {subFolders.length === 0 && filesInFolder.length === 0 ? (
        <div className={cn(radiusSurface, 'border border-gray-200 dark:border-line bg-white dark:bg-surface')}>
          <EmptyState icon={<FolderGlyph />} title="This folder is empty" className="py-10" />
        </div>
      ) : (
        <div
          className={cn(
            'overflow-hidden border border-gray-200 dark:border-line bg-white dark:bg-surface divide-y divide-gray-200 dark:divide-line',
            radiusSurface
          )}
        >
          {subFolders.map((folderName) => {
            const count = countFilesUnderFolder(files, currentPath, folderName);
            return (
              <button
                key={`folder-${folderName}`}
                type="button"
                disabled={navigationDisabled}
                onClick={() => setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName)}
                className="group flex w-full items-center gap-3 bg-white dark:bg-surface p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-surface-hover disabled:opacity-50"
              >
                <FolderGlyph />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-ink">
                  {folderName}
                </span>
                <span
                  className={cn(
                    'shrink-0 bg-gray-100 dark:bg-surface-raised px-2 py-0.5 text-xs text-gray-600 dark:text-ink-muted',
                    radiusPill
                  )}
                >
                  {count} {count === 1 ? 'file' : 'files'}
                </span>
              </button>
            );
          })}

          {filesInFolder.map((file) => {
            const key = getSharePointFileKey(file);
            const isSelected = selectedKeys.has(key);
            const fileKind = getFileKind(file);

            return (
              <div
                key={key}
                onClick={() => !navigationDisabled && onToggleFile(key)}
                className={cn(
                  'flex cursor-pointer items-center p-3 transition-colors',
                  isSelected ? 'bg-brand-soft/60 dark:bg-brand/15' : 'hover:bg-gray-50 dark:hover:bg-surface-hover',
                  navigationDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className="pointer-events-none flex-shrink-0">
                  <Checkbox checked={isSelected} />
                </div>
                <div className="ml-3 shrink-0">{getFileIcon(file.name)}</div>
                <div className="ml-3 flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <a
                        href={file.web_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-ink hover:text-brand hover:underline dark:hover:text-brand-on-dark"
                        title={file.name}
                      >
                        {file.name}
                      </a>
                      {fileKind && (
                        <Label
                          id={`file-kind-${key}`}
                          text={fileKind === 'job' ? 'Job' : 'Resume'}
                          size="small"
                          color={fileKind === 'job' ? 'positive' : 'bright-blue'}
                          className="!min-w-0 shrink-0"
                        />
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-gray-500 dark:text-ink-muted">
                    {file.size != null && <div>{Math.round(file.size / 1024)} KB</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SharePointFilesExplorer;

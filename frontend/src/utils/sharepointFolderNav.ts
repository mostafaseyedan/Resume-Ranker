export type SharePointFileLike = {
  name: string;
  path?: string;
  id?: string;
  web_url?: string;
  download_url?: string;
};

export function getSharePointFileKey(file: SharePointFileLike): string {
  return (
    String(file.id || '').trim() ||
    `${file.name}::${file.path || ''}` ||
    String(file.web_url || '') ||
    String(file.download_url || '') ||
    file.name
  );
}

export function getSharePointFilePath(file: SharePointFileLike): string {
  return file.path || file.name;
}

export function partitionFilesByPath<T extends SharePointFileLike>(
  files: T[],
  currentPath: string
): { subFolders: string[]; filesInFolder: T[] } {
  const pathPrefix = currentPath ? `${currentPath}/` : '';
  const subFolderNames = new Set<string>();
  const filesInFolder: T[] = [];

  files.forEach((file) => {
    const fullPath = getSharePointFilePath(file);
    if (currentPath && !fullPath.startsWith(pathPrefix)) return;

    const relative = currentPath ? fullPath.slice(pathPrefix.length) : fullPath;
    const slashIndex = relative.indexOf('/');

    if (slashIndex === -1) {
      filesInFolder.push(file);
    } else {
      subFolderNames.add(relative.slice(0, slashIndex));
    }
  });

  return {
    subFolders: Array.from(subFolderNames).sort((a, b) => a.localeCompare(b)),
    filesInFolder,
  };
}

export function countFilesUnderFolder<T extends SharePointFileLike>(
  files: T[],
  currentPath: string,
  folderName: string
): number {
  const prefix = currentPath ? `${currentPath}/${folderName}/` : `${folderName}/`;
  return files.filter((file) => getSharePointFilePath(file).startsWith(prefix)).length;
}

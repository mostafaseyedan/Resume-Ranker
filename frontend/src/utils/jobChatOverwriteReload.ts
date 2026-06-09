import type { ExportedMessageRepository } from '@assistant-ui/react';

/** Remove a message and its descendants, then set head to the parent (overwrite path). */
export const pruneMessageBranch = (
  exported: ExportedMessageRepository,
  messageId: string
): ExportedMessageRepository => {
  const idsToRemove = new Set<string>();

  const collectDescendants = (id: string) => {
    if (idsToRemove.has(id)) return;
    idsToRemove.add(id);
    for (const item of exported.messages) {
      if (item.parentId === id) {
        collectDescendants(item.message.id);
      }
    }
  };

  collectDescendants(messageId);

  const target = exported.messages.find((item) => item.message.id === messageId);
  const headId = target?.parentId ?? exported.headId ?? null;

  return {
    headId,
    messages: exported.messages.filter((item) => !idsToRemove.has(item.message.id)),
  };
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useLocalRuntime,
  useMessage,
  useThread,
  useThreadRuntime,
} from '@assistant-ui/react';
import type {
  ChatModelAdapter,
  TextMessagePartProps,
  ThreadMessage,
  ThreadMessageLike,
} from '@assistant-ui/react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import { Button, Label, Tooltip, Checkbox } from '@vibe/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Job, apiService, ChatMessage } from '../services/apiService';
import { API_BASE_URL, API_ENDPOINTS } from '../config/apiConfig';
import UserAvatar from './common/UserAvatar';
import { cn } from '@/lib/utils';
import { radiusControl, radiusSurface, radiusPill, radiusChip } from '@/lib/radius';
import { chatBubbleUser, textLink } from '@/lib/semanticColors';
import { ChatSkeleton } from './Skeletons';
import { buildFollowUpSuggestions, createJobChatSuggestionAdapter } from '../utils/jobChatSuggestionAdapter';
import { pruneMessageBranch } from '../utils/jobChatOverwriteReload';

const MAX_CONTEXT_FILES = 6;

const CONVERSATION_STARTERS = [
  { prompt: 'Summarize the key requirements for this role.', label: 'Key requirements' },
  { prompt: 'Who are the strongest candidates and why?', label: 'Top candidates' },
  { prompt: 'What skill gaps are most common across the candidates?', label: 'Common skill gaps' },
  { prompt: 'Draft screening questions tailored to this role.', label: 'Screening questions' },
];

interface ContextFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  downloadUrl: string;
  path: string;
  siteId?: string;
  driveId?: string;
}

interface ContextFileReference {
  fileName: string;
  downloadUrl: string;
  fileId?: string;
  siteId?: string;
  driveId?: string;
  webUrl?: string;
}

interface ChatSource {
  id: string;
  title: string;
  url?: string | null;
}

interface FollowUp {
  label: string;
  prompt: string;
}

interface StreamChunk {
  content?: string;
  sources?: ChatSource[];
  followUps?: FollowUp[];
  complete?: boolean;
  error?: string;
}

interface ChatContextControlProps {
  files: ContextFile[];
  selectedFileIds: Set<string>;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onToggleFile: (fileId: string) => void;
  onClear: () => void;
  onRefresh: () => void;
}

interface JobChatTabProps {
  job: Job;
}

const getFileExtLabel = (name: string) => {
  const ext = name.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 4 ? ext : 'FILE';
};

const formatFileSize = (size: number) => {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const JobChatTab = ({ job }: JobChatTabProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ThreadMessageLike[]>([]);
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [selectedContextFileIds, setSelectedContextFileIds] = useState<Set<string>>(new Set());
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isJobContextEnabled, setIsJobContextEnabled] = useState(true);

  const [userName, setUserName] = useState('You');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const hasSharePoint = Boolean((job as any).monday_metadata?.sharepoint_link);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getUser()
      .then((data) => {
        const u = (data as any)?.user;
        if (cancelled || !u) return;
        setUserName(u.name || u.email || 'You');
        setUserEmail(u.email || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadChatHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getJobChat(job.id);
      const messages = (response.messages || []) as ChatMessage[];
      const converted: ThreadMessageLike[] = messages.map((message, index) => {
        if (message.role === 'user') {
          return {
            id: message.id || `history-${index}-user`,
            role: 'user',
            content: message.content,
          };
        }
        const sources = ((message as any).sources || []) as ChatSource[];
        const followUps = ((message as any).followUps || []) as FollowUp[];
        return {
          id: message.id || `history-${index}-assistant`,
          role: 'assistant',
          content: [{ type: 'text', text: message.content }, ...buildSourceParts(sources)],
          metadata: { custom: { followUps } },
          status: { type: 'complete', reason: 'unknown' },
        };
      });
      setChatHistory(converted);
      setChatSessionKey((key) => key + 1);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load chat history');
      setChatHistory([]);
      setChatSessionKey((key) => key + 1);
    } finally {
      setIsLoading(false);
    }
  }, [job.id]);

  const loadContextFiles = useCallback(async () => {
    if (!hasSharePoint) {
      setContextFiles([]);
      setContextError(null);
      return;
    }
    try {
      setIsContextLoading(true);
      setContextError(null);
      const response = await apiService.getJobSharePointFiles(job.id);
      const all = [...(response.job_files || []), ...(response.resume_files || [])];
      const seen = new Set<string>();
      const mapped: ContextFile[] = [];
      all.forEach((file: any) => {
        const id =
          String(file?.id || '') ||
          String(file?.web_url || '') ||
          String(file?.download_url || '') ||
          `${String(file?.name || '')}::${String(file?.path || '')}`;
        if (!id || seen.has(id) || !file?.name) return;
        seen.add(id);
        mapped.push({
          id,
          name: file.name,
          size: file.size || 0,
          webUrl: file.web_url || '',
          downloadUrl: file.download_url || '',
          path: file.path || '',
          siteId: file.site_id,
          driveId: file.drive_id,
        });
      });
      setContextFiles(mapped);
      setSelectedContextFileIds((prev) => {
        const allowed = new Set(mapped.map((f) => f.id));
        return new Set(Array.from(prev).filter((id) => allowed.has(id)));
      });
    } catch (err: any) {
      setContextError(err?.response?.data?.error || err.message || 'Failed to load files');
      setContextFiles([]);
    } finally {
      setIsContextLoading(false);
    }
  }, [job.id, hasSharePoint]);

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  useEffect(() => {
    loadContextFiles();
    setSelectedContextFileIds(new Set());
  }, [loadContextFiles]);

  const toggleContextFile = (fileId: string) => {
    setSelectedContextFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else if (next.size < MAX_CONTEXT_FILES) {
        next.add(fileId);
      } else {
        toast.error(`Select up to ${MAX_CONTEXT_FILES} context files`);
      }
      return next;
    });
  };

  const clearSelectedContextFiles = () => setSelectedContextFileIds(new Set());

  const getSelectedContextReferences = useCallback((): ContextFileReference[] => {
    return contextFiles
      .filter((file) => selectedContextFileIds.has(file.id))
      .slice(0, MAX_CONTEXT_FILES)
      .filter((file) => file.downloadUrl || file.webUrl)
      .map((file) => ({
        fileName: file.name,
        downloadUrl: file.downloadUrl,
        fileId: file.id,
        siteId: file.siteId,
        driveId: file.driveId,
        webUrl: file.webUrl,
      }));
  }, [contextFiles, selectedContextFileIds]);

  const clearChatHistory = () => {
    if (!window.confirm('Clear chat history? This resets the conversation for this job.')) {
      return;
    }
    apiService
      .clearJobChat(job.id)
      .then(() => {
        setChatHistory([]);
        setChatSessionKey((key) => key + 1);
        setError(null);
        toast.success('Chat history cleared');
      })
      .catch((err: any) => {
        toast.error('Failed to clear chat history', {
          description: err?.response?.data?.error || err.message,
        });
      });
  };

  const chatModel = useMemo(
    () =>
      createJobChatModel({
        jobId: job.id,
        includeJobContext: isJobContextEnabled,
        getContextFiles: getSelectedContextReferences,
        onError: (message) => toast.error('Chat error', { description: message || 'Failed to get response' }),
      }),
    [job.id, isJobContextEnabled, getSelectedContextReferences]
  );

  if (isLoading) {
    return <ChatSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        <Button onClick={loadChatHistory} size="small" kind="primary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white dark:bg-surface">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-line bg-gray-50/70 dark:bg-canvas-deep px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-ink">Job Assistant</h3>
            <button
              type="button"
              onClick={() => setIsJobContextEnabled((enabled) => !enabled)}
              className={cn(
                'inline-flex shrink-0 cursor-pointer items-center gap-2 border px-3 py-1.5 text-xs font-medium transition-colors',
                radiusPill,
                isJobContextEnabled
                  ? 'border-brand/35 bg-brand-soft/60 text-brand-ink dark:bg-brand/15 dark:text-brand-on-dark'
                  : 'border-gray-200 dark:border-line bg-white dark:bg-surface text-gray-500 dark:text-ink-muted hover:text-gray-900 dark:hover:text-ink'
              )}
              aria-pressed={isJobContextEnabled}
              title={isJobContextEnabled ? 'Unload job context from future messages' : 'Reload job context for future messages'}
            >
              <span className={cn('h-2 w-2', radiusPill, isJobContextEnabled ? 'bg-brand' : 'bg-gray-400 dark:bg-ink-faint')} aria-hidden="true" />
              {isJobContextEnabled ? 'Job context loaded' : 'Job context unloaded'}
            </button>
          </div>
          <Button onClick={clearChatHistory} size="small" kind="tertiary" aria-label="Clear chat history">
            Clear chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <JobAssistantThread
            key={`${job.id}-${chatSessionKey}`}
            chatModel={chatModel}
            initialMessages={chatHistory}
            userEmail={userEmail}
            userName={userName}
            contextControl={{
              files: contextFiles,
              selectedFileIds: selectedContextFileIds,
              isOpen: isContextMenuOpen,
              isLoading: isContextLoading,
              error: contextError,
              onOpenChange: setIsContextMenuOpen,
              onToggleFile: toggleContextFile,
              onClear: clearSelectedContextFiles,
              onRefresh: loadContextFiles,
            }}
            hasSharePoint={hasSharePoint}
          />
        </div>
    </div>
  );
};

const createJobChatModel = ({
  jobId,
  includeJobContext,
  getContextFiles,
  onError,
}: {
  jobId: string;
  includeJobContext: boolean;
  getContextFiles: () => ContextFileReference[];
  onError: (message: string) => void;
}): ChatModelAdapter => ({
  run: async function* ({ messages, abortSignal }) {
    const prompt = getLastUserPrompt(messages);
    if (!prompt) {
      throw new Error('No prompt provided');
    }

    try {
      const contextFiles = getContextFiles();
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.JOB_CHAT(jobId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        credentials: 'include',
        signal: abortSignal,
        body: JSON.stringify({ prompt, includeJobContext, contextFiles }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let sources: ChatSource[] = [];
      let followUps: FollowUp[] = [];

      const runningUpdate = () => ({
        content: [{ type: 'text' as const, text: accumulated }],
        status: { type: 'running' as const },
      });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          if (jsonStr === '[DONE]') {
            yield completeUpdate(accumulated, sources, followUps);
            return;
          }
          try {
            const data: StreamChunk = JSON.parse(jsonStr);
            if (data.error) throw new Error(data.error);
            if (data.sources?.length) sources = data.sources;
            if (data.followUps?.length) followUps = data.followUps;
            if (data.content) {
              accumulated += data.content;
              yield runningUpdate();
            }
            if (data.complete) {
              yield completeUpdate(accumulated, sources, followUps);
              return;
            }
          } catch (err) {
            if (err instanceof SyntaxError) {
              console.warn('[JobChatTab] Failed to parse chunk:', jsonStr);
            } else {
              throw err;
            }
          }
        }
      }

      yield completeUpdate(accumulated, sources, followUps);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.error('[JobChatTab] Streaming error:', err);
      onError(err.message || 'Failed to get response');
      throw err;
    }
  },
});

const buildSourceParts = (sources: ChatSource[] = []) =>
  sources.map((source) =>
    source.url
      ? {
          type: 'source' as const,
          sourceType: 'url' as const,
          id: source.id,
          url: source.url,
          title: source.title,
        }
      : {
          type: 'source' as const,
          sourceType: 'document' as const,
          id: source.id,
          title: source.title,
          mediaType: 'application/octet-stream',
        }
  );

const completeUpdate = (text: string, sources: ChatSource[] = [], followUps: FollowUp[] = []) => ({
  content: [{ type: 'text' as const, text }, ...buildSourceParts(sources)],
  status: { type: 'complete' as const, reason: 'stop' as const },
  metadata: { custom: { followUps } },
});

const getLastUserPrompt = (messages: readonly ThreadMessage[]): string => {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  if (!lastUserMessage) return '';
  return lastUserMessage.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
};

const JobAssistantThread = ({
  chatModel,
  initialMessages,
  userEmail,
  userName,
  contextControl,
  hasSharePoint,
}: {
  chatModel: ChatModelAdapter;
  initialMessages: readonly ThreadMessageLike[];
  userEmail: string | null;
  userName: string;
  contextControl: ChatContextControlProps;
  hasSharePoint: boolean;
}) => {
  const suggestionAdapter = useMemo(() => createJobChatSuggestionAdapter(), []);

  const runtime = useLocalRuntime(chatModel, {
    initialMessages,
    adapters: { suggestion: suggestionAdapter },
  });

  const messageComponents = useMemo(
    () => ({
      UserMessage: () => <UserMessage userEmail={userEmail} userName={userName} />,
      UserEditComposer: () => <UserEditComposer userEmail={userEmail} userName={userName} />,
      AssistantMessage,
    }),
    [userEmail, userName]
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="relative flex h-full min-h-0 flex-col bg-white dark:bg-surface">
        <ThreadPrimitive.Viewport autoScroll className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-5">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">
            <ThreadPrimitive.Empty>
              <EmptyChatState />
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={messageComponents} />
          </div>

          <ThreadPrimitive.ViewportFooter className="pointer-events-none sticky bottom-0 z-20 flex justify-end px-4 pb-24 pt-2">
            <ThreadPrimitive.ScrollToBottom
              behavior="smooth"
              className={cn(
                'pointer-events-auto inline-flex h-8 w-8 items-center justify-center border border-gray-200 dark:border-line bg-white dark:bg-surface-raised text-gray-500 dark:text-ink-muted shadow-sm transition hover:bg-gray-50 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:pointer-events-none disabled:hidden',
                radiusPill
              )}
              aria-label="Scroll to latest message"
            >
              <ChevronDown size={16} aria-hidden="true" />
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>

        <Composer contextControl={contextControl} hasSharePoint={hasSharePoint} />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
};

const EmptyChatState = () => (
  <div className="mx-auto flex min-h-[18rem] max-w-xl flex-col items-center justify-center py-8 text-center">
    <h4 className="text-sm font-semibold text-gray-900 dark:text-ink">Start with the job context</h4>
    <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-ink-muted">
      Ask about requirements, candidates, skill gaps, or screening questions. Use the + button to add SharePoint files as
      extra context for a question.
    </p>
  </div>
);

const ChatContextButton = ({
  files,
  selectedFileIds,
  isOpen,
  isLoading,
  error,
  onOpenChange,
  onToggleFile,
  onClear,
  onRefresh,
}: ChatContextControlProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedCount = selectedFileIds.size;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative flex h-9 shrink-0 items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        title="Add file context"
        aria-label={selectedCount > 0 ? `Context files (${selectedCount} selected)` : 'Add file context'}
        aria-expanded={isOpen}
        className={cn(
          'relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand/35',
          radiusPill,
          isOpen || selectedCount > 0
            ? 'bg-brand-soft/70 text-brand dark:bg-brand/20 dark:text-brand-on-dark'
            : 'text-gray-500 dark:text-ink-muted hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-ink'
        )}
      >
        <Plus size={20} strokeWidth={2} aria-hidden="true" />
        {selectedCount > 0 && (
          <span
            className={cn(
              'absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center bg-brand px-1 text-[10px] font-semibold leading-none text-brand-fg',
              radiusPill
            )}
          >
            {selectedCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute bottom-12 left-0 z-30 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden border border-gray-200 dark:border-line bg-white dark:bg-surface shadow-elev-1',
            radiusSurface
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-gray-200 dark:border-line px-4 py-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-gray-900 dark:text-ink">Add file context</div>
              <div className="mt-0.5 text-[11px] leading-tight text-gray-500 dark:text-ink-muted">
                Selected files are added to your next message, separately from the job context toggle.
              </div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className={cn(
                '-mr-1 shrink-0 p-1.5 text-gray-500 dark:text-ink-muted transition hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/35',
                radiusControl
              )}
              aria-label="Refresh available context files"
            >
              <RefreshCw size={15} className={cn(isLoading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center gap-2 px-2 py-6 text-xs text-gray-500 dark:text-ink-muted">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Loading files…
              </div>
            ) : error ? (
              <div className="px-2 py-6 text-xs text-red-600 dark:text-red-400">{error}</div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-2 py-8 text-center">
                <FileText size={20} className="text-gray-400 dark:text-ink-faint" aria-hidden="true" />
                <span className="text-xs text-gray-500 dark:text-ink-muted">No SharePoint files available.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {files.map((file) => {
                  const checked = selectedFileIds.has(file.id);
                  const disabled = !checked && selectedFileIds.size >= MAX_CONTEXT_FILES;
                  return (
                    <div
                      key={file.id}
                      onClick={() => !disabled && onToggleFile(file.id)}
                      className={cn(
                        'group flex w-full cursor-pointer items-center gap-2.5 px-2 py-2 transition',
                        radiusControl,
                        checked ? 'bg-brand-soft/60 dark:bg-brand/15' : 'hover:bg-gray-100 dark:hover:bg-surface-hover',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <div className="pointer-events-none shrink-0">
                        <Checkbox checked={checked} disabled={disabled} />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900 dark:text-ink" title={file.name}>
                        {file.name}
                      </span>
                      <Label text={getFileExtLabel(file.name)} color="primary" size="small" className="!min-w-0" />
                      <span className="shrink-0 text-[11px] tabular-nums text-gray-500 dark:text-ink-muted">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {files.length > 0 && !isLoading && !error && (
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-line px-4 py-2.5 text-[11px] font-medium text-gray-500 dark:text-ink-muted">
              <span>
                {selectedCount} of {MAX_CONTEXT_FILES} selected
              </span>
              {selectedCount > 0 && (
                <button type="button" onClick={onClear} className={cn('hover:underline focus:outline-none', textLink)}>
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const messageActionButtonClass = cn(
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center text-gray-400 dark:text-ink-muted transition hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-40',
  radiusControl
);

const UserMessageActionBar = () => (
  <ActionBarPrimitive.Root hideWhenRunning autohide="never" className="flex items-center gap-0.5">
    <ActionBarPrimitive.Edit className={messageActionButtonClass} title="Edit message" aria-label="Edit message">
      <Pencil size={14} aria-hidden="true" />
    </ActionBarPrimitive.Edit>
  </ActionBarPrimitive.Root>
);

const AssistantMessageActionBar = () => (
  <ActionBarPrimitive.Root hideWhenRunning autohide="never" className="flex items-center gap-0.5">
    <ActionBarPrimitive.Copy
      copiedDuration={2000}
      className={cn(messageActionButtonClass, 'data-[copied=true]:text-brand')}
      title="Copy response"
      aria-label="Copy response"
    >
      <Copy size={14} aria-hidden="true" />
    </ActionBarPrimitive.Copy>
    <AssistantRegenerateButton />
  </ActionBarPrimitive.Root>
);

const AssistantRegenerateButton = () => {
  const aui = useAui();
  const isRunning = useThread((state) => state.isRunning);
  const role = useMessage((state) => state.role);
  const messageId = useMessage((state) => state.id);
  const parentId = useMessage((state) => state.parentId);

  const disabled = isRunning || role !== 'assistant' || !parentId;

  const handleRegenerate = () => {
    if (disabled || !parentId) return;
    const exported = aui.thread().export();
    aui.thread().import(pruneMessageBranch(exported, messageId));
    aui.thread().startRun({ parentId, sourceId: null, runConfig: aui.composer().getState().runConfig });
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleRegenerate}
      className={messageActionButtonClass}
      title="Regenerate response"
      aria-label="Regenerate response"
    >
      <RotateCcw size={14} aria-hidden="true" />
    </button>
  );
};

const suggestionBubbleClass = cn(
  'inline-flex max-w-[min(100%,260px)] cursor-pointer border border-gray-200 dark:border-line bg-white dark:bg-surface-raised px-3.5 py-2 text-sm font-medium leading-5 text-gray-900 dark:text-ink shadow-elev-2 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-gray-50 hover:shadow-elev-3 dark:hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-60',
  radiusPill
);

const ComposerSuggestionBubbles = () => {
  const threadRuntime = useThreadRuntime();
  const isRunning = useThread((state) => state.isRunning);
  const isEmpty = useThread((state) => state.messages.length === 0);
  const messages = useThread((state) => state.messages);

  const followUps = useMemo(() => buildFollowUpSuggestions(messages), [messages]);

  const showStarters = !isRunning && isEmpty;
  const showFollowUps = !isRunning && !isEmpty && followUps.length > 0;

  if (!showStarters && !showFollowUps) {
    return null;
  }

  const items = showStarters
    ? CONVERSATION_STARTERS.map((starter) => ({ key: starter.prompt, label: starter.label, prompt: starter.prompt }))
    : followUps.map((item) => ({ key: item.prompt, label: item.label, prompt: item.prompt }));

  return (
    <div className="flex w-max max-w-full flex-wrap justify-center gap-3" role="group" aria-label={showStarters ? 'Conversation starters' : 'Suggested follow-ups'}>
      {items.map((item, index) => (
        <Tooltip
          key={item.key}
          id={`job-suggestion-${showStarters ? 'starter' : 'followup'}-${index}`}
          content={item.prompt}
          position="top"
          theme="dark"
          maxWidth={320}
          showDelay={200}
          hideDelay={80}
          zIndex={10000}
        >
          <button type="button" disabled={isRunning} onClick={() => threadRuntime.append(item.prompt)} className={suggestionBubbleClass}>
            {item.label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
};

const UserEditComposer = ({ userEmail, userName }: { userEmail: string | null; userName: string }) => (
  <div className="group flex flex-col items-end gap-1">
    <div className="flex w-full max-w-[820px] flex-col items-end gap-1">
      <UserAvatar userId={userEmail} name={userName} size="small" />
      <ComposerPrimitive.Root className="w-full">
        <div className={cn('relative border border-gray-200 dark:border-line bg-white dark:bg-surface-raised p-2 shadow-sm focus-within:border-brand/60', radiusControl)}>
          <ComposerPrimitive.Input
            rows={3}
            submitMode="enter"
            className="max-h-48 min-h-[4.5rem] w-full resize-none bg-transparent px-3 py-1.5 pb-10 pr-20 text-sm leading-6 text-gray-900 dark:text-ink outline-none placeholder:text-gray-400 dark:placeholder:text-ink-muted"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <ComposerPrimitive.Cancel
              className={cn('inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center bg-gray-100 dark:bg-surface-hover text-gray-500 dark:text-ink-muted transition hover:text-gray-900 dark:hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/35', radiusPill)}
              title="Cancel edit"
              aria-label="Cancel edit"
            >
              <X size={16} aria-hidden="true" />
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send
              className={cn('inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center bg-brand text-brand-fg transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/35', radiusPill)}
              title="Save edit"
              aria-label="Save edit"
            >
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            </ComposerPrimitive.Send>
          </div>
        </div>
      </ComposerPrimitive.Root>
    </div>
  </div>
);

const UserMessage = ({ userEmail, userName }: { userEmail: string | null; userName: string }) => (
  <MessagePrimitive.Root className="group flex flex-col items-end gap-1">
    <div className="flex max-w-[min(72%,520px)] flex-col items-end gap-1">
      <UserAvatar userId={userEmail} name={userName} size="small" />
      <div className={cn('px-3.5 py-2.5 text-sm leading-6 shadow-sm', radiusControl, chatBubbleUser)}>
        <MessagePrimitive.Parts components={{ Text: UserTextPart }} />
      </div>
      <div className="mt-1 flex justify-end">
        <UserMessageActionBar />
      </div>
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage = () => {
  const status = useMessage((state) => state.status);
  const isRunning = status?.type === 'running';
  const errorMessage =
    status?.type === 'incomplete' && status.reason === 'error'
      ? String(status.error || 'The assistant could not complete the response.')
      : null;

  return (
    <MessagePrimitive.Root className="group flex flex-col items-start gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        <img src="/gemini-icon.svg" alt="" className="h-5 w-5" />
      </span>
      <div className="min-w-0 w-full px-1 py-0.5">
        <MessagePrimitive.Parts components={{ Text: AssistantTextPart, Source: () => null, Empty: () => null }} />
        {!isRunning && !errorMessage && <MessageSources />}
        {isRunning && <AssistantThinking className="mt-2" />}
        {errorMessage && (
          <div className={cn('mt-3 border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300', radiusControl)}>
            {errorMessage}
          </div>
        )}
        {!isRunning && !errorMessage && (
          <div className="mt-2 flex items-center gap-2">
            <AssistantMessageActionBar />
          </div>
        )}
      </div>
    </MessagePrimitive.Root>
  );
};

const UserTextPart = ({ text }: TextMessagePartProps) => <span className="whitespace-pre-wrap break-words">{text}</span>;

// The app does not ship @tailwindcss/typography, so markdown is styled with explicit
// element overrides (same approach as the internal-candidates tab) rather than `prose`.
const AssistantTextPart = ({ text }: TextMessagePartProps) => (
  <div className="max-w-none break-words text-sm leading-6 text-gray-900 dark:text-ink">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
        ul: ({ ...props }) => <ul className="my-2 ml-5 list-outside list-disc space-y-1" {...props} />,
        ol: ({ ...props }) => <ol className="my-2 ml-5 list-outside list-decimal space-y-1" {...props} />,
        li: ({ ...props }) => <li className="pl-1" {...props} />,
        h1: ({ ...props }) => <h1 className="mb-1 mt-3 text-base font-semibold first:mt-0" {...props} />,
        h2: ({ ...props }) => <h2 className="mb-1 mt-3 text-sm font-semibold first:mt-0" {...props} />,
        h3: ({ ...props }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0" {...props} />,
        strong: ({ ...props }) => <strong className="font-semibold text-gray-900 dark:text-ink" {...props} />,
        a: ({ ...props }) => (
          <a className={cn(textLink, 'underline')} target="_blank" rel="noopener noreferrer" {...props} />
        ),
        code: ({ ...props }) => (
          <code className={cn('bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-surface-raised', radiusChip)} {...props} />
        ),
        pre: ({ ...props }) => (
          <pre className={cn('my-2 overflow-x-auto bg-gray-100 p-3 text-[0.85em] dark:bg-surface-raised', radiusControl)} {...props} />
        ),
        blockquote: ({ ...props }) => (
          <blockquote className="my-2 border-l-2 border-gray-200 pl-3 text-gray-600 dark:border-line dark:text-ink-muted" {...props} />
        ),
        table: ({ ...props }) => (
          <div className="my-2 overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-xs dark:border-line" {...props} />
          </div>
        ),
        th: ({ ...props }) => (
          <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold dark:border-line dark:bg-surface" {...props} />
        ),
        td: ({ ...props }) => <td className="border border-gray-200 px-2 py-1 dark:border-line" {...props} />,
        hr: () => <hr className="my-3 border-gray-200 dark:border-line" />,
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
);

interface Citation {
  id: string;
  title: string;
  url?: string;
}

const MessageSources = () => {
  const content = useMessage((state) => state.content);

  const citations = useMemo<Citation[]>(() => {
    const seen = new Set<string>();
    const items: Citation[] = [];
    for (const part of content) {
      if (part.type !== 'source') continue;
      const url = part.sourceType === 'url' ? part.url : undefined;
      const title = part.title || url || 'Source';
      const key = url || title;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ id: part.id, title, url });
    }
    return items;
  }, [content]);

  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-gray-200 dark:border-line pt-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-ink-faint">
        {citations.length === 1 ? 'Source' : 'Sources'}
      </span>
      <ol className="flex flex-col gap-0.5 text-xs">
        {citations.map((citation, index) => (
          <li key={citation.id} className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 tabular-nums text-gray-400 dark:text-ink-faint">{index + 1}.</span>
            {citation.url ? (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                title={citation.url}
                className={cn('min-w-0 truncate underline decoration-brand/40 underline-offset-2 hover:decoration-brand focus:outline-none', textLink)}
              >
                {citation.title}
              </a>
            ) : (
              <span className="min-w-0 truncate text-gray-500 dark:text-ink-muted" title={citation.title}>
                {citation.title}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

const AssistantThinking = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-ink-muted', className)}>
    <span className="flex gap-1">
      <span className={cn('h-1.5 w-1.5 animate-pulse bg-current', radiusPill)} />
      <span className={cn('h-1.5 w-1.5 animate-pulse bg-current [animation-delay:120ms]', radiusPill)} />
      <span className={cn('h-1.5 w-1.5 animate-pulse bg-current [animation-delay:240ms]', radiusPill)} />
    </span>
    <span>Thinking</span>
  </div>
);

const COMPOSER_SINGLE_LINE_HEIGHT_PX = 36;

const Composer = ({ contextControl, hasSharePoint }: { contextControl: ChatContextControlProps; hasSharePoint: boolean }) => {
  const [pinActionsToBottom, setPinActionsToBottom] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex flex-col items-center gap-3">
      <div className="pointer-events-auto flex w-full max-w-[820px] justify-center px-2">
        <ComposerSuggestionBubbles />
      </div>
      <div className="pointer-events-auto w-full max-w-[820px]">
        <ComposerPrimitive.Root>
          <div
            className={cn(
              'flex gap-2 border border-gray-200 dark:border-line bg-white/95 dark:bg-surface-raised p-2 shadow-elev-3 backdrop-blur transition focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/25',
              radiusControl,
              pinActionsToBottom ? 'items-end' : 'items-center'
            )}
          >
            {hasSharePoint && <ChatContextButton {...contextControl} />}
            <ComposerPrimitive.Input
              rows={1}
              submitMode="enter"
              placeholder="Ask about requirements, candidates, or skill gaps..."
              onHeightChange={(height) => setPinActionsToBottom(height > COMPOSER_SINGLE_LINE_HEIGHT_PX + 2)}
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-3 py-1.5 text-sm leading-6 text-gray-900 dark:text-ink outline-none placeholder:text-gray-400 dark:placeholder:text-ink-muted"
            />
            <ChatRunButton />
          </div>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
};

const ChatRunButton = () => {
  const isRunning = useThread((state) => state.isRunning);
  const threadRuntime = useThreadRuntime();

  if (isRunning) {
    return (
      <button
        type="button"
        onClick={() => threadRuntime.cancelRun()}
        className={cn('inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center bg-gray-900 dark:bg-ink text-white dark:text-surface transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand/35', radiusPill)}
        aria-label="Stop response"
      >
        <Square size={13} fill="currentColor" aria-hidden="true" />
      </button>
    );
  }

  return (
    <ComposerPrimitive.Send
      className={cn(
        'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center bg-brand text-brand-fg transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/35 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-surface-hover disabled:text-gray-400 dark:disabled:text-ink-muted',
        radiusPill
      )}
      aria-label="Send message"
    >
      <ArrowUp size={20} strokeWidth={2.4} aria-hidden="true" />
    </ComposerPrimitive.Send>
  );
};

export default JobChatTab;

"use client";

/**
 * Ghostly Agent - Chat Panel
 *
 * A slide-out panel on the right side of the screen for conversing
 * with the Ghostly AI agent. Supports session management, streaming
 * responses, tool-call display, and the ghostly glass-morphism theme.
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  X,
  Send,
  Plus,
  Loader2,
  Wrench,
  ChevronRight,
  Trash2,
  MessageSquare,
  Paperclip,
  Minus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallData[];
  tool_results?: ToolResultData[];
  created_at: string;
}

interface ToolCallData {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolResultData {
  tool_call_id: string;
  name: string;
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  event_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string | null;
}

interface SSEEvent {
  type: "session" | "tool_call" | "text" | "done" | "context" | "compacted" | "approval_required";
  session_id?: string;
  content?: string;
  name?: string;
  arguments?: string;
  used?: number;
  limit?: number;
  percent?: number;
  message?: string | null;
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: string;
    description?: string;
  }>;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  eventId?: string | null;
}

interface PendingToolApproval {
  session_id: string;
  message: string | null;
  tool_calls: Array<{
    id: string;
    name: string;
    arguments: string;
    description?: string;
  }>;
}

// ─── Safe Markdown Helpers ───────────────────────────────────────────────────

function renderMarkdownLine(line: string, lineIdx: number): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = line;
  let partKey = 0;

  // Handle bullet points
  if (remaining.startsWith("- ") || remaining.startsWith("* ")) {
    parts.push(
      <span key={partKey++} className="ml-2">
        &bull;{" "}
      </span>
    );
    remaining = remaining.slice(2);
  }

  // Parse bold and inline code into React elements (no raw HTML injection)
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={partKey++}>{remaining.slice(lastIndex, match.index)}</span>
      );
    }

    if (match[2]) {
      parts.push(
        <strong key={partKey++} className="font-semibold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <code
          key={partKey++}
          className="bg-background/50 px-1 rounded text-xs font-mono"
        >
          {match[3]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < remaining.length) {
    parts.push(<span key={partKey++}>{remaining.slice(lastIndex)}</span>);
  }

  if (parts.length === 0) {
    parts.push(<span key={partKey++}>{remaining}</span>);
  }

  return (
    <span key={lineIdx}>
      {parts}
      <br />
    </span>
  );
}

function renderMarkdown(text: string): ReactNode {
  return text.split("\n").map((line, i) => renderMarkdownLine(line, i));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const FILE_ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp,.eml";
const CHAT_ACTIVE_SESSION_KEY = "ghostly-chat-active-session-v1";
const CHAT_PANEL_WIDTH_KEY = "ghostly-chat-panel-width-v1";
const CHAT_WIDTH_MIN = 360;
const CHAT_WIDTH_MAX = 900;
const CHAT_WIDTH_DEFAULT = 460;

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatPanel({ isOpen, onClose, onMinimize, eventId }: ChatPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<
    Array<{ name: string; arguments: string }>
  >([]);
  const [showSessions, setShowSessions] = useState(false);
  const [agentName, setAgentName] = useState("Ghostly");
  const [contextPercent, setContextPercent] = useState(0);
  const [showCompactedDivider, setShowCompactedDivider] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingToolApproval | null>(null);
  const [panelWidth, setPanelWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasRestoredSessionRef = useRef(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/agent/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(sessionId);
        setMessages(data.messages ?? []);
        setShowSessions(false);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/agent/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.agent_name) {
          setAgentName(data.settings.agent_name);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    loadSessions();
  }, [isOpen, loadSessions]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        setPanelWidth(Math.max(CHAT_WIDTH_MIN, Math.min(CHAT_WIDTH_MAX, parsed)));
      }
    } catch {
      // Ignore malformed width state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAT_PANEL_WIDTH_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent) => {
      const nextWidth = window.innerWidth - e.clientX;
      const clamped = Math.max(
        CHAT_WIDTH_MIN,
        Math.min(CHAT_WIDTH_MAX, Math.min(nextWidth, window.innerWidth - 32))
      );
      setPanelWidth(clamped);
    };

    const stopResize = () => setIsResizing(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isOpen || hasRestoredSessionRef.current) return;
    const persisted = localStorage.getItem(CHAT_ACTIVE_SESSION_KEY);
    if (!persisted) {
      hasRestoredSessionRef.current = true;
      return;
    }

    hasRestoredSessionRef.current = true;
    loadSession(persisted);
  }, [isOpen, loadSession]);

  useEffect(() => {
    if (!currentSessionId) {
      localStorage.removeItem(CHAT_ACTIVE_SESSION_KEY);
      return;
    }
    localStorage.setItem(CHAT_ACTIVE_SESSION_KEY, currentSessionId);
  }, [currentSessionId]);

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setStreamingContent("");
    setStreamingToolCalls([]);
    setPendingApproval(null);
    setShowSessions(false);
    setInput("");
    setContextPercent(0);
    setShowCompactedDivider(false);
    setPendingFiles([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/agent/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
      }
    } catch {
      // Silently fail
    }
  };

  // ─── File handlers ──────────────────────────────────────────────────
  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).filter(
      (f) => f.size <= MAX_FILE_SIZE && f.size > 0
    );
    setPendingFiles((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_FILES);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      // Reset so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles]
  );

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const processStreamResponse = useCallback(async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    const toolCalls: Array<{ name: string; arguments: string }> = [];

    let reading = true;
    while (reading) {
      const { done, value } = await reader.read();
      if (done) {
        reading = false;
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event: SSEEvent = JSON.parse(jsonStr);

          if (event.type === "session") {
            if (event.session_id) {
              setCurrentSessionId((prev) => prev || event.session_id || null);
            }
          } else if (event.type === "tool_call") {
            if (event.name) {
              toolCalls.push({
                name: event.name,
                arguments: event.arguments || "",
              });
              setStreamingToolCalls([...toolCalls]);
            }
          } else if (event.type === "text") {
            if (event.content) {
              fullContent += event.content;
              setStreamingContent(fullContent);
            }
          } else if (event.type === "context") {
            if (typeof event.percent === "number") {
              setContextPercent(event.percent);
            }
          } else if (event.type === "compacted") {
            setShowCompactedDivider(true);
          } else if (event.type === "approval_required") {
            const sessionIdForApproval =
              event.session_id || currentSessionId || null;
            if (sessionIdForApproval) {
              setPendingApproval({
                session_id: sessionIdForApproval,
                message: event.message ?? null,
                tool_calls: event.tool_calls || [],
              });
            }
            setStreamingContent("");
            setStreamingToolCalls([]);
          } else if (event.type === "done") {
            if (fullContent) {
              const assistantMsg: ChatMessage = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: fullContent,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
            }
            setStreamingContent("");
            setStreamingToolCalls([]);
            loadSessions();
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }, [currentSessionId, loadSessions]);

  const resolvePendingApproval = useCallback(async (approve: boolean) => {
    if (!pendingApproval || isStreaming) return;

    const approvedIds = approve
      ? pendingApproval.tool_calls.map((toolCall) => toolCall.id)
      : [];

    setPendingApproval(null);
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingToolCalls([]);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: pendingApproval.session_id,
          approved_tool_call_ids: approvedIds,
          event_id: eventId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }

      await processStreamResponse(res);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingToolCalls([]);
    }
  }, [eventId, isStreaming, pendingApproval, processStreamResponse]);

  // ─── Send message ──────────────────────────────────────────────────
  const sendMessage = async () => {
    const trimmed = input.trim();
    const hasFiles = pendingFiles.length > 0;
    if ((!trimmed && !hasFiles) || isStreaming) return;

    const fileNames = pendingFiles.map((f) => f.name);
    const displayContent = trimmed
      ? fileNames.length > 0
        ? `${trimmed}\n[${fileNames.join(", ")}]`
        : trimmed
      : `[${fileNames.join(", ")}]`;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: displayContent,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPendingApproval(null);

    const filesToSend = [...pendingFiles];
    setInput("");
    setPendingFiles([]);
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingToolCalls([]);

    try {
      let res: Response;

      if (filesToSend.length > 0) {
        const formData = new FormData();
        formData.append("message", trimmed);
        if (currentSessionId) formData.append("session_id", currentSessionId);
        if (eventId) formData.append("event_id", eventId);
        for (const file of filesToSend) {
          formData.append("files", file);
        }
        res = await fetch("/api/agent/chat", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: currentSessionId,
            message: trimmed,
            event_id: eventId,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }

      await processStreamResponse(res);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingToolCalls([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessage = (msg: ChatMessage) => {
    if (msg.role === "tool") return null;
    const isUser = msg.role === "user";

    return (
      <div
        key={msg.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
      >
        <div
          className={`
            max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed
            ${
              isUser
                ? "bg-spectral text-white rounded-br-sm"
                : "bg-card border border-border text-foreground rounded-bl-sm"
            }
          `}
        >
          {msg.tool_calls && msg.tool_calls.length > 0 && (
            <div className="mb-2 space-y-1">
              {msg.tool_calls.map((tc, i) => (
                <ToolCallBadge key={i} name={tc.function.name} />
              ))}
            </div>
          )}
          {msg.content && (
            <div className="whitespace-pre-wrap break-words">
              {renderMarkdown(msg.content)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Ghost SVG icon
  const GhostIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C7 2 3 6 3 11v9c0 1 .5 2 1.5 2s1.5-1 1.5-2v-1c0-1 .5-2 1.5-2s1.5 1 1.5 2v1c0 1 .5 2 1.5 2s1.5-1 1.5-2v-1c0-1 .5-2 1.5-2s1.5 1 1.5 2v1c0 1 .5 2 1.5 2s1.5-1 1.5-2v-9c0-5-4-9-9-9zm-3 10a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-screen z-50
          w-full md:w-[var(--chat-panel-width)]
          bg-background/95 backdrop-blur-xl
          border-l border-border
          shadow-2xl
          transition-transform duration-300 ease-in-out
          flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        style={{ ["--chat-panel-width" as string]: `${panelWidth}px` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="hidden md:block absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-spectral/20 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          title="Resize chat panel"
        />
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-spectral/10 backdrop-blur-sm border-2 border-dashed border-spectral rounded-lg flex flex-col items-center justify-center pointer-events-none">
            <Paperclip className="w-10 h-10 text-spectral mb-2" />
            <p className="text-sm font-medium text-spectral">Drop files here</p>
          </div>
        )}

        {pendingApproval && (
          <div className="absolute inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Tool Permission Required
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Review what the agent wants to do before allowing these tool calls.
                </p>
              </div>
              <div className="p-4 space-y-3 max-h-[52vh] overflow-y-auto">
                {pendingApproval.message && (
                  <div className="text-xs rounded-md border border-border bg-card/40 p-2 text-muted-foreground whitespace-pre-wrap">
                    {pendingApproval.message}
                  </div>
                )}
                {pendingApproval.tool_calls.map((toolCall) => (
                  <div key={toolCall.id} className="rounded-md border border-border bg-card/50 p-3">
                    <p className="text-sm font-medium text-foreground">{toolCall.name}</p>
                    {toolCall.description && (
                      <p className="text-xs text-muted-foreground mt-1">{toolCall.description}</p>
                    )}
                    <pre className="mt-2 text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                      {toolCall.arguments || "{}"}
                    </pre>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => resolvePendingApproval(false)}
                  className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => resolvePendingApproval(true)}
                  className="px-3 py-1.5 text-sm rounded-md bg-spectral text-white hover:bg-spectral-light transition-colors"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-spectral/20 flex items-center justify-center shrink-0">
              <GhostIcon className="w-5 h-5 text-spectral" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">
                {agentName}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {currentSessionId ? "Active session" : "New conversation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-spectral/10 transition-colors"
              title="Chat history"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={startNewChat}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-spectral/10 transition-colors"
              title="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            {onMinimize && (
              <button
                onClick={onMinimize}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-spectral/10 transition-colors"
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-spectral/10 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Context Bar */}
        {contextPercent >= 50 && (
          <div
            className="shrink-0 relative h-[2px] bg-border"
            title={`Context: ${contextPercent}% — auto-compacts at 80%`}
          >
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                contextPercent >= 80
                  ? "bg-red-500"
                  : contextPercent >= 65
                    ? "bg-amber-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(contextPercent, 100)}%` }}
            />
          </div>
        )}

        {/* Session List */}
        {showSessions && (
          <div className="border-b border-border bg-card/60 backdrop-blur-sm max-h-64 overflow-y-auto shrink-0">
            <div className="p-2 space-y-1">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No previous chats
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`
                      flex items-center justify-between p-2 rounded-md cursor-pointer
                      text-sm transition-colors group
                      ${
                        session.id === currentSessionId
                          ? "bg-spectral/10 text-spectral"
                          : "hover:bg-spectral/5 text-foreground"
                      }
                    `}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {session.title}
                      </p>
                      {session.last_message && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {session.last_message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground">
                        {session.message_count}
                      </span>
                      <button
                        onClick={(e) => deleteSession(session.id, e)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-spectral/10 flex items-center justify-center mb-4">
                <GhostIcon className="w-10 h-10 text-spectral" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Hey, I&apos;m {agentName}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                I can help you manage events, track budgets, check overdue tasks,
                and more. Just ask.
              </p>
              <div className="space-y-2 w-full max-w-[280px]">
                {[
                  "What events are over budget?",
                  "Show me overdue tasks",
                  "List Q2 events",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-spectral/30 hover:bg-spectral/5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showCompactedDivider && messages.length > 0 && (
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-amber-500/30" />
              <span className="text-[10px] text-amber-500/70 whitespace-nowrap">
                Context refreshed — summary retained
              </span>
              <div className="flex-1 h-px bg-amber-500/30" />
            </div>
          )}

          {messages.map(renderMessage)}

          {isStreaming && streamingToolCalls.length > 0 && !streamingContent && (
            <div className="flex justify-start mb-3">
              <div className="max-w-[85%] rounded-xl px-4 py-3 bg-card border border-border rounded-bl-sm">
                <div className="space-y-1">
                  {streamingToolCalls.map((tc, i) => (
                    <ToolCallBadge key={i} name={tc.name} isActive />
                  ))}
                </div>
              </div>
            </div>
          )}

          {isStreaming && streamingContent && (
            <div className="flex justify-start mb-3">
              <div className="max-w-[85%] rounded-xl px-4 py-3 bg-card border border-border text-foreground text-sm leading-relaxed rounded-bl-sm">
                <div className="whitespace-pre-wrap break-words">
                  {renderMarkdown(streamingContent)}
                </div>
                <span className="inline-block w-1.5 h-4 bg-spectral/60 animate-pulse ml-0.5 -mb-0.5" />
              </div>
            </div>
          )}

          {isStreaming && !streamingContent && streamingToolCalls.length === 0 && (
            <div className="flex justify-start mb-3">
              <div className="rounded-xl px-4 py-3 bg-card border border-border rounded-bl-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3 shrink-0">
          {/* Pending files preview */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pendingFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-spectral/10 border border-spectral/20 text-xs text-foreground max-w-[180px]"
                >
                  <Paperclip className="w-3 h-3 text-spectral shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button
                    onClick={() => removePendingFile(i)}
                    className="p-0.5 rounded hover:bg-spectral/20 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || pendingFiles.length >= MAX_FILES}
              className="
                p-2.5 rounded-lg text-muted-foreground
                hover:text-foreground hover:bg-spectral/10
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors shrink-0
              "
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={FILE_ACCEPT}
              onChange={handleFileSelect}
              className="hidden"
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${agentName} anything...`}
              rows={1}
              className="
                flex-1 resize-none bg-background border border-border rounded-lg
                px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60
                focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
                transition-colors min-h-[40px] max-h-[120px]
              "
              style={{ height: "auto", overflow: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && pendingFiles.length === 0) || isStreaming}
              className="
                p-2.5 rounded-lg bg-spectral text-white
                hover:bg-spectral-light disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors shrink-0
              "
              title="Send message"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            Powered by AI. Responses may not always be accurate.
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ToolCallBadge({
  name,
  isActive,
}: {
  name: string;
  isActive?: boolean;
}) {
  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium
        ${
          isActive
            ? "bg-ether/10 text-ether border border-ether/20"
            : "bg-spectral/5 text-muted-foreground border border-border"
        }
        transition-colors
      `}
    >
      {isActive ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Wrench className="w-3 h-3" />
      )}
      <span>{formatToolName(name)}</span>
      <ChevronRight className="w-3 h-3" />
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default ChatPanel;

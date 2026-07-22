import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { Paginated, UserSession, ChatTimelineItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  ArrowLeft,
  Search,
  X,
} from "lucide-react";
import ChatMessageBubble from "@/components/shared/ChatMessageBubble";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sessionLabel(session: UserSession): string {
  return session.user?.firstName ?? session.user?.username ?? session.user?.telegramId ?? "Unknown";
}

function userInitial(session: UserSession): string {
  const name = session.user?.firstName ?? session.user?.username ?? "?";
  return name.charAt(0).toUpperCase();
}

const POLL_INTERVAL = 10_000;

export default function BotChatPreviewPage() {
  const { botId } = useParams<{ botId: string }>();
  const [sessions, setSessions] = useState<Paginated<UserSession> | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ChatTimelineItem[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async (page: number, searchTerm: string) => {
    if (!botId) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const result = await api.sessions(botId, page, params);
      setSessions(result);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchSessions(sessionsPage, search);
  }, [fetchSessions, sessionsPage, search]);

  const fetchTimeline = useCallback(async (sessionId: string) => {
    if (!botId) return;
    setTimelineLoading(true);
    setTimelineError(null);
    setTimeline(null);
    try {
      const result = await api.chatTimeline(botId, sessionId);
      setTimeline(result);
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : "Failed to load chat");
    } finally {
      setTimelineLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (selectedId) {
      fetchTimeline(selectedId);
    }
  }, [selectedId, fetchTimeline]);

  useEffect(() => {
    if (timeline && timeline.length > 0) {
      timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [timeline]);

  const selectedSession = sessions?.items.find((s) => s.id === selectedId) ?? null;
  const isActiveSession = selectedSession?.status === "ACTIVE";

  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (selectedId && isActiveSession && botId) {
      pollTimerRef.current = setInterval(() => {
        api.chatTimeline(botId, selectedId)
          .then((result) => {
            setTimeline(result);
          })
          .catch(() => {});
      }, POLL_INTERVAL);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [selectedId, isActiveSession, botId]);

  function handleSelect(sessionId: string) {
    setSelectedId(sessionId);
  }

  function handleBack() {
    setSelectedId(null);
    setTimeline(null);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setSessionsPage(1);
  }

  function clearSearch() {
    setSearch("");
    setSessionsPage(1);
  }

  const totalSessionsPages = sessions ? Math.ceil(sessions.total / sessions.pageSize) : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat Preview</h1>
          <p className="text-sm text-muted-foreground">Replay user conversations</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchSessions(sessionsPage, search)}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex h-[calc(100vh-10rem)] gap-0 rounded-xl border border-border/60 overflow-hidden shadow-sm">
        {/* ── Sessions panel ── */}
        <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0 flex-col border-r border-border/50 bg-muted/10`}>
          <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs rounded-lg"
              />
              {search && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {sessions ? `${sessions.total} sessions` : ""}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sessionsLoading ? (
              <div className="space-y-0.5 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sessionsError ? (
              <div className="flex flex-col items-center gap-3 py-12 px-4">
                <p className="text-xs text-destructive text-center">{sessionsError}</p>
                <Button variant="outline" size="sm" onClick={() => fetchSessions(sessionsPage, search)}>
                  Retry
                </Button>
              </div>
            ) : !sessions || sessions.items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 px-4">
                <Inbox className="size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">{search ? "No sessions match your search" : "No sessions yet"}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {sessions.items.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelect(session.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      selectedId === session.id ? "bg-muted border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {userInitial(session)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{sessionLabel(session)}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(session.startedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {session.messageCount} msg{session.messageCount !== 1 ? "s" : ""}
                        </span>
                        <span
                          className={`size-1.5 rounded-full ${
                            session.status === "ACTIVE" ? "bg-emerald-500" : "bg-muted-foreground/40"
                          }`}
                        />
                        <span className="text-[10px] text-muted-foreground/60">{session.status}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {sessions && totalSessionsPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={sessionsPage <= 1}
                onClick={() => setSessionsPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {sessionsPage} / {totalSessionsPages}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={sessionsPage >= totalSessionsPages}
                onClick={() => setSessionsPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Chat timeline panel ── */}
        <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
          {selectedId ? (
            <>
              {/* Timeline header */}
              <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={handleBack}>
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm font-medium truncate">
                    {selectedSession ? sessionLabel(selectedSession) : "Conversation"}
                  </p>
                </div>
                {selectedSession && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      selectedSession.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${selectedSession.status === "ACTIVE" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    {selectedSession.status}
                  </span>
                )}
                {isActiveSession && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 animate-pulse">
                    Live
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  onClick={() => fetchTimeline(selectedId!)}
                  disabled={timelineLoading}
                >
                  <RefreshCw className={`size-3.5 ${timelineLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {/* Timeline body */}
              <div
                ref={timelineScrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/5"
              >
                {timelineLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                        <Skeleton className={`h-16 rounded-2xl ${i % 2 === 0 ? "w-56 rounded-bl-md" : "w-48 rounded-br-md"}`} />
                      </div>
                    ))}
                  </div>
                ) : timelineError ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <p className="text-xs text-destructive">{timelineError}</p>
                    <Button variant="outline" size="sm" onClick={() => fetchTimeline(selectedId!)}>
                      Retry
                    </Button>
                  </div>
                ) : !timeline || timeline.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Inbox className="size-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No messages in this session</p>
                  </div>
                ) : (
                  <>
                    {timeline.map((item, i) => {
                      const prevItem = i > 0 ? timeline[i - 1] : null;
                      const timeGap = prevItem
                        ? new Date(item.createdAt).getTime() - new Date(prevItem.createdAt).getTime()
                        : 0;
                      const showDateDivider = timeGap > 5 * 60 * 1000 || i === 0;

                      return (
                        <div key={item.id}>
                          {showDateDivider && (
                            <div className="flex justify-center mb-3">
                              <span className="text-[10px] text-muted-foreground bg-background px-3 py-0.5 rounded-full border border-border/50">
                                {formatDate(item.createdAt)} {formatTime(item.createdAt)}
                              </span>
                            </div>
                          )}
                          <ChatMessageBubble item={item} />
                        </div>
                      );
                    })}
                    <div ref={timelineEndRef} />
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="size-12 opacity-20" />
              <p className="text-sm">Select a session to view the conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

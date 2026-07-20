import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { Paginated, UserSession, ChatTimelineItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  ArrowLeft,
} from "lucide-react";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function sessionLabel(session: UserSession): string {
  return session.user?.firstName ?? session.user?.username ?? session.user?.telegramId ?? "Unknown";
}

function userInitial(session: UserSession): string {
  const name = session.user?.firstName ?? session.user?.username ?? "?";
  return name.charAt(0).toUpperCase();
}

export default function BotChatPreviewPage() {
  const { botId } = useParams<{ botId: string }>();
  const [sessions, setSessions] = useState<Paginated<UserSession> | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ChatTimelineItem[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async (page: number) => {
    if (!botId) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const result = await api.sessions(botId, page);
      setSessions(result);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchSessions(sessionsPage);
  }, [fetchSessions, sessionsPage]);

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
    if (selectedId) fetchTimeline(selectedId);
  }, [selectedId, fetchTimeline]);

  useEffect(() => {
    if (timeline && timeline.length > 0) {
      timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [timeline]);

  function handleSelect(sessionId: string) {
    setSelectedId(sessionId);
  }

  function handleBack() {
    setSelectedId(null);
    setTimeline(null);
  }

  const totalSessionsPages = sessions ? Math.ceil(sessions.total / sessions.pageSize) : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat Preview</h1>
          <p className="text-sm text-muted-foreground">Replay user conversations</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchSessions(sessionsPage)}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex h-[calc(100vh-10rem)] gap-0 rounded-xl border border-border/60 overflow-hidden shadow-sm">
        {/* ── Sessions panel ── */}
        <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0 flex-col border-r border-border/50 bg-muted/10`}>
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sessions
              {sessions && <span className="ml-1 font-normal normal-case">({sessions.total})</span>}
            </p>
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
                <Button variant="outline" size="sm" onClick={() => fetchSessions(sessionsPage)}>
                  Retry
                </Button>
              </div>
            ) : !sessions || sessions.items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 px-4">
                <Inbox className="size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No sessions yet</p>
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
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {sessions?.items.find((s) => s.id === selectedId) ? (
                      sessionLabel(sessions.items.find((s) => s.id === selectedId)!)
                    ) : (
                      "Conversation"
                    )}
                  </p>
                </div>
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
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-muted/5"
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
                      const isOutgoing = item.direction === "outgoing";
                      const prevItem = i > 0 ? timeline[i - 1] : null;
                      const timeGap = prevItem
                        ? new Date(item.createdAt).getTime() - new Date(prevItem.createdAt).getTime()
                        : 0;
                      const showDateDivider = timeGap > 5 * 60 * 1000 || i === 0;

                      return (
                        <div key={item.id}>
                          {showDateDivider && (
                            <div className="flex justify-center mb-4">
                              <span className="text-[10px] text-muted-foreground bg-background px-3 py-0.5 rounded-full border border-border/50">
                                {formatDate(item.createdAt)} {formatTime(item.createdAt)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isOutgoing ? "justify-start" : "justify-end"} mb-1`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                                isOutgoing
                                  ? "bg-muted rounded-bl-md"
                                  : "bg-primary text-primary-foreground rounded-br-md"
                              }`}
                            >
                              <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                                isOutgoing ? "text-foreground" : "text-primary-foreground"
                              }`}>
                                {item.content || (item.type === "callback_query" ? `[Button: ${item.buttonId ?? "unknown"}]` : "[media]")}
                              </p>
                              <div className={`flex items-center gap-2 mt-1.5 text-[10px] ${
                                isOutgoing ? "text-muted-foreground" : "text-primary-foreground/60"
                              }`}>
                                <span>{formatTime(item.createdAt)}</span>
                                {item.stepIndex != null && (
                                  <span className="opacity-60">step:{item.stepIndex}</span>
                                )}
                                {item.buttonId && (
                                  <span className="max-w-[100px] truncate opacity-60">{item.buttonId}</span>
                                )}
                              </div>
                            </div>
                          </div>
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

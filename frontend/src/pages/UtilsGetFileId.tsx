import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Bot, BotSettings } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Search, Upload, Link, Copy, Check, AlertTriangle, X, ChevronDown, Info } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

type SourceMode = "url" | "file";

export default function UtilsGetFileId() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [botSearch, setBotSearch] = useState("");
  const [botPickerOpen, setBotPickerOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [manualChatId, setManualChatId] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [fileUrl, setFileUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultFileId, setResultFileId] = useState<string | null>(null);
  const [resultFileUniqueId, setResultFileUniqueId] = useState<string | null>(null);
  const [copiedFileId, setCopiedFileId] = useState(false);
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
  const [adminUserLabels, setAdminUserLabels] = useState<Map<string, string>>(new Map());

  const botPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.bots().then(setBots).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (botPickerRef.current && !botPickerRef.current.contains(e.target as Node)) {
        setBotPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedBot) {
      setBotSettings(null);
      setAdminUserLabels(new Map());
      return;
    }
    api.getBotSettings(selectedBot.id).then((settings) => {
      setBotSettings(settings);
      const ids = settings.adminTelegramIds;
      if (ids && ids.length > 0) {
        resolveAdminLabels(selectedBot.id, ids);
      }
    }).catch(() => {});
  }, [selectedBot]);

  async function resolveAdminLabels(botId: string, ids: string[]) {
    const map = new Map<string, string>();
    for (const id of ids) {
      map.set(id, id);
    }
    try {
      const { items } = await api.users(botId, 1);
      for (const user of items) {
        const tgId = String(user.telegramId);
        if (ids.includes(tgId)) {
          const label = user.username
            ? `@${user.username}`
            : user.firstName
              ? user.firstName
              : tgId;
          map.set(tgId, label);
        }
      }
    } catch {
      // fallback to raw IDs
    }
    setAdminUserLabels(map);
  }

  const filteredBots = bots.filter((b) =>
    b.name.toLowerCase().includes(botSearch.toLowerCase())
  );

  function selectBot(bot: Bot) {
    setSelectedBot(bot);
    setBotPickerOpen(false);
    setBotSearch("");
  }

  function selectChatId(id: string) {
    setChatId(id);
    setManualChatId(id);
  }

  function handleManualChatChange(value: string) {
    setManualChatId(value);
    setChatId(value);
  }

  async function handleSubmit() {
    setError(null);
    setResultFileId(null);
    setResultFileUniqueId(null);

    const finalChatId = chatId.trim();
    if (!selectedBot) {
      setError("Select a bot first.");
      return;
    }
    if (!finalChatId) {
      setError("Enter a Chat ID.");
      return;
    }

    if (sourceMode === "url" && !fileUrl.trim()) {
      setError("Enter a file URL.");
      return;
    }
    if (sourceMode === "file" && !file) {
      setError("Select a file to upload.");
      return;
    }

    setUploading(true);
    try {
      let result: { ok: boolean; fileId: string; fileUniqueId?: string };
      if (sourceMode === "url") {
        result = await api.getFileIdFromUrl(selectedBot.id, finalChatId, fileUrl.trim());
      } else {
        result = await api.getFileIdFromFile(selectedBot.id, finalChatId, file!);
      }
      setResultFileId(result.fileId);
      setResultFileUniqueId(result.fileUniqueId ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to send file";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFileId(true);
      setTimeout(() => setCopiedFileId(false), 2000);
    } catch {
      // ignore
    }
  }

  const adminIds = botSettings?.adminTelegramIds ?? [];

  const isDisabled = uploading || !selectedBot || !chatId.trim()
    || (sourceMode === "url" ? !fileUrl.trim() : !file);

  return (
    <main className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Utils — Get File ID</h1>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {selectedBot && selectedBot.status !== "ACTIVE" ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          This bot is <strong className="mx-0.5">{selectedBot.status.toLowerCase()}</strong>.
          File ID extraction may not work if the token is invalid.
        </div>
      ) : null}

      <section className="rounded-lg border bg-card">
        <div className="p-3 border-b">
          <h2 className="font-medium">Extract file_id from Telegram</h2>
        </div>
        <div className="p-3 space-y-4">
          <p className="text-sm text-muted-foreground">
            Send a file to a Telegram chat using your bot and receive the file_id.
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bot</label>
            <div className="relative" ref={botPickerRef}>
              <button
                type="button"
                onClick={() => setBotPickerOpen(!botPickerOpen)}
                className="flex w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                {selectedBot ? (
                  <>
                    <Avatar className="size-6 rounded-sm" size="sm">
                      {selectedBot.photoUrl ? (
                        <AvatarImage src={selectedBot.photoUrl} className="rounded-sm object-cover" />
                      ) : null}
                      <AvatarFallback className="rounded-sm text-[10px]">
                        {selectedBot.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-left">{selectedBot.name}</span>
                    {selectedBot.status !== "ACTIVE" && (
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {selectedBot.status}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">Select a bot...</span>
                )}
                <ChevronDown className="size-4 text-muted-foreground ml-auto" />
              </button>

              {botPickerOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search bots..."
                      value={botSearch}
                      onValueChange={setBotSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No bots found</CommandEmpty>
                      <CommandGroup>
                        {filteredBots.map((bot) => (
                          <CommandItem
                            key={bot.id}
                            value={bot.id}
                            onSelect={() => selectBot(bot)}
                            className="flex items-center gap-3"
                          >
                            <Avatar className="size-6 rounded-sm" size="sm">
                              {bot.photoUrl ? (
                                <AvatarImage src={bot.photoUrl} className="rounded-sm object-cover" />
                              ) : null}
                              <AvatarFallback className="rounded-sm text-[10px]">
                                {bot.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1">{bot.name}</span>
                            {bot.status !== "ACTIVE" && (
                              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                {bot.status}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium">Chat ID</label>
              <Dialog>
                <DialogTrigger render={<span className="inline-flex cursor-pointer"><Info className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" /></span>} />
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>What is a Chat ID?</DialogTitle>
                    <DialogDescription>
                      A unique number that identifies a user, group, or channel on Telegram.
                      You need it so your bot knows where to send the file.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">How to get yours:</h4>
                      <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                        <li>Open Telegram and search for <strong>@IDBot</strong></li>
                        <li>Start a chat and send <strong>/getid</strong></li>
                        <li>The bot will reply with your Chat ID</li>
                      </ol>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      For groups: add <strong>@IDBot</strong>, send <strong>/getgroupid</strong>, then check the reply.
                    </p>
                  </div>
                  <DialogFooter>
                    <DialogClose render={<Button variant="default">Got it</Button>} />
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {selectedBot && adminIds.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] text-muted-foreground mb-1.5">Admin chats:</p>
                <div className="flex flex-wrap gap-1.5">
                  {adminIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectChatId(id)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        chatId === id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted hover:bg-muted/70"
                      }`}
                    >
                      {adminUserLabels.get(id) ?? id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedBot && adminIds.length === 0 && (
              <p className="text-[11px] text-muted-foreground mb-1.5">
                No admin chats configured.{" "}
                <a
                  href={`/manager/${selectedBot.id}/settings`}
                  className="underline underline-offset-2 hover:text-primary"
                >
                  Add in Bot Settings →
                </a>
              </p>
            )}

            <Input
              value={manualChatId}
              onChange={(e) => handleManualChatChange(e.target.value)}
              placeholder="ex: 57837291 or @channelname"
            />
            <p className="text-[11px] text-muted-foreground">
              For groups/channels, invite @RawDataBot or use the @username directly.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Source</label>
            <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
              <button
                type="button"
                onClick={() => setSourceMode("url")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sourceMode === "url"
                    ? "bg-background shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link className="size-3.5" />
                URL
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("file")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sourceMode === "file"
                    ? "bg-background shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="size-3.5" />
                File Upload
              </button>
            </div>
          </div>

          {sourceMode === "url" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">File URL</label>
              <Input
                type="url"
                placeholder="https://example.com/file.mp4"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">File</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) setFile(dropped);
                }}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <Upload className="size-6 mx-auto mb-2 opacity-40" />
                    Drop a file here or click to browse
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={isDisabled}>
              {uploading ? "Sending..." : "Extract file_id"}
            </Button>
          </div>

          {resultFileId ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">file_id</label>
                <div className="flex gap-2">
                  <Input readOnly value={resultFileId} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(resultFileId)}
                    className="shrink-0"
                  >
                    {copiedFileId ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
              {resultFileUniqueId ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">file_unique_id</label>
                  <Input readOnly value={resultFileUniqueId} className="font-mono text-xs" />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

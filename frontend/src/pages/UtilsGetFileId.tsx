import { useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function UtilsGetFileId() {
  const [botId, setBotId] = useState("");
  const [chatId, setChatId] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileUniqueId, setFileUniqueId] = useState<string | null>(null);

  async function handleUpload() {
    setError(null);
    setFileId(null);
    setFileUniqueId(null);
    if (!botId.trim() || !chatId.trim() || !fileUrl.trim()) {
      setError("Informe botId, chatId e a URL do arquivo.");
      return;
    }
    setUploading(true);
    try {
      const result = await api.getFileIdFromUrl(botId.trim(), chatId.trim(), fileUrl.trim());
      setFileId(result.fileId);
      setFileUniqueId(result.fileUniqueId ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao enviar arquivo";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Utils — Get File ID</h1>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card">
        <div className="p-3 border-b">
          <h2 className="font-medium">Extrair file_id do Telegram</h2>
        </div>
        <div className="p-3 space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie um arquivo para um chat do Telegram usando seu bot e receba o file_id de volta.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bot ID</label>
              <Input value={botId} onChange={(e) => setBotId(e.target.value)} placeholder="cuid do bot" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Chat ID</label>
              <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="ex.: 123456789" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Arquivo (URL pública)</label>
            <Input
              type="url"
              placeholder="https://exemplo.com/arquivo.mp3"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleUpload} disabled={uploading || !fileUrl.trim() || !botId.trim() || !chatId.trim()}>
              {uploading ? "Enviando..." : "Upload"}
            </Button>
          </div>

          {fileId ? (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">file_id</label>
                <div className="flex gap-2">
                  <Input readOnly value={fileId} />
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(fileId).catch(() => {})}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              {fileUniqueId ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">file_unique_id</label>
                  <Input readOnly value={fileUniqueId} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

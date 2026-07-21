const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

function isWebUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function resolveMediaUrl(url: string): Promise<{ source: Buffer } | string> {
  if (!isWebUrl(url)) return url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,video/*,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      console.warn(`[media] Failed to download ${url}: status ${response.status}`);
      return url;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      console.warn(`[media] Unexpected content type for ${url}: "${contentType}"`);
      return url;
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
      console.warn(`[media] Skipping download of ${url}: exceeds ${MAX_DOWNLOAD_BYTES} byte limit`);
      return url;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      console.warn(`[media] Empty response body for ${url}`);
      return url;
    }

    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
      console.warn(`[media] Skipping download of ${url}: body exceeds ${MAX_DOWNLOAD_BYTES} byte limit`);
      return url;
    }

    return { source: Buffer.from(arrayBuffer) };
  } catch (error) {
    console.warn(`[media] Download error for ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveMediaUrls(urls: string[]): Promise<Array<{ source: Buffer } | string>> {
  return Promise.all(urls.map(resolveMediaUrl));
}

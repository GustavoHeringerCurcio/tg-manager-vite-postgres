import { AudioMessageCard, VideoCard, ImageCard } from "@/components/shared/AudioMessageCard";
import type { ChatTimelineItem } from "@/types";

const BUTTON_COLOR_MAP: Record<string, string> = {
  BLUE: "bg-blue-500 text-white",
  GREEN: "bg-emerald-500 text-white",
  RED: "bg-red-500 text-white",
};

type TimelineMeta = Record<string, unknown> | null;

function parseMetadata(meta: TimelineMeta): Record<string, unknown> {
  return (meta && typeof meta === "object" && !Array.isArray(meta)) ? meta as Record<string, unknown> : {};
}

function getMetaString(meta: Record<string, unknown>, key: string): string | null {
  const val = meta[key];
  return typeof val === "string" ? val : null;
}

function getMetaBool(meta: Record<string, unknown>, key: string): boolean {
  return Boolean(meta[key]);
}

function getMetaButtons(meta: Record<string, unknown>): Array<{ id: string; label: string; color: string; action: string; price?: number; originalPrice?: number; discountedPrice?: number; discountPercentage?: number }> {
  const raw = meta.buttons;
  if (Array.isArray(raw)) return raw as unknown as Array<{ id: string; label: string; color: string; action: string; price?: number }>;
  return [];
}

function parseLegacyContent(content: string | null): { mediaType?: string; title?: string; isRemarketing: boolean } {
  if (!content) return { isRemarketing: false };
  const isRemarketing = content.startsWith("remarketing:");
  const prefixMatch = content.match(/^(audio|video|image|remarketing):(.*)/);
  if (prefixMatch) {
    return {
      mediaType: prefixMatch[1] === "remarketing" ? undefined : prefixMatch[1].toUpperCase(),
      title: prefixMatch[2] || undefined,
      isRemarketing: prefixMatch[1] === "remarketing" || isRemarketing,
    };
  }
  return { isRemarketing };
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatMessageBubble({ item }: { item: ChatTimelineItem }) {
  const isOutgoing = item.direction === "outgoing";
  const meta = parseMetadata(item.metadata as TimelineMeta);
  const isRemarketing = getMetaBool(meta, "isRemarketing") || (item.content?.startsWith("remarketing:") ?? false);
  const buttons = getMetaButtons(meta);
  const isCallback = item.type === "callback_query";
  const buttonLabel = getMetaString(meta, "buttonLabel");
  const buttonColor = getMetaString(meta, "buttonColor") ?? "BLUE";

  const legacy = parseLegacyContent(item.content);

  const mediaType = (getMetaString(meta, "mediaType") ?? legacy.mediaType)?.toUpperCase();
  const title = getMetaString(meta, "title") ?? legacy.title ?? item.content ?? undefined;

  const hasMediaCard = mediaType === "AUDIO" || mediaType === "VIDEO" || mediaType === "IMAGE";

  const bubbleContent = (
    <>
      {isRemarketing && (
        <div className="mb-1.5 flex items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Remarketing
          </span>
        </div>
      )}

      {isCallback && buttonLabel ? (
        <span
          className={`inline-block rounded-lg px-3 py-1.5 text-xs font-medium ${
            BUTTON_COLOR_MAP[buttonColor] ?? BUTTON_COLOR_MAP["BLUE"]
          }`}
        >
          {buttonLabel}
        </span>
      ) : isCallback ? (
        <p className={`text-sm leading-relaxed ${isOutgoing ? "text-foreground" : "text-primary-foreground"}`}>
          [Button: {item.buttonId ?? "unknown"}]
        </p>
      ) : hasMediaCard && title ? (
        <div className="max-w-[220px]">
          {mediaType === "AUDIO" && <AudioMessageCard title={title} isRemarketing={isRemarketing} />}
          {mediaType === "VIDEO" && <VideoCard title={title} isRemarketing={isRemarketing} />}
          {mediaType === "IMAGE" && <ImageCard title={title} isRemarketing={isRemarketing} />}
        </div>
      ) : item.content ? (
        <p
          className={`text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${
            isOutgoing ? "text-foreground" : "text-primary-foreground"
          }`}
        >
          {item.content}
        </p>
      ) : (
        <p className={`text-xs italic ${isOutgoing ? "text-muted-foreground" : "text-primary-foreground/60"}`}>
          [media]
        </p>
      )}

      {buttons.length > 0 && !isCallback && (
        <div className="mt-2 flex flex-wrap gap-1">
          {buttons.map((btn) => (
            <span
              key={btn.id}
              className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                BUTTON_COLOR_MAP[btn.color] ?? BUTTON_COLOR_MAP["BLUE"]
              }`}
            >
              {btn.discountedPrice != null
                ? `${btn.label} - R$${btn.discountedPrice.toFixed(2)} (${btn.discountPercentage}% OFF)`
                : btn.price != null
                  ? `${btn.label} - R$${btn.price.toFixed(2)}`
                  : btn.label}
            </span>
          ))}
        </div>
      )}

      <div
        className={`flex items-center gap-2 mt-1.5 text-[10px] ${
          isOutgoing ? "text-muted-foreground" : "text-primary-foreground/60"
        }`}
      >
        <span>{formatTime(item.createdAt)}</span>
        {item.stepIndex != null && (
          <span className="opacity-60">step:{item.stepIndex}</span>
        )}
        {item.buttonId && !isCallback && (
          <span className="max-w-[100px] truncate opacity-60">{item.buttonId}</span>
        )}
      </div>
    </>
  );

  return (
    <div className={`flex ${isOutgoing ? "justify-start" : "justify-end"} mb-1`}>
      <div
        className={`max-w-[80%] min-w-0 rounded-2xl px-4 py-2.5 ${
          isRemarketing
            ? "border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30"
            : isOutgoing
              ? "bg-muted rounded-bl-md"
              : "bg-primary text-primary-foreground rounded-br-md"
        } ${isRemarketing ? "" : ""}`}
      >
        {bubbleContent}
      </div>
    </div>
  );
}

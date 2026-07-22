export function AudioMessageCard({ title, isRemarketing }: { title: string; isRemarketing?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        isRemarketing
          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20"
      }`}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-1.5 flex items-center gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] animate-pulse rounded-full bg-amber-400/60 dark:bg-amber-400/40"
              style={{
                height: `${6 + Math.sin((i + 1) * 0.8) * 6}px`,
                animationDelay: `${i * 80}ms`,
                animationDuration: "0.8s",
              }}
            />
          ))}
        </div>
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        Voice
      </span>
    </div>
  );
}

export function VideoCard({ title, isRemarketing }: { title: string; isRemarketing?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        isRemarketing
          ? "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30"
          : "border-violet-100 bg-violet-50/50 dark:border-violet-900/30 dark:bg-violet-950/20"
      }`}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-[10px] text-muted-foreground">Video</p>
      </div>
    </div>
  );
}

export function ImageCard({ title, isRemarketing }: { title: string; isRemarketing?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        isRemarketing
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20"
      }`}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-[10px] text-muted-foreground">Image</p>
      </div>
    </div>
  );
}

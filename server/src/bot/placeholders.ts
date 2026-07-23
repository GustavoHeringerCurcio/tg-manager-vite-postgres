import type { TimeComplimentConfig } from "./remarketing.js";

const NAME_REGEX = /\{name(?::([^}]*))?\}/g;
const TIME_REGEX = /\{time\}/g;
const TIME_COMPLIMENT_REGEX = /\{time_compliment\}/g;

function getLocalTime(timezone: string): { hours: number; minutes: number } {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return { hours: local.getHours(), minutes: local.getMinutes() };
}

function formatTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
  } catch {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
    } catch {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
  }
}

function isInRange(
  currentH: number,
  currentM: number,
  startH: number,
  startM: number,
  endH: number,
  endM: number
): boolean {
  const current = currentH * 60 + currentM;
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}

export type PaymentContext = {
  amount?: number;
  pixCode?: string;
  checkoutUrl?: string;
};

export function formatPixCode(pixCode: string): string {
  return `<blockquote><code>${pixCode}</code></blockquote>`;
}

export function resolveAllPlaceholders(
  text: string,
  user: { firstName: string | null },
  timeCompliments?: TimeComplimentConfig | null,
  payment?: PaymentContext
): string {
  let result = text;

  result = result.replace(NAME_REGEX, (_match, fallback?: string) => {
    if (user.firstName?.trim()) return user.firstName.trim();
    return fallback?.trim() ?? "";
  });

  if (timeCompliments?.timezone) {
    result = result.replace(TIME_REGEX, () => formatTime(timeCompliments.timezone));

    result = result.replace(TIME_COMPLIMENT_REGEX, () => {
      const { hours, minutes } = getLocalTime(timeCompliments.timezone);
      for (const preset of timeCompliments.presets) {
        if (isInRange(hours, minutes, preset.startHour, preset.startMinute, preset.endHour, preset.endMinute)) {
          return preset.label;
        }
      }
      return timeCompliments.fallback ?? "";
    });
  } else {
    result = result.replace(TIME_REGEX, () => formatTime("UTC"));
    result = result.replace(TIME_COMPLIMENT_REGEX, () => "");
  }

  if (payment) {
    if (payment.amount !== undefined) {
      result = result.replace(/\{amount\}/g, `R$ ${(payment.amount / 100).toFixed(2)}`);
    }
    if (payment.pixCode) {
      result = result.replace(/\{pix_code\}/g, formatPixCode(payment.pixCode));
    } else if (payment.checkoutUrl) {
      result = result.replace(/\{pix_code\}/g, payment.checkoutUrl);
    }
    if (payment.checkoutUrl) {
      result = result.replace(/\{checkout_url\}/g, payment.checkoutUrl);
    }
  }

  return result;
}

export function resolveUserPlaceholders(text: string, user: { firstName: string | null }): string {
  return resolveAllPlaceholders(text, user, null);
}

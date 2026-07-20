import Papa from "papaparse";
import type {
  MessageStep,
  MessageButton,
  LivePixResponse,
  ButtonAction,
  ButtonColor,
} from "@/types";
import { newId } from "@/lib/helpers";

export const MESSAGE_FLOW_HEADERS = [
  "step_id",
  "title",
  "type",
  "text",
  "media_urls",
  "delay_ms",
  "button_label",
  "button_action",
  "button_url",
  "button_price",
  "button_color",
] as const;

export const PAYMENT_FLOW_HEADERS = [
  "text",
  "image_url",
  "video_url",
  "audio_url",
  "include_qr_code",
  "include_pix_code",
  "include_checkout_url",
] as const;

export const BUTTON_PRESET_HEADERS = [
  "name",
  "label",
  "action",
  "url",
  "price",
  "color",
] as const;

const VALID_TYPES = new Set(["TEXT", "AUDIO", "VIDEO"]);
const VALID_COLORS = new Set(["BLUE", "GREEN", "RED"]);
const VALID_ACTIONS = new Set(["OPEN_URL", "LIVEPIX_PAYMENT"]);

function headerIndex(headers: readonly string[], col: string): number {
  return headers.indexOf(col);
}

export function generateCsv(headers: string[], rows: string[][]): string {
  const escapedRows = rows.map((row) =>
    row
      .map((cell) => {
        if (
          cell.includes(",") ||
          cell.includes('"') ||
          cell.includes("\n") ||
          cell.includes("\r")
        ) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      })
      .join(","),
  );
  return [headers.join(","), ...escapedRows].join("\n");
}

export function parseCsvFile(file: File): Promise<Papa.ParseResult<string[]>> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => resolve(result),
      error: (error) => reject(error),
    });
  });
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type CsvParseError = {
  row: number;
  field: string;
  message: string;
};

export type ParsedFlowButton = {
  label: string;
  action: string;
  color: string;
  url: string;
  price: string;
  errors: CsvParseError[];
};

export type ParsedFlowStep = {
  step_id: string;
  title: string;
  type: string;
  text: string;
  mediaUrls: string;
  delayMs: string;
  buttonRows: ParsedFlowButton[];
  errors: CsvParseError[];
};

function colSafe(row: string[], idx: number): string {
  return (row[idx] ?? "").trim();
}

export function parseFlowCsv(data: string[][]): ParsedFlowStep[] {
  if (data.length < 2) return [];

  const rows = data.slice(1);
  const groups = new Map<string, string[][]>();

  for (const row of rows) {
    if (row.every((cell) => !cell.trim())) continue;
    const sid = colSafe(row, 0);
    if (!sid) continue;
    const key = sid.toLocaleLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const steps: ParsedFlowStep[] = [];

  for (const [, group] of groups) {
    const first = group[0];
    const stepId = colSafe(first, 0);
    const title = colSafe(first, 1);
    const type = colSafe(first, 2).toUpperCase();
    const text = colSafe(first, 3);
    const mediaUrlsStr = colSafe(first, 4);
    const delayMsVal = colSafe(first, 5);

    const stepErrors: CsvParseError[] = [];
    const rowNum = rows.indexOf(first) + 2;

    if (!title) {
      stepErrors.push({ row: rowNum, field: "title", message: "Title is required" });
    }
    if (!VALID_TYPES.has(type)) {
      stepErrors.push({
        row: rowNum,
        field: "type",
        message: `Invalid type "${type}". Must be TEXT, AUDIO, or VIDEO`,
      });
    }
    if (type === "TEXT" && !text) {
      stepErrors.push({
        row: rowNum,
        field: "text",
        message: "Text is required for TEXT type steps",
      });
    }
    if (
      (type === "AUDIO" || type === "VIDEO") &&
      !mediaUrlsStr
    ) {
      stepErrors.push({
        row: rowNum,
        field: "media_urls",
        message: `Media URLs required for ${type} type steps`,
      });
    }
    if (stepId.length > 48) {
      stepErrors.push({
        row: rowNum,
        field: "step_id",
        message: "step_id must be 48 characters or less",
      });
    }

    const parsedDelayMs = delayMsVal || "0";

    const buttonRows: ParsedFlowButton[] = [];

    for (let bi = 0; bi < group.length; bi++) {
      const brow = group[bi];
      const bLabel = colSafe(brow, 6);
      if (!bLabel) continue;

      const buttonRowNum = rows.indexOf(brow) + 2;
      const bAction = colSafe(brow, 7).toUpperCase();
      const bUrl = colSafe(brow, 8);
      const bPrice = colSafe(brow, 9);
      const bColor = colSafe(brow, 10).toUpperCase();
      const bErrors: CsvParseError[] = [];

      if (!VALID_ACTIONS.has(bAction)) {
        bErrors.push({
          row: buttonRowNum,
          field: "button_action",
          message: `Invalid action "${bAction}"`,
        });
      }
      if (!VALID_COLORS.has(bColor)) {
        bErrors.push({
          row: buttonRowNum,
          field: "button_color",
          message: `Invalid color "${bColor}"`,
        });
      }
      if (bAction === "OPEN_URL" && !bUrl) {
        bErrors.push({
          row: buttonRowNum,
          field: "button_url",
          message: "URL is required for OPEN_URL buttons",
        });
      }
      if (bAction === "LIVEPIX_PAYMENT") {
        const p = parseFloat(bPrice);
        if (!Number.isFinite(p) || p <= 0) {
          bErrors.push({
            row: buttonRowNum,
            field: "button_price",
            message: "Price must be a positive number for LivePix buttons",
          });
        }
      }
      if (bLabel.length > 80) {
        bErrors.push({
          row: buttonRowNum,
          field: "button_label",
          message: "Button label must be 80 characters or less",
        });
      }

      buttonRows.push({
        label: bLabel,
        action: bAction,
        color: bColor,
        url: bUrl,
        price: bPrice,
        errors: bErrors,
      });
    }

    if (buttonRows.length > 3) {
      stepErrors.push({
        row: rowNum,
        field: "buttons",
        message: "Maximum 3 buttons per step (only first 3 will be imported)",
      });
    }

    steps.push({
      step_id: stepId,
      title: title || "Untitled",
      type: type,
      text,
      mediaUrls: mediaUrlsStr,
      delayMs: parsedDelayMs,
      buttonRows: buttonRows.slice(0, 3),
      errors: stepErrors,
    });
  }

  return steps;
}

export function buildMessageSteps(parsed: ParsedFlowStep[]): MessageStep[] {
  return parsed.map((p) => {
    const mediaUrls = p.mediaUrls
      ? p.mediaUrls.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const validButtons = p.buttonRows.filter(
      (b) => b.errors.length === 0 && VALID_ACTIONS.has(b.action) && VALID_COLORS.has(b.color),
    );

    const buttons: MessageButton[] = validButtons.map((b) => {
      const btn: MessageButton = {
        id: newId(),
        label: b.label,
        action: b.action as ButtonAction,
        color: b.color as ButtonColor,
      };
      if (b.action === "OPEN_URL") {
        btn.url = b.url || undefined;
      }
      if (b.action === "LIVEPIX_PAYMENT") {
        const price = parseFloat(b.price);
        btn.price = Number.isFinite(price) && price > 0
          ? Math.round(price * 100) / 100
          : 29.9;
      }
      return btn;
    });

    const delayMs = parseInt(p.delayMs, 10);
    const validType = VALID_TYPES.has(p.type) ? p.type as MessageStep["type"] : "TEXT";

    return {
      id: p.step_id,
      title: p.title || "Untitled",
      type: validType,
      text: p.text || undefined,
      mediaUrls,
      delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0,
      buttons,
    };
  });
}

export function stepsToFlowCsvRows(steps: MessageStep[]): string[][] {
  const rows: string[][] = [];

  for (const step of steps) {
    const base = [
      step.id,
      step.title,
      step.type,
      step.text ?? "",
      step.mediaUrls.join(", "),
      String(step.delayMs),
    ];

    if (step.buttons.length === 0) {
      rows.push([...base, "", "", "", "", ""]);
    } else {
      for (let i = 0; i < step.buttons.length; i++) {
        const btn = step.buttons[i];
        rows.push([
          ...(i === 0 ? base : ["", "", "", "", "", ""]),
          btn.label,
          btn.action,
          btn.action === "OPEN_URL" ? (btn.url ?? "") : "",
          btn.action === "LIVEPIX_PAYMENT" ? String(btn.price ?? "") : "",
          btn.color,
        ]);
      }
    }
  }

  return rows;
}

export function stepsToFlowCsv(steps: MessageStep[]): string {
  const rows = stepsToFlowCsvRows(steps);
  return generateCsv([...MESSAGE_FLOW_HEADERS], rows);
}

export function exportFlowCsv(steps: MessageStep[], filename: string): void {
  downloadCsv(filename, stepsToFlowCsv(steps));
}

export function parsePaymentFlowCsv(data: string[][]): LivePixResponse[] {
  if (data.length < 2) return [];

  const rows = data.slice(1);
  const responses: LivePixResponse[] = [];

  for (const row of rows) {
    if (row.every((cell) => !cell.trim())) continue;

    const text = colSafe(row, 0);
    const imageUrl = colSafe(row, 1);
    const videoUrl = colSafe(row, 2);
    const audioUrl = colSafe(row, 3);
    const includeQr = colSafe(row, 4);
    const includePix = colSafe(row, 5);
    const includeCheckout = colSafe(row, 6);

    const resp: LivePixResponse = {};
    if (text) resp.text = text;
    if (imageUrl) resp.imageUrl = imageUrl;
    if (videoUrl) resp.videoUrl = videoUrl;
    if (audioUrl) resp.audioUrl = audioUrl;
    if (includeQr.toLowerCase() === "true") resp.includeQrCode = true;
    if (includePix.toLowerCase() === "true") resp.includePixCode = true;
    if (includeCheckout.toLowerCase() === "true") resp.includeCheckoutUrl = true;

    if (Object.keys(resp).length > 0) {
      responses.push(resp);
    }
  }

  return responses;
}

export function exportPaymentFlowCsv(responses: LivePixResponse[]): string {
  if (responses.length === 0) return "";

  const rows: string[][] = responses.map((resp) => [
    resp.text ?? "",
    resp.imageUrl ?? "",
    resp.videoUrl ?? "",
    resp.audioUrl ?? "",
    resp.includeQrCode ? "true" : "false",
    resp.includePixCode ? "true" : "false",
    resp.includeCheckoutUrl ? "true" : "false",
  ]);

  return generateCsv([...PAYMENT_FLOW_HEADERS], rows);
}

export type ButtonPreset = {
  id: string;
  name: string;
  label: string;
  action: ButtonAction;
  color: ButtonColor;
  url?: string;
  price?: number;
};

export function parseButtonPresetsCsv(data: string[][]): {
  presets: Omit<ButtonPreset, "id">[];
  errors: CsvParseError[];
} {
  if (data.length < 2) return { presets: [], errors: [] };

  const presets: Omit<ButtonPreset, "id">[] = [];
  const errors: CsvParseError[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every((cell) => !cell.trim())) continue;

    const rowNum = i + 1;
    const name = colSafe(row, 0);
    const label = colSafe(row, 1);
    const action = colSafe(row, 2).toUpperCase();
    const url = colSafe(row, 3);
    const priceVal = colSafe(row, 4);
    const color = colSafe(row, 5).toUpperCase();

    const rowErrors: CsvParseError[] = [];

    if (!name) {
      rowErrors.push({ row: rowNum, field: "name", message: "Name is required" });
    }
    if (!label) {
      rowErrors.push({ row: rowNum, field: "label", message: "Label is required" });
    }
    if (!VALID_ACTIONS.has(action)) {
      rowErrors.push({
        row: rowNum,
        field: "action",
        message: `Invalid action "${action}". Must be OPEN_URL or LIVEPIX_PAYMENT`,
      });
    }
    if (!VALID_COLORS.has(color)) {
      rowErrors.push({
        row: rowNum,
        field: "color",
        message: `Invalid color "${color}". Must be BLUE, GREEN, or RED`,
      });
    }
    if (action === "OPEN_URL" && !url) {
      rowErrors.push({
        row: rowNum,
        field: "url",
        message: "URL is required for OPEN_URL action",
      });
    }
    if (action === "LIVEPIX_PAYMENT") {
      const price = parseFloat(priceVal);
      if (!Number.isFinite(price) || price <= 0) {
        rowErrors.push({
          row: rowNum,
          field: "price",
          message: "Price must be a positive number for LivePix buttons",
        });
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    presets.push({
      name,
      label,
      action: action as ButtonAction,
      color: color as ButtonColor,
      url: action === "OPEN_URL" ? url : undefined,
      price:
        action === "LIVEPIX_PAYMENT"
          ? Math.round(parseFloat(priceVal) * 100) / 100
          : undefined,
    });
  }

  return { presets, errors };
}

export function presetsToCsvRows(presets: ButtonPreset[]): string[][] {
  return presets.map((p) => [
    p.name,
    p.label,
    p.action,
    p.action === "OPEN_URL" ? (p.url ?? "") : "",
    p.action === "LIVEPIX_PAYMENT" ? String(p.price ?? "") : "",
    p.color,
  ]);
}

export function presetsToCsv(presets: ButtonPreset[]): string {
  return generateCsv(
    [...BUTTON_PRESET_HEADERS],
    presetsToCsvRows(presets),
  );
}

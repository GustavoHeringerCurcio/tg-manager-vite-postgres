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

export const LIVEPIX_RESPONSES_HEADERS = [
  "step_id",
  "button_label",
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

export type LivePixResponseRow = {
  step_id: string;
  button_label: string;
  text: string;
  image_url: string;
  video_url: string;
  audio_url: string;
  include_qr_code: string;
  include_pix_code: string;
  include_checkout_url: string;
  errors: CsvParseError[];
};

export function parseLivePixResponsesCsv(data: string[][]): LivePixResponseRow[] {
  if (data.length < 2) return [];

  const rows = data.slice(1);
  const responseRows: LivePixResponseRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => !cell.trim())) continue;

    const stepId = colSafe(row, 0);
    const buttonLabel = colSafe(row, 1);
    const text = colSafe(row, 2);
    const imageUrl = colSafe(row, 3);
    const videoUrl = colSafe(row, 4);
    const audioUrl = colSafe(row, 5);
    const includeQr = colSafe(row, 6);
    const includePix = colSafe(row, 7);
    const includeCheckout = colSafe(row, 8);

    const errors: CsvParseError[] = [];
    const rowNum = i + 2;

    if (!stepId) {
      errors.push({ row: rowNum, field: "step_id", message: "step_id is required" });
    }
    if (!buttonLabel) {
      errors.push({
        row: rowNum,
        field: "button_label",
        message: "button_label is required",
      });
    }

    responseRows.push({
      step_id: stepId,
      button_label: buttonLabel,
      text,
      image_url: imageUrl,
      video_url: videoUrl,
      audio_url: audioUrl,
      include_qr_code: includeQr,
      include_pix_code: includePix,
      include_checkout_url: includeCheckout,
      errors,
    });
  }

  return responseRows;
}

export function applyLivePixResponses(
  steps: MessageStep[],
  responseRows: LivePixResponseRow[],
): { steps: MessageStep[]; errors: CsvParseError[] } {
  const updated = steps.map((s) => ({
    ...s,
    buttons: s.buttons.map((b) => ({ ...b, responses: b.responses ? [...b.responses] : undefined })),
  }));

  const errors: CsvParseError[] = [];

  const grouped = new Map<string, LivePixResponseRow[]>();
  for (const r of responseRows) {
    const key = `${r.step_id}|${r.button_label}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  for (const [key, rows] of grouped) {
    const [stepId, buttonLabel] = key.split("|");

    const step = updated.find((s) => s.id === stepId);
    if (!step) {
      errors.push({
        row: 0,
        field: "step_id",
        message: `Step "${stepId}" not found in current flow`,
      });
      continue;
    }

    const button = step.buttons.find(
      (b) => b.label === buttonLabel && b.action === "LIVEPIX_PAYMENT",
    );
    if (!button) {
      errors.push({
        row: 0,
        field: "button_label",
        message: `LivePix button "${buttonLabel}" not found in step "${stepId}"`,
      });
      continue;
    }

    const responses: LivePixResponse[] = [];
    for (const row of rows) {
      if (row.errors.length > 0) continue;

      const resp: LivePixResponse = {};
      if (row.text) resp.text = row.text;
      if (row.image_url) resp.imageUrl = row.image_url;
      if (row.video_url) resp.videoUrl = row.video_url;
      if (row.audio_url) resp.audioUrl = row.audio_url;
      if (row.include_qr_code.toLowerCase() === "true") resp.includeQrCode = true;
      if (row.include_pix_code.toLowerCase() === "true") resp.includePixCode = true;
      if (row.include_checkout_url.toLowerCase() === "true") resp.includeCheckoutUrl = true;

      if (Object.keys(resp).length > 0) {
        responses.push(resp);
      }
    }

    if (responses.length > 0) {
      button.responses = responses;
    }
  }

  return { steps: updated, errors };
}

export function exportLivePixResponsesCsv(steps: MessageStep[]): string {
  const rows: string[][] = [];

  for (const step of steps) {
    for (const btn of step.buttons) {
      if (btn.action !== "LIVEPIX_PAYMENT" || !btn.responses || btn.responses.length === 0) continue;

      for (const resp of btn.responses) {
        rows.push([
          step.id,
          btn.label,
          resp.text ?? "",
          resp.imageUrl ?? "",
          resp.videoUrl ?? "",
          resp.audioUrl ?? "",
          resp.includeQrCode ? "true" : "false",
          resp.includePixCode ? "true" : "false",
          resp.includeCheckoutUrl ? "true" : "false",
        ]);
      }
    }
  }

  return generateCsv([...LIVEPIX_RESPONSES_HEADERS], rows);
}

export function downloadLivePixResponsesCsv(steps: MessageStep[], filename: string): void {
  const csv = exportLivePixResponsesCsv(steps);
  if (!csv) return;
  downloadCsv(filename, csv);
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

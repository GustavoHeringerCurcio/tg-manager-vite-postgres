import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } }
    : undefined,
});

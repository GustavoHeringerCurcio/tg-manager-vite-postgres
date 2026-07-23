export const BASE_URL = __ENV.TEST_APP_URL || "http://localhost:3000";
export const BOT_ID = __ENV.TEST_BOT_ID || "test-bot-id";

export const SCENARIOS = {
  smoke: {
    vus: 2,
    duration: "10s",
  },
  load_20: {
    stages: [
      { duration: "30s", target: 5 },
      { duration: "30s", target: 10 },
      { duration: "30s", target: 20 },
      { duration: "2m", target: 20 },
      { duration: "30s", target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: "1m", target: 20 },
      { duration: "2m", target: 20 },
      { duration: "1m", target: 50 },
      { duration: "2m", target: 50 },
      { duration: "1m", target: 0 },
    ],
  },
  spike: {
    stages: [
      { duration: "10s", target: 5 },
      { duration: "10s", target: 50 },
      { duration: "10s", target: 5 },
      { duration: "10s", target: 50 },
      { duration: "10s", target: 5 },
    ],
  },
} as const;

export const THRESHOLDS = {
  http_req_duration: ["p(95)<3000", "p(99)<5000"],
  http_req_failed: ["rate<0.05"],
  "http_req_duration{name:webhook-start}": ["p(95)<3000"],
  "http_req_duration{name:webhook-callback}": ["p(95)<3000"],
  "http_req_duration{name:webhook-mixed}": ["p(95)<3000"],
};

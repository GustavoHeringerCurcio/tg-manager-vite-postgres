import QRCode from "qrcode";
import type { LivePixPayment } from "../../src/services/livepix.js";

let referenceCounter = 0;
const mockReferences = new Map<string, { amount: number; status: "PENDING" | "COMPLETED" }>();

function nextReference(): string {
  return `mock_ref_${++referenceCounter}_${Date.now()}`;
}

function nextCheckoutUrl(): string {
  return `https://checkout.livepix.gg/mock/${nextReference()}`;
}

function mockPixCode(): string {
  return "00020126580014BR.GOV.BCB.PIX0136123e4567e89b12d3a4567890123456404AC2016mock.example.com0303BR5901N6001C6014MOCK_CITY62070503***6304E3CA";
}

export class MockLivePixService {
  async createPayment(amountBrl: number, _redirectUrlOverride?: string): Promise<LivePixPayment> {
    const reference = nextReference();
    const checkoutUrl = nextCheckoutUrl();
    mockReferences.set(reference, { amount: Math.round(amountBrl * 100), status: "PENDING" });
    return { reference, checkoutUrl };
  }

  async extractPixCode(_checkoutUrl: string): Promise<string> {
    return mockPixCode();
  }

  async checkPayment(reference: string): Promise<{ status: string; amount: number | undefined } | null> {
    const payment = mockReferences.get(reference);
    if (!payment) return null;
    if (payment.status === "COMPLETED") {
      return { status: "COMPLETED", amount: payment.amount };
    }
    return { status: "PENDING", amount: payment.amount };
  }

  simulatePaymentCompleted(reference: string): void {
    const payment = mockReferences.get(reference);
    if (payment) {
      payment.status = "COMPLETED";
    }
  }

  async generateQrCode(_pixCode: string): Promise<Buffer> {
    return QRCode.toBuffer("MOCK_QR_CODE", {
      type: "png",
      width: 512,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }

  clear(): void {
    referenceCounter = 0;
    mockReferences.clear();
  }
}

let mockInstance: MockLivePixService | null = null;

export function getMockLivePix(): MockLivePixService {
  if (!mockInstance) {
    mockInstance = new MockLivePixService();
  }
  return mockInstance;
}

export function resetMockLivePix(): void {
  mockInstance?.clear();
  mockInstance = null;
}

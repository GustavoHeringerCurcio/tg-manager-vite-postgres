export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function messageFromError(error: Error): string {
  return error.message || "Unexpected error";
}

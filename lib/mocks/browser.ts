import { setupWorker } from "msw/browser";
import { handlers } from "@/lib/mocks/handlers";

export const worker = setupWorker(...handlers);

let startPromise: Promise<void> | null = null;

export function startMockWorker(): Promise<void> {
  if (!startPromise) {
    startPromise = worker
      .start({ onUnhandledFrame: "bypass", quiet: true })
      .then(() => undefined);
  }
  return startPromise;
}

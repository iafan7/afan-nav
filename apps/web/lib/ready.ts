import { bootstrap } from "./auth/bootstrap";

let ready: Promise<void> | null = null;

export async function ensureReady() {
  if (!ready) {
    ready = bootstrap();
  }
  await ready;
}

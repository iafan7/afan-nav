import { bootstrapDatabase } from "../db/seed";

/** First-boot: schema + admin password hash + default engines. */
export async function bootstrap() {
  await bootstrapDatabase();
}

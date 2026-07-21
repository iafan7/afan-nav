import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../db/client";
import { dailyQuoteCache } from "../db/schema";
import {
  DAILY_QUOTE_FALLBACK,
  HITOKOTO_API_URL,
  dayKey,
  mapHitokotoResponse,
  toPublicQuote,
} from "../daily-quote";
import { ensureReady } from "../ready";

function nowIso() {
  return new Date().toISOString();
}

async function fetchHitokoto(signal?: AbortSignal) {
  const res = await fetch(HITOKOTO_API_URL, {
    signal,
    next: { revalidate: 0 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`hitokoto ${res.status}`);
  return mapHitokotoResponse(await res.json());
}

type PublicQuotePayload = { quote: { content: string; author: string | null } };

/** In-flight fetch per dayKey — concurrent callers share one Hitokoto request. */
const inflightByDay = new Map<string, Promise<PublicQuotePayload>>();

async function fetchAndCache(key: string): Promise<PublicQuotePayload> {
  const db = getDb();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const remote = await fetchHitokoto(controller.signal).finally(() => clearTimeout(timer));
    if (!remote) {
      return { quote: toPublicQuote(null) };
    }

    getSqlite()
      .transaction(() => {
        db.insert(dailyQuoteCache)
          .values({
            dayKey: key,
            content: remote.content,
            author: remote.author,
            fetchedAt: nowIso(),
          })
          .onConflictDoUpdate({
            target: dailyQuoteCache.dayKey,
            set: {
              content: remote.content,
              author: remote.author,
              fetchedAt: nowIso(),
            },
          })
          .run();
      })();

    return { quote: toPublicQuote(remote) };
  } catch {
    return { quote: { content: DAILY_QUOTE_FALLBACK, author: null } };
  }
}

/**
 * Public daily quote from Hitokoto (free API).
 * Same calendar day → cached row; API failure → fixed fallback (never 500).
 * Concurrent cache-miss requests share one in-flight fetch.
 */
export async function getPublicDailyQuote(date: Date = new Date()) {
  await ensureReady();
  const key = dayKey(date);
  const db = getDb();

  const cached = db.select().from(dailyQuoteCache).where(eq(dailyQuoteCache.dayKey, key)).get();
  if (cached) {
    return { quote: toPublicQuote({ content: cached.content, author: cached.author }) };
  }

  let pending = inflightByDay.get(key);
  if (!pending) {
    pending = fetchAndCache(key).finally(() => {
      inflightByDay.delete(key);
    });
    inflightByDay.set(key, pending);
  }
  return pending;
}

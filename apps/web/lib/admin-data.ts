import { cache } from "react";
import { listCategories } from "@/lib/services/categories";
import { listLinks } from "@/lib/services/links";
import { getSettings, listSearchEngines } from "@/lib/services/settings";

/** Per-request memoization for RSC / layout (no HTTP hop). */
export const getAdminSettings = cache(getSettings);
export const getAdminCategories = cache(listCategories);
export const getAdminLinks = cache(listLinks);
export const getAdminSearchEngines = cache(listSearchEngines);
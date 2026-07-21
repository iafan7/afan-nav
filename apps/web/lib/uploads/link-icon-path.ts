/** Pure helpers safe for client bundles (no fs / db). */

export function isUploadedLinkIconPath(value: string) {
  return /^\/api\/uploads\/link-icons\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/i.test(value.trim());
}

export const LINK_ICON_STORED_NAME = /^[a-zA-Z0-9_-]+\.(png|jpg|webp)$/;

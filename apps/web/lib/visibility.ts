/** DB stores public/private; UI: 公开 / 私有. */

export type VisibilityDb = "public" | "private";

export function visibilityLabel(value: VisibilityDb): "公开" | "私有" {
  return value === "public" ? "公开" : "私有";
}

export function visibilityTagClass(value: VisibilityDb): "tag-public" | "tag-private" {
  return value === "public" ? "tag-public" : "tag-private";
}

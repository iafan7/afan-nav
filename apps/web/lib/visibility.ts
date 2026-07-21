/** DB stores public/private; product UI means 前台显示 / 隐藏. */

export type VisibilityDb = "public" | "private";

export function visibilityLabel(value: VisibilityDb): "显示" | "隐藏" {
  return value === "public" ? "显示" : "隐藏";
}

export function visibilityTagClass(value: VisibilityDb): "tag-public" | "tag-private" {
  return value === "public" ? "tag-public" : "tag-private";
}

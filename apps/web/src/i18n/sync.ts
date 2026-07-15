export type Messages = { [key: string]: string | Messages };

/**
 * Đồng bộ khung en theo vi (source of truth):
 * - key thiếu → thêm `__TODO__ <bản vi>`; key thừa → xoá; key đã dịch → giữ.
 * - Thứ tự key theo vi.json để diff ổn định.
 */
export function syncMessages(
  vi: Messages,
  en: Messages,
  prefix = "",
): { result: Messages; added: string[]; removed: string[] } {
  const result: Messages = {};
  const added: string[] = [];
  const removed: string[] = [];

  for (const [key, viVal] of Object.entries(vi)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const enVal = en[key];
    if (typeof viVal === "string") {
      if (typeof enVal === "string") result[key] = enVal;
      else {
        result[key] = `__TODO__ ${viVal}`;
        added.push(path);
      }
    } else {
      const child = syncMessages(viVal, typeof enVal === "object" && enVal ? enVal : {}, path);
      result[key] = child.result;
      added.push(...child.added);
      removed.push(...child.removed);
    }
  }
  for (const key of Object.keys(en)) {
    if (!(key in vi)) removed.push(prefix ? `${prefix}.${key}` : key);
  }
  return { result, added, removed };
}

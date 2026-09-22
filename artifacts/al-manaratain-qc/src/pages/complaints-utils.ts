export type ComplaintCategory = "Ready Mix" | "Block" | "Paving" | "Sand" | "Other";

export function complaintCategory(materialType: string): ComplaintCategory {
  const normalized = materialType.trim().toUpperCase();

  if (/\b(?:OPC|SRC)\b/.test(normalized)) return "Ready Mix";
  if (/\b(?:4|6|8)\s*(?:["'″”]|IN(?:CH(?:ES)?)?)(?:\s|$)/.test(normalized)) {
    return "Block";
  }
  if (/\b(?:60|80)\s*MM\b/.test(normalized) || /\bBUFF\b/.test(normalized)) return "Paving";
  if (/\bSAND\b/.test(normalized)) return "Sand";
  return "Other";
}
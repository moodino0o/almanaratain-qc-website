import type { ReportTemplateObject } from "@workspace/api-client-react";
import { REPORT_LAYOUT_FIELD_GROUPS } from "./report-layout-fields";

let localId = 0;

export function createDesignerId(prefix = "object") {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${prefix}-${randomId}`;
  localId += 1;
  return `${prefix}-${Date.now()}-${localId}`;
}

export function parentIdFor(
  object: ReportTemplateObject,
  objects: ReportTemplateObject[],
): string | undefined {
  if (object.parentId) return object.parentId;
  if (object.type === "section" || !object.sectionKey) return undefined;
  return objects.find((candidate) =>
    candidate.type === "section" && candidate.sectionKey === object.sectionKey,
  )?.id;
}

export function directChildren(objects: ReportTemplateObject[], parentId: string) {
  return objects.filter((object) => parentIdFor(object, objects) === parentId);
}

export function sectionForObject(
  object: ReportTemplateObject,
  objects: ReportTemplateObject[],
): ReportTemplateObject | undefined {
  const visited = new Set<string>();
  let current: ReportTemplateObject | undefined = object;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.type === "section") return current;
    const parentId = parentIdFor(current, objects);
    current = parentId ? objects.find((candidate) => candidate.id === parentId) : undefined;
  }
  return undefined;
}

export function absolutePosition(
  object: ReportTemplateObject,
  objects: ReportTemplateObject[],
  visited = new Set<string>(),
): { x: number; y: number } {
  if (visited.has(object.id)) return { x: object.x, y: object.y };
  visited.add(object.id);
  const parentId = parentIdFor(object, objects);
  const parent = parentId ? objects.find((candidate) => candidate.id === parentId) : undefined;
  if (!parent) return { x: object.x, y: object.y };
  const position = absolutePosition(parent, objects, visited);
  return { x: position.x + object.x, y: position.y + object.y };
}

export function visibleWithParents(
  object: ReportTemplateObject,
  objects: ReportTemplateObject[],
  visited = new Set<string>(),
): boolean {
  if (!object.visible || visited.has(object.id)) return false;
  visited.add(object.id);
  const parentId = parentIdFor(object, objects);
  const parent = parentId ? objects.find((candidate) => candidate.id === parentId) : undefined;
  return parent ? visibleWithParents(parent, objects, visited) : true;
}

export function descendantsOf(objects: ReportTemplateObject[], rootId: string) {
  const descendants: ReportTemplateObject[] = [];
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift()!;
    const children = directChildren(objects, parentId);
    descendants.push(...children);
    queue.push(...children.map((child) => child.id));
  }
  return descendants;
}

export function createTableStructure(
  table: ReportTemplateObject,
  objects: ReportTemplateObject[],
  testType: string,
): ReportTemplateObject[] {
  if (table.type !== "table") return [];
  const columns = REPORT_LAYOUT_FIELD_GROUPS[testType]?.[table.tableKey ?? ""] ?? [];
  if (!columns.length) return [];
  const columnWidth = table.width / columns.length;
  const rowHeight = 8;
  const rows: ReportTemplateObject[] = [];

  for (const [rowIndex, rowType] of (["header", "dynamic"] as const).entries()) {
    const rowId = createDesignerId("row");
    rows.push({
      id: rowId,
      parentId: table.id,
      type: "tableRow",
      rowType,
      name: rowType === "header" ? "Header Row" : "Dynamic Data Row",
      x: 0,
      y: rowIndex * rowHeight,
      width: table.width,
      height: rowHeight,
      zIndex: table.zIndex + rowIndex + 1,
      rotation: 0,
      locked: false,
      visible: true,
      sectionKey: table.sectionKey,
      backgroundColor: rowType === "header" ? "#9b1739" : undefined,
      textColor: rowType === "header" ? "#ffffff" : "#20252b",
      fontFamily: table.fontFamily ?? "Arial",
      fontSize: table.fontSize ?? 9,
      borderColor: table.borderColor ?? "#9aa6b2",
      borderWidth: 0.5,
      padding: 1,
      textAlign: rowType === "header" ? "center" : "left",
    });
    columns.forEach((column, columnIndex) => {
      rows.push({
        id: createDesignerId("cell"),
        parentId: rowId,
        type: "tableCell",
        name: column.label,
        x: columnIndex * columnWidth,
        y: 0,
        width: columnWidth,
        height: rowHeight,
        zIndex: table.zIndex + rowIndex + 2,
        rotation: 0,
        locked: false,
        visible: true,
        sectionKey: table.sectionKey,
        columnIndex,
        content: rowType === "header" ? column.label : undefined,
        fieldKey: rowType === "dynamic" ? `details.${column.key}` : undefined,
        fontFamily: table.fontFamily ?? "Arial",
        fontSize: table.fontSize ?? 9,
        textColor: rowType === "header" ? "#ffffff" : "#20252b",
        backgroundColor: rowType === "header" ? "#9b1739" : undefined,
        textAlign: rowType === "header" ? "center" : "left",
        borderColor: table.borderColor ?? "#9aa6b2",
        borderWidth: 0.5,
        padding: 1,
      });
    });
  }
  return rows;
}

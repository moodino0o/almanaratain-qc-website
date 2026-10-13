import assert from "node:assert/strict";
import test from "node:test";
import type { ReportTemplateObject } from "@workspace/api-client-react";
import {
  absolutePosition,
  createTableStructure,
  descendantsOf,
  directChildren,
  parentIdFor,
  sectionForObject,
  visibleWithParents,
} from "./report-designer-model";

function object(id: string, type: ReportTemplateObject["type"], patch: Partial<ReportTemplateObject> = {}): ReportTemplateObject {
  return {
    id,
    type,
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    zIndex: 1,
    rotation: 0,
    locked: false,
    visible: true,
    ...patch,
  } as ReportTemplateObject;
}

test("parent-relative coordinates and hierarchy traverse nested sections, tables, rows, and cells", () => {
  const section = object("section", "section", { x: 10, y: 20, sectionKey: "body" });
  const table = object("table", "table", { x: 5, y: 6, parentId: section.id });
  const row = object("row", "tableRow", { x: 1, y: 2, parentId: table.id });
  const cell = object("cell", "tableCell", { x: 3, y: 4, parentId: row.id });
  const objects = [section, table, row, cell];

  assert.deepEqual(absolutePosition(cell, objects), { x: 19, y: 32 });
  assert.equal(parentIdFor(row, objects), table.id);
  assert.equal(sectionForObject(cell, objects)?.id, section.id);
  assert.deepEqual(directChildren(objects, table.id).map((item) => item.id), [row.id]);
  assert.deepEqual(descendantsOf(objects, table.id).map((item) => item.id), [row.id, cell.id]);
});

test("legacy sectionKey children remain compatible and parent visibility cascades", () => {
  const section = object("header", "section", { sectionKey: "header", visible: false });
  const legacyChild = object("legacy", "text", { sectionKey: "header" });
  const objects = [section, legacyChild];

  assert.equal(parentIdFor(legacyChild, objects), section.id);
  assert.equal(visibleWithParents(legacyChild, objects), false);
});

test("new structured tables create header and repeating rows with independent cells", () => {
  const table = object("table", "table", { tableKey: "sieveResults" });
  const children = createTableStructure(table, [table], "Sand Sieve");
  const rows = children.filter((child) => child.type === "tableRow");
  const header = rows.find((row) => row.rowType === "header")!;
  const data = rows.find((row) => row.rowType === "dynamic")!;
  const headerCells = children.filter((child) => child.parentId === header.id && child.type === "tableCell");
  const dataCells = children.filter((child) => child.parentId === data.id && child.type === "tableCell");

  assert.equal(rows.length, 2);
  assert.ok(headerCells.length > 0);
  assert.equal(dataCells.length, headerCells.length);
  assert.ok(dataCells.every((cell) => cell.fieldKey?.startsWith("details.")));
});
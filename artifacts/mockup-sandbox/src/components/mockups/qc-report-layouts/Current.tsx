import "./_group.css";

import { useState } from "react";
import { Settings2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TestType = "Blocks" | "Ready Mix" | "Sand Sieve" | "Aggregate Sieve" | "Paving Blocks";
type Column = { key: string; label: string; visible: boolean; order: number; width: number };
type Section = { key: string; label: string; visible: boolean; order: number };
type LayoutConfig = {
  title: string;
  fontFamily: "Arial" | "Calibri" | "Times New Roman" | "Helvetica";
  fontSize: number;
  textColor: string;
  accentColor: string;
  paperPadding: number;
  sections: Section[];
  columns: Record<string, Column[]>;
};
type Layout = { id: number; testType: TestType; name: string; config: LayoutConfig };

const REPORT_LAYOUT_COLUMN_OPTIONS: Record<string, Array<{ key: string; label: string }>> = {
  blockCompression: [
    { key: "no", label: "No." }, { key: "length", label: "Length (mm)" }, { key: "width", label: "Width (mm)" },
    { key: "height", label: "Height (mm)" }, { key: "load", label: "Load (kN)" }, { key: "water", label: "Water (N/mm2)" },
    { key: "airDry", label: "Air Dry (N/mm2)" }, { key: "normalized", label: "Normalized (N/mm2)" },
    { key: "density", label: "Density (kg/m3)" }, { key: "wetWeight", label: "Wet Weight (kg)" },
  ],
  readyMixResults: [
    { key: "no", label: "No." }, { key: "age", label: "Test Age" }, { key: "length", label: "Length (mm)" },
    { key: "width", label: "Width (mm)" }, { key: "height", label: "Height (mm)" }, { key: "dryWeight", label: "Dry Weight" },
    { key: "wetWeight", label: "Wet Weight" }, { key: "absorption", label: "Water Absorption (%)" },
    { key: "load", label: "Load (kN)" }, { key: "strength", label: "Calculated Strength" },
  ],
  sieveResults: [
    { key: "no", label: "No." }, { key: "size", label: "Sieve / Pore Size" }, { key: "returned", label: "Mass Retained (g)" },
    { key: "retained", label: "Retained (%)" }, { key: "passing", label: "Amount Passing (g)" }, { key: "percentage", label: "Passing (%)" },
    { key: "lower", label: "Lower Limit" }, { key: "upper", label: "Upper Limit" }, { key: "remarks", label: "Remarks" },
  ],
  pavingResults: [
    { key: "no", label: "Block No." }, { key: "length", label: "Length (mm)" }, { key: "width", label: "Width (mm)" },
    { key: "height", label: "Height (mm)" }, { key: "load", label: "Load (kN)" }, { key: "tensileStrength", label: "Tensile Strength (N/mm²)" },
    { key: "weightBefore", label: "Weight Before (kg)" }, { key: "weightAfter", label: "Weight After (kg)" },
    { key: "density", label: "Density (kg/m³)" }, { key: "waterAbsorption", label: "% Water Absorption" },
  ],
};

const REPORT_LAYOUT_TABLE_LABELS: Record<string, string> = {
  blockCompression: "Block compression results",
  readyMixResults: "Ready Mix specimen results",
  sieveResults: "Sieve results",
  pavingResults: "Paving Block specimen results",
};

const sections = (items: Array<[string, string]>) => items.map(([key, label], order) => ({ key, label, visible: true, order }));
const columns = (tableKey: string, keys: string[]): Column[] =>
  keys.map((key, order) => ({ ...REPORT_LAYOUT_COLUMN_OPTIONS[tableKey].find((option) => option.key === key)!, visible: true, order, width: 10 }));
const baseConfig = (tableKey: string, title: string, keys: string[]): LayoutConfig => ({
  title, fontFamily: "Arial", fontSize: 12, textColor: "#20252b", accentColor: "#b60251", paperPadding: 13,
  sections: sections([["header", "Company header"], ["sample", "Sample details"], ["results", "Test results"], ["remarks", "Remarks"], ["signatures", "Signatures"]]),
  columns: { [tableKey]: columns(tableKey, keys) },
});

const INITIAL_LAYOUTS: Layout[] = [
  { id: 1, testType: "Blocks", name: "Block compression", config: baseConfig("blockCompression", "Concrete Block Compression Test", ["no", "length", "width", "height", "load", "airDry", "normalized"]) },
  { id: 2, testType: "Ready Mix", name: "Ready mix specimen", config: baseConfig("readyMixResults", "Ready Mix Concrete Test Results", ["no", "age", "load", "strength"]) },
  { id: 3, testType: "Sand Sieve", name: "Sand sieve analysis", config: baseConfig("sieveResults", "Sieve Analysis Report", ["no", "size", "returned", "retained", "passing", "percentage", "remarks"]) },
  { id: 4, testType: "Paving Blocks", name: "Paving block specimen", config: baseConfig("pavingResults", "Paving Block Test Results", ["no", "length", "width", "height", "load", "tensileStrength", "density"]) },
];

function tableKeyFor(testType: TestType) {
  if (testType === "Blocks") return "blockCompression";
  if (testType === "Ready Mix") return "readyMixResults";
  if (testType === "Sand Sieve" || testType === "Aggregate Sieve") return "sieveResults";
  if (testType === "Paving Blocks") return "pavingResults";
  return "";
}

export function Current() {
  const [layouts, setLayouts] = useState(INITIAL_LAYOUTS);
  const [selectedId, setSelectedId] = useState(1);
  const [draft, setDraft] = useState<Layout>(() => structuredClone(INITIAL_LAYOUTS[0]));
  const [saved, setSaved] = useState(false);
  const tableKey = tableKeyFor(draft.testType);
  const configuredColumns = draft.config.columns[tableKey] ?? [];
  const columnOptions = REPORT_LAYOUT_COLUMN_OPTIONS[tableKey] ?? [];
  const availableColumns = columnOptions.filter((option) => !configuredColumns.some((column) => column.key === option.key));
  const setConfig = (patch: Partial<LayoutConfig>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, config: { ...current.config, ...patch } }));
  };
  const updateColumn = (columnKey: string, patch: Partial<Column>) => setConfig({
    columns: { ...draft.config.columns, [tableKey]: configuredColumns.map((column) => column.key === columnKey ? { ...column, ...patch } : column) },
  });
  const selectLayout = (id: number) => {
    const next = layouts.find((layout) => layout.id === id);
    if (next) { setSelectedId(id); setDraft(structuredClone(next)); setSaved(false); }
  };
  const save = () => {
    setLayouts((current) => current.map((layout) => layout.id === draft.id ? structuredClone(draft) : layout));
    setSaved(true);
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <Card className="mx-auto mt-4 max-w-5xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> Report layouts</CardTitle>
          <CardDescription>Customize each report type. Changes affect new and existing printable reports and are limited to approved data fields.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1 text-sm font-medium">Report type
              <select value={selectedId} onChange={(event) => selectLayout(Number(event.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal">
                {layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.testType}</option>)}
              </select>
            </label>
            <label className="flex-1 space-y-1 text-sm font-medium">Report title
              <Input value={draft.config.title} onChange={(event) => setConfig({ title: event.target.value })} />
            </label>
            <Button onClick={save}>{saved ? "Saved" : "Save layout"}</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm font-medium">Font family
              <select value={draft.config.fontFamily} onChange={(event) => setConfig({ fontFamily: event.target.value as LayoutConfig["fontFamily"] })} className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal">
                {["Arial", "Calibri", "Times New Roman", "Helvetica"].map((font) => <option key={font}>{font}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Font size
              <Input type="number" min={8} max={24} value={draft.config.fontSize} onChange={(event) => setConfig({ fontSize: Number(event.target.value) })} />
            </label>
            <label className="space-y-1 text-sm font-medium">Text color
              <Input type="color" value={draft.config.textColor} onChange={(event) => setConfig({ textColor: event.target.value })} className="h-10 p-1" />
            </label>
            <label className="space-y-1 text-sm font-medium">Accent color
              <Input type="color" value={draft.config.accentColor} onChange={(event) => setConfig({ accentColor: event.target.value })} className="h-10 p-1" />
            </label>
            <label className="space-y-1 text-sm font-medium">Paper padding (mm)
              <Input type="number" min={5} max={30} value={draft.config.paperPadding} onChange={(event) => setConfig({ paperPadding: Number(event.target.value) })} />
            </label>
          </div>

          <div><h3 className="mb-2 text-sm font-semibold">Sections and position</h3>
            <div className="grid gap-2 md:grid-cols-2">{[...draft.config.sections].sort((left, right) => left.order - right.order).map((section) => (
              <div key={section.key} className="flex items-center gap-2 rounded-md border p-2">
                <input type="checkbox" checked={section.visible} onChange={(event) => setConfig({ sections: draft.config.sections.map((item) => item.key === section.key ? { ...item, visible: event.target.checked } : item) })} />
                <span className="min-w-0 flex-1 text-sm">{section.label}</span>
                <Input type="number" min={0} value={section.order} className="h-8 w-20" onChange={(event) => setConfig({ sections: draft.config.sections.map((item) => item.key === section.key ? { ...item, order: Number(event.target.value) } : item) })} />
              </div>
            ))}</div>
          </div>

          {tableKey && <div>
            <div className="mb-2 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{REPORT_LAYOUT_TABLE_LABELS[tableKey]}</h3><p className="text-xs text-muted-foreground">Change order, width, visibility, and labels. Add only supported fields.</p></div>
              <select disabled={!availableColumns.length} value="" onChange={(event) => { const option = columnOptions.find((item) => item.key === event.target.value); if (option) setConfig({ columns: { ...draft.config.columns, [tableKey]: [...configuredColumns, { ...option, visible: true, order: configuredColumns.length, width: 10 }] } }); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Add column…</option>{availableColumns.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">{configuredColumns.map((column) => <div key={column.key} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr_90px_90px_auto]">
              <input type="checkbox" checked={column.visible} onChange={(event) => updateColumn(column.key, { visible: event.target.checked })} />
              <Input value={column.label} onChange={(event) => updateColumn(column.key, { label: event.target.value })} />
              <Input type="number" min={0} value={column.order} onChange={(event) => updateColumn(column.key, { order: Number(event.target.value) })} aria-label={`${column.label} order`} />
              <Input type="number" min={1} max={100} value={column.width} onChange={(event) => updateColumn(column.key, { width: Number(event.target.value) })} aria-label={`${column.label} width`} />
              <Button variant="ghost" size="icon" onClick={() => setConfig({ columns: { ...draft.config.columns, [tableKey]: configuredColumns.filter((item) => item.key !== column.key) } })} aria-label={`Remove ${column.label}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>)}</div>
          </div>}
        </CardContent>
      </Card>
    </main>
  );
}
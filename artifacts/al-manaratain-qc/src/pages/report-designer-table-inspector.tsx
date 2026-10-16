import { useState } from "react";
import type { ReportTemplateObject } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { REPORT_LAYOUT_FIELD_GROUPS } from "./report-layout-fields";
import { directChildren } from "./report-designer-model";

export type TableInspectorAction =
  | "addRow"
  | "duplicateRow"
  | "deleteRow"
  | "addColumn"
  | "duplicateColumn"
  | "deleteColumn"
  | "duplicateCell"
  | "deleteCell";

type Props = {
  objects: ReportTemplateObject[];
  selected: ReportTemplateObject;
  testType: string;
  onChange: (patch: Partial<ReportTemplateObject>) => void;
  onAction: (action: TableInspectorAction, objectId: string) => void;
};

const fixedFields = [
  ["REPORT_TITLE", "Report title"],
  ["REPORT_NUMBER", "Report number"],
  ["REPORT_DATE", "Report date"],
  ["SAMPLE_DATE", "Sample date"],
  ["SUPPLIER", "Supplier"],
  ["SAMPLE_DESCRIPTION", "Sample description"],
  ["PROJECT", "Project"],
  ["TEST_METHOD", "Test method"],
  ["TEST_RESULT", "Test result"],
  ["COMPANY_NAME", "Company name"],
  ["SAMPLE_NUMBER", "Sample number"],
  ["MATERIAL", "Material"],
  ["LOCATION", "Location"],
  ["TESTED_BY", "Tested by"],
  ["REVIEWED_BY", "Reviewed by"],
  ["REMARKS", "Remarks"],
] as const;

function rowsForTable(objects: ReportTemplateObject[], tableId: string) {
  return directChildren(objects, tableId)
    .filter((object) => object.type === "tableRow")
    .sort((left, right) => left.y - right.y || left.zIndex - right.zIndex);
}

function cellsForRow(objects: ReportTemplateObject[], rowId: string) {
  return directChildren(objects, rowId)
    .filter((object) => object.type === "tableCell")
    .sort((left, right) => (left.columnIndex ?? left.x) - (right.columnIndex ?? right.x));
}

function FormulaBuilder({ testType, onBuild }: { testType: string; onBuild: (formula: string) => void }) {
  const fields = Object.values(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {}).flat();
  const [left, setLeft] = useState(fields[0]?.key ?? "");
  const [operation, setOperation] = useState("+");
  const [right, setRight] = useState(fields[1]?.key ?? fields[0]?.key ?? "");
  const token = (key: string) => `{{details.${key}}}`;
  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2" data-testid="section-formula-builder">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Formula builder</p>
      <select value={left} onChange={(event) => setLeft(event.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-formula-left-field" aria-label="First formula value">
        {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
      </select>
      <div className="grid grid-cols-[74px_1fr] gap-2">
        <select value={operation} onChange={(event) => setOperation(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" data-testid="select-formula-operator" aria-label="Formula operation">
          <option value="+">+</option><option value="-">−</option><option value="*">×</option><option value="/">÷</option><option value="%">%</option>
          <option value="SUM">SUM</option><option value="AVERAGE">AVERAGE</option><option value="MIN">MIN</option><option value="MAX">MAX</option><option value="ROUND">ROUND</option><option value="ABS">ABS</option>
        </select>
        <select value={right} onChange={(event) => setRight(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" data-testid="select-formula-right-field" aria-label="Second formula value">
          {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
          <option value="0">0 decimals</option><option value="1">1 decimal</option><option value="2">2 decimals</option><option value="3">3 decimals</option><option value="100">100</option>
        </select>
      </div>
      <button type="button" className="h-8 w-full rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90" onClick={() => {
        const first = token(left);
        const second = /^\d+(?:\.\d+)?$/.test(right) ? right : token(right);
        const formula = ["SUM", "AVERAGE", "MIN", "MAX"].includes(operation)
          ? `=${operation}(${first}, ${second})`
          : operation === "ROUND"
            ? `=ROUND(${first}, ${/^\d+(?:\.\d+)?$/.test(right) ? right : "0"})`
            : operation === "ABS"
              ? `=ABS(${first})`
              : `=${first} ${operation} ${second}`;
        onBuild(formula);
      }} data-testid="button-build-formula">Use formula</button>
    </div>
  );
}

function ColorField({ label, value, onChange, testId, disabled = false }: { label: string; value?: string; onChange: (value: string) => void; testId: string; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <Input type="color" value={value ?? "#ffffff"} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-8 w-12 p-1" data-testid={testId} />
    </label>
  );
}

function RowStyleInspector({ selected, onChange }: { selected: ReportTemplateObject; onChange: Props["onChange"] }) {
  const disabled = selected.locked;
  return (
    <section className="space-y-3 border-t border-border/70 pt-4" data-testid="section-row-properties">
      <p className="text-xs font-semibold">Row properties</p>
      <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Row type</span>
        <select value={selected.rowType ?? "static"} disabled={disabled} onChange={(event) => onChange({ rowType: event.target.value as ReportTemplateObject["rowType"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-table-row-type">
          <option value="header">Header</option><option value="static">Static row</option><option value="dynamic">Repeat for each report result</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Row height</span><Input type="number" min={1} step="0.5" value={selected.height} disabled={disabled} onChange={(event) => onChange({ height: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-row-height" /></label>
        <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Padding</span><Input type="number" min={0} max={100} value={selected.padding ?? 1} disabled={disabled} onChange={(event) => onChange({ padding: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-row-padding" /></label>
        <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Border width</span><Input type="number" min={0} max={20} step="0.1" value={selected.borderWidth ?? 0.5} disabled={disabled} onChange={(event) => onChange({ borderWidth: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-row-border-width" /></label>
        <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font size</span><Input type="number" min={6} max={96} value={selected.fontSize ?? 10} disabled={disabled} onChange={(event) => onChange({ fontSize: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-row-font-size" /></label>
      </div>
      <ColorField label="Background" value={selected.backgroundColor} disabled={disabled} onChange={(backgroundColor) => onChange({ backgroundColor })} testId="input-row-background" />
      <ColorField label="Border" value={selected.borderColor} disabled={disabled} onChange={(borderColor) => onChange({ borderColor })} testId="input-row-border-color" />
      <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font</span>
        <select value={selected.fontFamily ?? "Arial"} disabled={disabled} onChange={(event) => onChange({ fontFamily: event.target.value as ReportTemplateObject["fontFamily"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-row-font"><option>Arial</option><option>Calibri</option><option>Times New Roman</option><option>Helvetica</option></select>
      </label>
      <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Alignment</span>
        <select value={selected.textAlign ?? "left"} disabled={disabled} onChange={(event) => onChange({ textAlign: event.target.value as ReportTemplateObject["textAlign"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-row-alignment"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select>
      </label>
    </section>
  );
}

function CellInspector({ selected, testType, onChange, onAction }: Props) {
  const mode = selected.formula !== undefined ? "formula" : selected.fieldKey ? "dynamic" : "static";
  const fields = Object.values(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {}).flat();
  const dynamicFieldOptions = [
    ...fixedFields.map(([key, label]) => ({ key, label })),
    ...fields.map((field) => ({ key: `details.${field.key}`, label: field.label })),
  ];
  return (
    <>
      <section className="space-y-3 border-t border-border/70 pt-4" data-testid="section-cell-properties">
        <p className="text-xs font-semibold">Cell properties</p>
        <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cell content</span>
          <select value={mode} disabled={selected.locked} onChange={(event) => {
            const nextMode = event.target.value;
            onChange(nextMode === "static"
              ? { content: selected.content ?? "", fieldKey: undefined, formula: undefined }
              : nextMode === "dynamic"
                ? { content: undefined, fieldKey: selected.fieldKey ?? dynamicFieldOptions[0]?.key, formula: undefined }
                : { content: undefined, fieldKey: undefined, formula: selected.formula ?? "=0" });
          }} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-cell-content-type">
            <option value="static">Static value</option><option value="dynamic">Dynamic field</option><option value="formula">Formula</option>
          </select>
        </label>
        {mode === "static" && <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cell value</span><textarea value={selected.content ?? ""} disabled={selected.locked} onChange={(event) => onChange({ content: event.target.value, fieldKey: undefined, formula: undefined })} className="min-h-16 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" data-testid="textarea-cell-value" /></label>}
        {mode === "dynamic" && <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dynamic field</span><select value={selected.fieldKey ?? ""} disabled={selected.locked} onChange={(event) => onChange({ fieldKey: event.target.value, content: undefined, formula: undefined })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-cell-dynamic-field"><optgroup label="Report fields">{dynamicFieldOptions.filter((field) => !field.key.startsWith("details.")).map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</optgroup><optgroup label="Approved fields for this report">{dynamicFieldOptions.filter((field) => field.key.startsWith("details.")).map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</optgroup></select></label>}
        {mode === "formula" && <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Formula</span><textarea value={selected.formula ?? ""} disabled={selected.locked} onChange={(event) => onChange({ formula: event.target.value, fieldKey: undefined, content: undefined })} placeholder="=({{details.amountPassing}} / {{details.totalAmount}}) * 100" className="min-h-20 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs" data-testid="textarea-cell-formula" /><span className="text-[10px] text-muted-foreground">Allowed: +, −, ×, ÷, %, parentheses, SUM, AVERAGE, MIN, MAX, ROUND, ABS.</span><FormulaBuilder testType={testType} onBuild={(formula) => onChange({ formula, fieldKey: undefined, content: undefined })} /></label>}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font size</span><Input type="number" min={6} max={96} value={selected.fontSize ?? 10} disabled={selected.locked} onChange={(event) => onChange({ fontSize: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-cell-font-size" /></label>
          <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Padding</span><Input type="number" min={0} max={100} value={selected.padding ?? 1} disabled={selected.locked} onChange={(event) => onChange({ padding: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-cell-padding" /></label>
          <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Width (mm)</span><Input type="number" min={1} value={selected.width} disabled={selected.locked} onChange={(event) => onChange({ width: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-cell-width" /></label>
          <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Height (mm)</span><Input type="number" min={1} value={selected.height} disabled={selected.locked} onChange={(event) => onChange({ height: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-cell-height" /></label>
        </div>
        <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font</span><select value={selected.fontFamily ?? "Arial"} disabled={selected.locked} onChange={(event) => onChange({ fontFamily: event.target.value as ReportTemplateObject["fontFamily"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-cell-font"><option>Arial</option><option>Calibri</option><option>Times New Roman</option><option>Helvetica</option></select></label>
        <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Alignment</span><select value={selected.textAlign ?? "left"} disabled={selected.locked} onChange={(event) => onChange({ textAlign: event.target.value as ReportTemplateObject["textAlign"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-cell-alignment"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
        <div className="flex gap-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={selected.bold ?? false} disabled={selected.locked} onChange={(event) => onChange({ bold: event.target.checked })} data-testid="checkbox-cell-bold" />Bold</label><label className="flex items-center gap-2"><input type="checkbox" checked={selected.italic ?? false} disabled={selected.locked} onChange={(event) => onChange({ italic: event.target.checked })} data-testid="checkbox-cell-italic" />Italic</label></div>
        <ColorField label="Text color" value={selected.textColor} disabled={selected.locked} onChange={(textColor) => onChange({ textColor })} testId="input-cell-text-color" />
        <ColorField label="Background color" value={selected.backgroundColor} disabled={selected.locked} onChange={(backgroundColor) => onChange({ backgroundColor })} testId="input-cell-background" />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Border" value={selected.borderColor} disabled={selected.locked} onChange={(borderColor) => onChange({ borderColor })} testId="input-cell-border" />
          <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Border width</span><Input type="number" min={0} max={20} step="0.1" value={selected.borderWidth ?? 0.5} disabled={selected.locked} onChange={(event) => onChange({ borderWidth: Number(event.target.value) })} className="h-8 text-xs" data-testid="input-cell-border-width" /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="h-8 rounded-md border border-input text-[11px] hover:bg-muted" onClick={() => onAction("duplicateCell", selected.id)} data-testid="button-duplicate-cell">Duplicate Cell</button>
          <button type="button" className="h-8 rounded-md border border-destructive/40 text-[11px] text-destructive hover:bg-destructive/10" onClick={() => onAction("deleteCell", selected.id)} data-testid="button-delete-cell">Delete Cell</button>
          <button type="button" className="h-8 rounded-md border border-input text-[11px] hover:bg-muted" onClick={() => onAction("duplicateColumn", selected.id)} data-testid="button-duplicate-column-from-cell">Duplicate Column</button>
          <button type="button" className="h-8 rounded-md border border-destructive/40 text-[11px] text-destructive hover:bg-destructive/10" onClick={() => onAction("deleteColumn", selected.id)} data-testid="button-delete-column-from-cell">Delete Column</button>
        </div>
      </section>
    </>
  );
}

export function ReportDesignerTableInspector({ objects, selected, testType, onChange, onAction }: Props) {
  const selectedRow = selected.type === "tableRow" ? selected : undefined;
  const selectedCell = selected.type === "tableCell" ? selected : undefined;
  const row = selectedRow ?? (selectedCell?.parentId ? objects.find((item) => item.id === selectedCell.parentId) : undefined);
  const table = selected.type === "table"
    ? selected
    : row?.parentId
      ? objects.find((item) => item.id === row.parentId)
      : undefined;
  if (selected.type !== "table" && selected.type !== "tableRow" && selected.type !== "tableCell") return null;
  const rows = table ? rowsForTable(objects, table.id) : [];
  const columns = rows.length ? Math.max(...rows.map((item) => cellsForRow(objects, item.id).length)) : 0;
  const targetRowId = selectedRow?.id ?? rows.at(-1)?.id ?? "";
  const targetColumn = selectedCell?.columnIndex ?? Math.max(0, columns - 1);
  const button = (label: string, action: TableInspectorAction, disabled = false, testId = `button-${action}`) => (
    <button type="button" disabled={disabled} className="h-8 rounded-md border border-input px-2 text-[11px] hover:bg-muted disabled:opacity-50" onClick={() => onAction(action, selected.id)} data-testid={testId}>{label}</button>
  );

  return (
    <section className="space-y-3 border-t border-border/70 pt-4" data-testid="section-table-structure-inspector">
      {selected.type === "table" && table && (
        <>
          <p className="text-xs font-semibold">Table structure</p>
          <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded border p-2">Rows: <strong data-testid="text-table-row-count">{rows.length}</strong></div><div className="rounded border p-2">Columns: <strong data-testid="text-table-column-count">{columns}</strong></div></div>
          <div className="grid grid-cols-2 gap-2">
            {button("+ Add Row", "addRow", false, "button-table-add-row")}
            {button("+ Add Column", "addColumn", false, "button-table-add-column")}
            {button("Duplicate Row", "duplicateRow", !targetRowId, "button-table-duplicate-row")}
            {button("Delete Row", "deleteRow", !targetRowId, "button-table-delete-row")}
            {button("Duplicate Column", "duplicateColumn", columns === 0, "button-table-duplicate-column")}
            {button("Delete Column", "deleteColumn", columns === 0, "button-table-delete-column")}
          </div>
        </>
      )}
      {selectedRow && (
        <>
          <div className="flex items-center justify-between"><p className="text-xs font-semibold">Row properties</p><span className="text-[10px] text-muted-foreground">{selectedRow.rowType === "dynamic" ? "Repeats per result" : selectedRow.rowType ?? "Static"}</span></div>
          <RowStyleInspector selected={selectedRow} onChange={onChange} />
          <div className="grid grid-cols-2 gap-2">{button("Duplicate Row", "duplicateRow", false, "button-row-duplicate")}{button("Delete Row", "deleteRow", false, "button-row-delete")}</div>
        </>
      )}
      {selectedCell && <CellInspector objects={objects} selected={selectedCell} testType={testType} onChange={onChange} onAction={onAction} />}
    </section>
  );
}

export function ReportDesignerFormulaInspector({ selected, testType, onChange }: { selected: ReportTemplateObject; testType: string; onChange: Props["onChange"] }) {
  if (selected.type !== "formula") return null;
  return (
    <section className="space-y-3 border-t border-border/70 pt-4" data-testid="section-formula-properties">
      <p className="text-xs font-semibold">Calculated field</p>
      <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Formula</span><textarea value={selected.formula ?? ""} disabled={selected.locked} onChange={(event) => onChange({ formula: event.target.value })} placeholder="=AVERAGE({{details.strength}})" className="min-h-20 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs" data-testid="textarea-object-formula" /></label>
      <p className="text-[10px] text-muted-foreground">Formulas are evaluated when a report is generated.</p>
      <FormulaBuilder testType={testType} onBuild={(formula) => onChange({ formula })} />
    </section>
  );
}
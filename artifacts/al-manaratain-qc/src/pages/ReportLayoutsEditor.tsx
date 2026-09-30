import { useEffect, useMemo, useState } from "react";
import {
  type ReportLayout,
  type ReportLayoutColumn,
  type ReportLayoutConfig,
  type ReportLayoutElement,
  type ReportLayoutSection,
  useListReportLayouts,
  useListStrengthStandards,
  useListSieveStandards,
  useUpdateReportLayout,
  getListReportLayoutsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Trash2, Plus, Eye, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ReportDocument, createReportPreviewRecord } from "./report-print";
import { REPORT_LAYOUT_FIELD_GROUPS } from "./report-layout-fields";

const sectionNames: Record<string, string> = { header: "Company header", standard: "Report standard", sample: "Sample details", results: "Test results", remarks: "Remarks", signatures: "Signatures" };
const groupNames: Record<string, string> = { readyMixDetails: "Ready Mix details", readyMixResults: "Ready Mix results", blockDetails: "Block details", blockCompression: "Block compression results", pavingDetails: "Paving Block details", pavingResults: "Paving Block results", sieveSampleDetails: "Sieve sample details", sieveResults: "Sieve results", sieveChemicalDetails: "Sieve chemistry", waterDetails: "Water details", genericContext: "General context", flakinessDetails: "Flakiness & elongation", rmxTrialDetails: "RMX Trial", precastDetails: "Precast details", kerbStoneDetails: "Kerb Stone details" };

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
const editableGroupsByType: Record<string, string[]> = {
  "Ready Mix": ["readyMixResults"],
  Blocks: ["blockCompression"],
  "Paving Blocks": ["pavingResults"],
  "Sand Sieve": ["sieveResults"],
  "Aggregate Sieve": ["sieveResults"],
  Water: ["waterDetails"],
  "Flakiness & Elongation": ["flakinessDetails"],
  "RMX Trial": ["rmxTrialDetails"],
  Precast: ["precastDetails"],
  "Kerb Stone": ["kerbStoneDetails"],
};

function fieldGroups(layout: ReportLayout) {
  const available = REPORT_LAYOUT_FIELD_GROUPS[layout.testType] ?? {};
  return Object.fromEntries((editableGroupsByType[layout.testType] ?? [])
    .filter((key) => available[key])
    .map((key) => [key, available[key]]));
}

export function ReportLayoutsEditor() {
  const { data: layouts = [], isLoading, isError } = useListReportLayouts();
  const { data: strengthStandards = [] } = useListStrengthStandards();
  const { data: sieveStandards = [] } = useListSieveStandards();
  const update = useUpdateReportLayout();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number>();
  const [draft, setDraft] = useState<ReportLayout>();
  const [saved, setSaved] = useState(false);
  const selected = layouts.find((item) => item.id === selectedId) ?? layouts[0];

  useEffect(() => { if (selected && selected.id !== draft?.id) { setSelectedId(selected.id); setDraft(clone(selected)); setSaved(false); } }, [selected?.id]);

  const setConfig = (patch: Partial<ReportLayoutConfig>) => { setSaved(false); setDraft((current) => current && { ...current, config: { ...current.config, ...patch } }); };
  const groups = useMemo(() => draft ? fieldGroups(draft) : {}, [draft]);
  const save = () => {
    if (!draft) return;
    update.mutate({ id: draft.id, data: { name: draft.name, config: draft.config } }, {
      onSuccess: (result) => { setDraft(clone(result)); setSaved(true); queryClient.invalidateQueries({ queryKey: getListReportLayoutsQueryKey() }); toast.success(`${result.testType} report layout saved`); },
      onError: () => toast.error("Unable to save report layout"),
    });
  };

  if (isLoading) return <Card data-testid="status-report-layouts-loading"><CardContent className="p-6 text-sm text-muted-foreground">Loading report layouts…</CardContent></Card>;
  if (isError) return <Card><CardContent className="p-6 text-sm text-destructive" role="alert" data-testid="status-report-layouts-error">Report editor could not be loaded. Sign in as an administrator to edit layouts.</CardContent></Card>;
  if (!draft) return <Card><CardContent className="p-6 text-sm text-muted-foreground" data-testid="status-report-layouts-empty">No report layouts are configured.</CardContent></Card>;

  const config = draft.config;
  const updateSection = (key: string, patch: Partial<ReportLayoutSection>) => setConfig({ sections: config.sections.map((item) => item.key === key ? { ...item, ...patch } : item) });
  const updateElement = (key: string, patch: Partial<ReportLayoutElement>) => setConfig({ elements: (config.elements ?? []).map((item) => item.key === key ? { ...item, ...patch } : item) });
  const addElement = (type: "text" | "divider") => setConfig({ elements: [...(config.elements ?? []), { key: `layout-${Date.now()}`, type, sectionKey: "results", placement: "after", order: (config.elements ?? []).length, ...(type === "text" ? { content: "Additional note", fontFamily: "Arial", fontSize: 12, color: config.textColor, width: 100 } : { width: 100, lineStyle: "solid", color: config.textColor }) }] });

  return <Card className="mx-auto mt-4 max-w-5xl overflow-hidden" data-testid="card-report-layout-editor">
    <CardHeader className="border-b border-border/60 bg-muted/20">
      <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> Report layouts</CardTitle>
      <CardDescription>Customize each report type. Changes affect new and existing printable reports and are limited to approved data fields.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1 text-sm font-medium">Report type<select data-testid="select-report-type" value={draft.id} onChange={(event) => { setSelectedId(Number(event.target.value)); }} className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal">{layouts.map((item) => <option key={item.id} value={item.id}>{item.testType}</option>)}</select></label>
        <label className="flex-1 space-y-1 text-sm font-medium">Report title<Input data-testid="input-report-title" value={config.title} onChange={(event) => setConfig({ title: event.target.value })} /></label>
        <Button data-testid="button-save-report-layout" onClick={save} disabled={update.isPending}>{update.isPending ? "Saving…" : saved ? "Saved" : "Save layout"}</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-sm font-medium">Font family<select data-testid="select-global-font" value={config.fontFamily} onChange={(event) => setConfig({ fontFamily: event.target.value as ReportLayoutConfig["fontFamily"] })} className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal">{["Arial", "Calibri", "Times New Roman", "Helvetica"].map((font) => <option key={font}>{font}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium">Font size<Input data-testid="input-global-font-size" type="number" min={13} max={24} value={Math.max(config.fontSize, 13)} onChange={(event) => setConfig({ fontSize: Number(event.target.value) })} /></label>
        <label className="space-y-1 text-sm font-medium">Text color<Input data-testid="input-global-text-color" type="color" value={config.textColor} onChange={(event) => setConfig({ textColor: event.target.value })} className="h-10 p-1" /></label>
        <label className="space-y-1 text-sm font-medium">Accent color<Input data-testid="input-global-accent-color" type="color" value={config.accentColor} onChange={(event) => setConfig({ accentColor: event.target.value })} className="h-10 p-1" /></label>
        <label className="space-y-1 text-sm font-medium">Paper padding (mm)<Input data-testid="input-paper-padding" type="number" min={5} max={30} value={config.paperPadding} onChange={(event) => setConfig({ paperPadding: Number(event.target.value) })} /></label>
      </div>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Sections and position</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {[...config.sections].sort((a, b) => a.order - b.order).map((section) => (
            <div key={section.key} className="grid grid-cols-[auto_1fr_68px] items-center gap-2 rounded-md border p-2">
              <input
                data-testid={`checkbox-section-${section.key}`}
                aria-label={`Show ${section.label || sectionNames[section.key] || section.key}`}
                type="checkbox"
                checked={section.visible}
                onChange={(event) => updateSection(section.key, { visible: event.target.checked })}
              />
              <span className="min-w-0 text-sm">{section.label || sectionNames[section.key] || section.key}</span>
              <Input
                data-testid={`input-section-order-${section.key}`}
                aria-label={`${section.key} order`}
                type="number"
                min={0}
                value={section.order}
                className="h-8"
                onChange={(event) => updateSection(section.key, { order: Number(event.target.value) })}
              />
              <div className="col-span-full grid gap-2 border-t pt-2 sm:grid-cols-4">
                <select
                  data-testid={`select-section-font-${section.key}`}
                  aria-label={`${section.key} font`}
                  value={section.fontFamily ?? config.fontFamily}
                  onChange={(event) => updateSection(section.key, { fontFamily: event.target.value as ReportLayoutSection["fontFamily"] })}
                  className="h-8 rounded border bg-background px-1 text-xs"
                >
                  {["Arial", "Calibri", "Times New Roman", "Helvetica"].map((font) => <option key={font}>{font}</option>)}
                </select>
                <Input
                  data-testid={`input-section-size-${section.key}`}
                  aria-label={`${section.key} size`}
                  type="number"
                  min={8}
                  max={24}
                  value={section.fontSize ?? config.fontSize}
                  onChange={(event) => updateSection(section.key, { fontSize: Number(event.target.value) })}
                  className="h-8 text-xs"
                />
                <Input
                  data-testid={`input-section-color-${section.key}`}
                  aria-label={`${section.key} text color`}
                  type="color"
                  value={section.textColor ?? config.textColor}
                  onChange={(event) => updateSection(section.key, { textColor: event.target.value })}
                  className="h-8 p-1"
                />
                <label className="flex items-center gap-1 text-xs">
                  <input
                    data-testid={`checkbox-section-bold-${section.key}`}
                    type="checkbox"
                    checked={section.bold ?? false}
                    onChange={(event) => updateSection(section.key, { bold: event.target.checked })}
                  /> Bold
                </label>
                <Input
                  data-testid={`input-section-background-${section.key}`}
                  aria-label={`${section.key} background`}
                  type="color"
                  value={section.backgroundColor ?? "#ffffff"}
                  onChange={(event) => updateSection(section.key, { backgroundColor: event.target.value })}
                  className="h-8 p-1"
                />
                <select
                  data-testid={`select-section-border-${section.key}`}
                  aria-label={`${section.key} border`}
                  value={section.borderStyle ?? "none"}
                  onChange={(event) => updateSection(section.key, { borderStyle: event.target.value as ReportLayoutSection["borderStyle"] })}
                  className="h-8 rounded border bg-background px-1 text-xs"
                >
                  <option value="none">No border</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
                <Input
                  data-testid={`input-section-border-width-${section.key}`}
                  aria-label={`${section.key} border width`}
                  type="number"
                  min={0}
                  max={4}
                  value={section.borderWidth ?? 1}
                  onChange={(event) => updateSection(section.key, { borderWidth: Number(event.target.value) })}
                  className="h-8 text-xs"
                />
                <Input
                  data-testid={`input-section-border-color-${section.key}`}
                  aria-label={`${section.key} border color`}
                  type="color"
                  value={section.borderColor ?? "#d1d5db"}
                  onChange={(event) => updateSection(section.key, { borderColor: event.target.value })}
                  className="h-8 p-1"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-2">
          <h3 className="text-sm font-semibold">Editable fields</h3>
          <p className="text-xs text-muted-foreground">Only approved fields supported by this report can be added.</p>
        </div>
        {Object.entries(groups).map(([key, fields]) => {
          const configured = config.columns[key];
          const columns = configured === undefined
            ? fields.map((field, index) => ({ ...field, visible: true, order: index }))
            : configured;
          const orderedColumns = [...columns].sort((left, right) => left.order - right.order);
          const available = fields.filter((field) => !columns.some((column) => column.key === field.key));
          return (
            <div key={key} className="mb-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{groupNames[key] ?? key}</p>
                <select
                  data-testid={`select-add-report-field-${key}`}
                  aria-label={`Add field to ${groupNames[key] ?? key}`}
                  value=""
                  disabled={!available.length}
                  onChange={(event) => {
                    const field = fields.find((item) => item.key === event.target.value);
                    if (field) setConfig({ columns: { ...config.columns, [key]: [...columns, { ...field, visible: true, order: columns.length }] } });
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Add field…</option>
                  {available.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                {orderedColumns.map((column) => (
                  <FieldRow
                    key={column.key}
                    column={column}
                    onChange={(patch) => setConfig({
                      columns: {
                        ...config.columns,
                        [key]: columns.map((item) => item.key === column.key ? { ...item, ...patch } : item),
                      },
                    })}
                    onRemove={() => setConfig({
                      columns: { ...config.columns, [key]: columns.filter((item) => item.key !== column.key) },
                    })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
      <section><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Text boxes and divider lines</h3><p className="text-xs text-muted-foreground">Attach safe additions before or after a report section.</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" data-testid="button-add-text-box" onClick={() => addElement("text")}><Plus className="mr-1 h-4 w-4" /> Text box</Button><Button type="button" size="sm" variant="outline" data-testid="button-add-divider" onClick={() => addElement("divider")}><Minus className="mr-1 h-4 w-4" /> Divider</Button></div></div><div className="space-y-2">{(config.elements ?? []).map((element) => <ElementRow key={element.key} element={element} sections={config.sections} onChange={(patch) => updateElement(element.key, patch)} onRemove={() => setConfig({ elements: (config.elements ?? []).filter((item) => item.key !== element.key) })} />)}</div></section>
      <section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4 text-primary" /> Live sample preview</h3><div className="max-h-[720px] overflow-auto rounded-lg border bg-muted/20 p-3"><ReportDocument report={{ record: createReportPreviewRecord(draft.testType), companyName: "Al Manaratain", companySubtitle: "Quality Control Laboratory", layout: draft }} strengthStandards={strengthStandards} sieveStandards={sieveStandards} /></div></section>
    </CardContent>
  </Card>;
}

function FieldRow({ column, onChange, onRemove }: { column: ReportLayoutColumn; onChange: (patch: Partial<ReportLayoutColumn>) => void; onRemove: () => void }) {
  return (
    <div className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr_80px_80px_auto]">
      <input
        data-testid={`checkbox-field-${column.key}`}
        type="checkbox"
        aria-label={`Show ${column.label}`}
        checked={column.visible}
        onChange={(event) => onChange({ visible: event.target.checked })}
      />
      <Input
        data-testid={`input-field-label-${column.key}`}
        aria-label={`${column.label} column label`}
        value={column.label}
        onChange={(event) => onChange({ label: event.target.value })}
      />
      <Input
        data-testid={`input-field-order-${column.key}`}
        aria-label={`${column.label} order`}
        type="number"
        min={0}
        value={column.order}
        onChange={(event) => onChange({ order: Number(event.target.value) })}
      />
      <Input
        data-testid={`input-field-width-${column.key}`}
        aria-label={`${column.label} width`}
        type="number"
        min={1}
        max={100}
        value={column.width}
        onChange={(event) => onChange({ width: Number(event.target.value) })}
      />
      <Button type="button" variant="ghost" size="icon" data-testid={`button-remove-field-${column.key}`} onClick={onRemove} aria-label={`Remove ${column.label}`}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function ElementRow({ element, sections, onChange, onRemove }: { element: ReportLayoutElement; sections: ReportLayoutSection[]; onChange: (patch: Partial<ReportLayoutElement>) => void; onRemove: () => void }) {
  return (
    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_120px_100px_auto]">
      <Input
        data-testid={`input-element-content-${element.key}`}
        aria-label={element.type === "divider" ? "Divider line" : "Text box content"}
        value={element.content ?? ""}
        disabled={element.type === "divider"}
        maxLength={500}
        onChange={(event) => onChange({ content: event.target.value })}
        placeholder={element.type === "divider" ? "Divider line" : "Text content"}
      />
      <select
        data-testid={`select-element-section-${element.key}`}
        aria-label="Attach to section"
        value={element.sectionKey}
        onChange={(event) => onChange({ sectionKey: event.target.value })}
        className="h-10 rounded-md border border-input bg-background px-2 text-sm"
      >
        {sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}
      </select>
      <select
        data-testid={`select-element-placement-${element.key}`}
        aria-label="Element placement"
        value={element.placement}
        onChange={(event) => onChange({ placement: event.target.value as "before" | "after" })}
        className="h-10 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="before">Before</option>
        <option value="after">After</option>
      </select>
      <Button type="button" variant="ghost" size="icon" data-testid={`button-remove-element-${element.key}`} onClick={onRemove} aria-label="Remove layout element">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
      <div className="col-span-full grid gap-2 border-t pt-2 sm:grid-cols-4">
        {element.type === "text" && (
          <>
            <select
              data-testid={`select-element-font-${element.key}`}
              aria-label="Text box font"
              value={element.fontFamily ?? "Arial"}
              onChange={(event) => onChange({ fontFamily: event.target.value as ReportLayoutElement["fontFamily"] })}
              className="h-8 rounded border bg-background px-1 text-xs"
            >
              {["Arial", "Calibri", "Times New Roman", "Helvetica"].map((font) => <option key={font}>{font}</option>)}
            </select>
            <Input
              data-testid={`input-element-size-${element.key}`}
              aria-label="Text box font size"
              type="number"
              min={8}
              max={24}
              value={element.fontSize ?? 12}
              onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
              className="h-8 text-xs"
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                data-testid={`checkbox-element-bold-${element.key}`}
                type="checkbox"
                checked={element.bold ?? false}
                onChange={(event) => onChange({ bold: event.target.checked })}
              /> Bold
            </label>
          </>
        )}
        <Input
          data-testid={`input-element-color-${element.key}`}
          aria-label={element.type === "divider" ? "Divider color" : "Text box color"}
          type="color"
          value={element.color ?? "#20252b"}
          onChange={(event) => onChange({ color: event.target.value })}
          className="h-8 p-1"
        />
        <Input
          data-testid={`input-element-width-${element.key}`}
          aria-label="Element width percent"
          type="number"
          min={10}
          max={100}
          value={element.width ?? 100}
          onChange={(event) => onChange({ width: Number(event.target.value) })}
          className="h-8 text-xs"
        />
        {element.type === "divider" && (
          <select
            data-testid={`select-element-line-style-${element.key}`}
            aria-label="Divider line style"
            value={element.lineStyle ?? "solid"}
            onChange={(event) => onChange({ lineStyle: event.target.value as ReportLayoutElement["lineStyle"] })}
            className="h-8 rounded border bg-background px-1 text-xs"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        )}
      </div>
    </div>
  );
}

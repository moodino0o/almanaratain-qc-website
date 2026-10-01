import { ImagePlus, SlidersHorizontal, Table2, Type } from "lucide-react";
import type {
  ReportLayoutConfig,
  ReportLayoutColumn,
  ReportTemplateDesign,
  ReportTemplateObject,
  ReportTemplatePage,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { REPORT_LAYOUT_FIELD_GROUPS } from "./report-layout-fields";

type PropertiesProps = {
  design: ReportTemplateDesign;
  selected?: ReportTemplateObject;
  testType: string;
  onPageChange: (patch: Partial<ReportTemplatePage>) => void;
  onObjectChange: (patch: Partial<ReportTemplateObject>) => void;
  onLayoutChange: (patch: Partial<ReportLayoutConfig>) => void;
  onUpload: (file: File) => Promise<void>;
};

function NumberField({ label, value, min, max, onChange, testId }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void; testId: string }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input type="number" min={min} max={max} step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-8 font-mono text-xs" data-testid={testId} />
    </label>
  );
}

export function ReportDesignerProperties({ design, selected, testType, onPageChange, onObjectChange, onLayoutChange, onUpload }: PropertiesProps) {
  const fields = Object.values(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {}).flat();
  const tableGroups = Object.keys(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {});
  const sections = design.objects.filter((object) => object.type === "section" && object.sectionKey);
  const selectedLegacyTable = Object.entries(design.layout.columns).find(([, columns]) => columns.some((column) => column.key === selected?.fieldKey));
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-border/70 bg-card" data-testid="report-designer-right-panel">
      <div className="border-b border-border/70 px-3 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Inspector</p>
        <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" /> Properties</p>
      </div>
      <div className="space-y-5 p-3">
        {selected ? (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-semibold">Selected object</p><p className="text-[11px] text-muted-foreground">{selected.type}</p></div>
              </div>
              <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Name</span><Input value={selected.name} onChange={(event) => onObjectChange({ name: event.target.value })} className="h-8 text-xs" data-testid="input-selected-object-name" /></label>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="X" value={selected.x} onChange={(value) => onObjectChange({ x: value })} testId="input-object-x" />
                <NumberField label="Y" value={selected.y} onChange={(value) => onObjectChange({ y: value })} testId="input-object-y" />
                <NumberField label="Width" value={selected.width} min={1} onChange={(value) => onObjectChange({ width: value })} testId="input-object-width" />
                <NumberField label="Height" value={selected.height} min={1} onChange={(value) => onObjectChange({ height: value })} testId="input-object-height" />
                <NumberField label="Rotation" value={selected.rotation} min={-360} max={360} onChange={(value) => onObjectChange({ rotation: value })} testId="input-object-rotation" />
                <NumberField label="Opacity" value={selected.opacity ?? 1} min={0} max={1} onChange={(value) => onObjectChange({ opacity: value })} testId="input-object-opacity" />
              </div>
            </section>

            {selected.type === "section" ? (
              <section className="space-y-3 border-t border-border/70 pt-4">
                <p className="text-xs font-semibold">Section background</p>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Background color</span>
                  <select
                    value={!selected.backgroundColor ? "transparent" : selected.backgroundColor.toLowerCase() === "#ffffff" ? "white" : "custom"}
                    onChange={(event) => {
                      const value = event.target.value;
                      onObjectChange({
                        backgroundColor: value === "transparent"
                          ? undefined
                          : value === "white"
                            ? "#ffffff"
                            : selected.backgroundColor && selected.backgroundColor.toLowerCase() !== "#ffffff"
                              ? selected.backgroundColor
                              : "#e5e7eb",
                      });
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    data-testid="select-section-background"
                  >
                    <option value="transparent">Transparent</option>
                    <option value="white">White</option>
                    <option value="custom">Custom color</option>
                  </select>
                </label>
                {selected.backgroundColor && (
                  <label className="flex items-center gap-2 text-xs">
                    <span>{selected.backgroundColor.toLowerCase() === "#ffffff" ? "White" : "Custom color"}</span>
                    <Input
                      type="color"
                      value={selected.backgroundColor}
                      onChange={(event) => onObjectChange({ backgroundColor: event.target.value })}
                      className="h-8 w-12 p-1"
                      data-testid="input-section-background"
                    />
                  </label>
                )}
              </section>
            ) : (
              <section className="space-y-3 border-t border-border/70 pt-4">
                <p className="text-xs font-semibold">Object hierarchy</p>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contained in section</span>
                  <select
                    value={selected.sectionKey ?? ""}
                    onChange={(event) => onObjectChange({ sectionKey: event.target.value || undefined })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    data-testid="select-object-section"
                  >
                    <option value="">Page-level object</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.sectionKey}>{section.name}</option>
                    ))}
                  </select>
                </label>
                <p className="text-[10px] leading-4 text-muted-foreground">Section objects are transparent containers. Their content stays visible in the live report preview.</p>
              </section>
            )}

            {(selected.type === "text" || selected.type === "dynamicField") && (
              <section className="space-y-3 border-t border-border/70 pt-4">
                <p className="flex items-center gap-2 text-xs font-semibold"><Type className="h-3.5 w-3.5 text-primary" /> Typography</p>
                {selected.type === "text" ? (
                  <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Text</span><textarea value={selected.content ?? ""} onChange={(event) => onObjectChange({ content: event.target.value })} className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" data-testid="textarea-object-content" /></label>
                ) : (
                  <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Approved dynamic field</span><select value={selected.fieldKey ?? ""} onChange={(event) => onObjectChange({ fieldKey: event.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-object-field"><option value="">Choose field…</option><option value="REPORT_TITLE">Report title</option><option value="REPORT_NUMBER">Report number</option><option value="REPORT_DATE">Report date</option><option value="SAMPLE_DATE">Sample date</option><option value="SUPPLIER">Supplier</option><option value="SAMPLE_DESCRIPTION">Sample description</option><option value="PROJECT">Project</option><option value="TEST_METHOD">Test method</option><option value="TEST_RESULT">Test result</option><option value="COMPANY_NAME">Company name</option><option value="SAMPLE_NUMBER">Sample number</option><option value="MATERIAL">Material</option><option value="LOCATION">Location</option><option value="TESTED_BY">Tested by</option><option value="REVIEWED_BY">Reviewed by</option><option value="REMARKS">Remarks</option><optgroup label="Approved fields for this report">{fields.map((field) => <option key={field.key} value={`details.${field.key}`}>{field.label}</option>)}</optgroup></select></label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font</span><select value={selected.fontFamily ?? "Arial"} onChange={(event) => onObjectChange({ fontFamily: event.target.value as ReportTemplateObject["fontFamily"] })} className="h-8 w-full rounded-md border border-input bg-background px-1 text-xs" data-testid="select-object-font"><option>Arial</option><option>Calibri</option><option>Times New Roman</option><option>Helvetica</option></select></label>
                  <NumberField label="Size" value={selected.fontSize ?? 12} min={6} max={96} onChange={(value) => onObjectChange({ fontSize: value })} testId="input-object-font-size" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Align</span><select value={selected.textAlign ?? "left"} onChange={(event) => onObjectChange({ textAlign: event.target.value as ReportTemplateObject["textAlign"] })} className="h-8 w-full rounded-md border border-input bg-background px-1 text-xs" data-testid="select-object-align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
                  <label className="flex items-end gap-2 pb-1 text-xs"><input type="checkbox" checked={selected.bold ?? false} onChange={(event) => onObjectChange({ bold: event.target.checked })} data-testid="checkbox-object-bold" /> Bold</label>
                </div>
                <label className="flex items-center gap-2 text-xs"><span>Text color</span><Input type="color" value={selected.textColor ?? "#20252b"} onChange={(event) => onObjectChange({ textColor: event.target.value })} className="h-8 w-12 p-1" data-testid="input-object-text-color" /></label>
              </section>
            )}

            {selected.type === "table" && (
              <section className="space-y-3 border-t border-border/70 pt-4">
                <p className="flex items-center gap-2 text-xs font-semibold"><Table2 className="h-3.5 w-3.5 text-primary" /> Table data</p>
                <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Approved data group</span><select value={selected.tableKey ?? ""} onChange={(event) => onObjectChange({ tableKey: event.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-object-table-group">{tableGroups.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
                <p className="text-[10px] leading-4 text-muted-foreground">Edit this group’s visible columns, labels, order, and widths in Legacy report controls below.</p>
              </section>
            )}

            {selected.type === "line" && (
              <section className="space-y-3 border-t border-border/70 pt-4">
                <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Orientation</span><select value={selected.lineOrientation ?? "horizontal"} onChange={(event) => onObjectChange({ lineOrientation: event.target.value as ReportTemplateObject["lineOrientation"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-line-orientation"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
                <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Style</span><select value={selected.lineStyle ?? "solid"} onChange={(event) => onObjectChange({ lineStyle: event.target.value as ReportTemplateObject["lineStyle"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-line-style"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
                <label className="flex items-center gap-2 text-xs"><span>Line color</span><Input type="color" value={selected.borderColor ?? "#9b1739"} onChange={(event) => onObjectChange({ borderColor: event.target.value })} className="h-8 w-12 p-1" data-testid="input-line-color" /></label>
              </section>
            )}

            {selected.type === "shape" && (
              <section className="space-y-3 border-t border-border/70 pt-4">
                <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shape</span><select value={selected.shapeType ?? "rectangle"} onChange={(event) => onObjectChange({ shapeType: event.target.value as ReportTemplateObject["shapeType"] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-shape-type"><option value="rectangle">Rectangle</option><option value="square">Square</option><option value="circle">Circle</option><option value="divider">Divider</option></select></label>
                <div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-xs"><span>Fill</span><Input type="color" value={selected.fillColor ?? "#e7edf2"} onChange={(event) => onObjectChange({ fillColor: event.target.value })} className="h-8 w-12 p-1" data-testid="input-shape-fill" /></label><label className="flex items-center gap-2 text-xs"><span>Border</span><Input type="color" value={selected.borderColor ?? "#9aa6b2"} onChange={(event) => onObjectChange({ borderColor: event.target.value })} className="h-8 w-12 p-1" data-testid="input-shape-border" /></label></div>
                <NumberField label="Radius" value={selected.borderRadius ?? 0} min={0} max={200} onChange={(value) => onObjectChange({ borderRadius: value })} testId="input-shape-radius" />
              </section>
            )}

            {selected.type === "image" && (
              <section className="space-y-3 border-t border-border/70 pt-4">
                <p className="flex items-center gap-2 text-xs font-semibold"><ImagePlus className="h-3.5 w-3.5 text-primary" /> Private image asset</p>
                <p className="text-[11px] leading-4 text-muted-foreground">Upload goes directly to private object storage. Only the returned object path is saved with the template.</p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/[.03] px-3 py-3 text-xs font-medium text-primary hover:bg-primary/[.07]" data-testid="label-upload-template-image">
                  <ImagePlus className="h-4 w-4" /> Choose image
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" data-testid="input-upload-template-image" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file); }} />
                </label>
                {selected.objectPath && <p className="truncate font-mono text-[10px] text-muted-foreground" title={selected.objectPath} data-testid="text-image-object-path">{selected.objectPath}</p>}
              </section>
            )}
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-center" data-testid="status-no-object-selected">
            <p className="text-xs font-semibold">Page settings</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Select a layer to edit its exact placement and formatting.</p>
          </div>
        )}

        <section className="space-y-3 border-t border-border/70 pt-4">
          <div><p className="text-xs font-semibold">Page</p><p className="text-[11px] text-muted-foreground">Physical certificate dimensions</p></div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Size</span><select value={design.page.pageSize} onChange={(event) => {
              const pageSize = event.target.value as ReportTemplatePage["pageSize"];
              const dimensions = pageSize === "A4" ? [210, 297] : pageSize === "A3" ? [297, 420] : pageSize === "Letter" ? [215.9, 279.4] : [design.page.widthMm, design.page.heightMm];
              onPageChange({ pageSize, widthMm: dimensions[0], heightMm: dimensions[1] });
            }} className="h-8 w-full rounded-md border border-input bg-background px-1 text-xs" data-testid="select-page-size"><option value="A4">A4</option><option value="A3">A3</option><option value="Letter">Letter</option><option value="custom">Custom</option></select></label>
            <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Orientation</span><select value={design.page.orientation} onChange={(event) => onPageChange({ orientation: event.target.value as ReportTemplatePage["orientation"] })} className="h-8 w-full rounded-md border border-input bg-background px-1 text-xs" data-testid="select-page-orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={design.page.widthMm} min={50} max={1000} onChange={(value) => onPageChange({ widthMm: value })} testId="input-page-width" />
            <NumberField label="Height" value={design.page.heightMm} min={50} max={1000} onChange={(value) => onPageChange({ heightMm: value })} testId="input-page-height" />
            <NumberField label="Margin top" value={design.page.marginTopMm} min={0} max={100} onChange={(value) => onPageChange({ marginTopMm: value })} testId="input-page-margin-top" />
            <NumberField label="Margin right" value={design.page.marginRightMm} min={0} max={100} onChange={(value) => onPageChange({ marginRightMm: value })} testId="input-page-margin-right" />
            <NumberField label="Margin bottom" value={design.page.marginBottomMm} min={0} max={100} onChange={(value) => onPageChange({ marginBottomMm: value })} testId="input-page-margin-bottom" />
            <NumberField label="Margin left" value={design.page.marginLeftMm} min={0} max={100} onChange={(value) => onPageChange({ marginLeftMm: value })} testId="input-page-margin-left" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={design.page.showHeader} onChange={(event) => onPageChange({ showHeader: event.target.checked })} data-testid="checkbox-page-header" /> Header</label><label className="flex items-center gap-2"><input type="checkbox" checked={design.page.showFooter} onChange={(event) => onPageChange({ showFooter: event.target.checked })} data-testid="checkbox-page-footer" /> Footer</label></div>
          <div className="grid grid-cols-2 gap-2"><NumberField label="Header height" value={design.page.headerHeightMm} min={1} max={100} onChange={(value) => onPageChange({ headerHeightMm: value })} testId="input-page-header-height" /><NumberField label="Footer height" value={design.page.footerHeightMm} min={1} max={100} onChange={(value) => onPageChange({ footerHeightMm: value })} testId="input-page-footer-height" /></div>
        </section>

        <section className="space-y-3 border-t border-border/70 pt-4">
          <div className="flex items-center gap-2"><Table2 className="h-3.5 w-3.5 text-primary" /><p className="text-xs font-semibold">Legacy report controls</p></div>
          <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Report title</span><Input value={design.layout.title} onChange={(event) => onLayoutChange({ title: event.target.value })} className="h-8 text-xs" data-testid="input-legacy-report-title" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font</span><select value={design.layout.fontFamily} onChange={(event) => onLayoutChange({ fontFamily: event.target.value as ReportLayoutConfig["fontFamily"] })} className="h-8 w-full rounded-md border border-input bg-background px-1 text-xs" data-testid="select-legacy-font"><option>Arial</option><option>Calibri</option><option>Times New Roman</option><option>Helvetica</option></select></label><NumberField label="Size" value={design.layout.fontSize} min={8} max={24} onChange={(value) => onLayoutChange({ fontSize: value })} testId="input-legacy-font-size" /></div>
          <div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-xs"><span>Text</span><Input type="color" value={design.layout.textColor} onChange={(event) => onLayoutChange({ textColor: event.target.value })} className="h-8 w-12 p-1" data-testid="input-legacy-text-color" /></label><label className="flex items-center gap-2 text-xs"><span>Accent</span><Input type="color" value={design.layout.accentColor} onChange={(event) => onLayoutChange({ accentColor: event.target.value })} className="h-8 w-12 p-1" data-testid="input-legacy-accent-color" /></label></div>
          {selectedLegacyTable && <p className="text-[10px] text-muted-foreground">This field belongs to the legacy <span className="font-mono">{selectedLegacyTable[0]}</span> results table. Table column controls remain in the saved design.</p>}
          <div className="space-y-3">
        {Object.entries(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {}).map(([groupKey, availableFields]) => {
              const savedColumns = design.layout.columns[groupKey] ?? availableFields.map((field, order) => ({ ...field, visible: true, order }));
              const columns = [...savedColumns].sort((left, right) => left.order - right.order);
              const addable = availableFields.filter((field) => !savedColumns.some((column) => column.key === field.key));
              const setColumns = (next: ReportLayoutColumn[]) => onLayoutChange({ columns: { ...design.layout.columns, [groupKey]: next } });
              return (
                <div key={groupKey} className={`rounded-md border p-2 ${selected?.type === "table" && selected.tableKey === groupKey ? "border-primary/50 bg-primary/[.03]" : "border-border/70"}`} data-testid={`section-legacy-table-${groupKey}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{groupKey}</span><select value="" disabled={!addable.length} onChange={(event) => { const field = availableFields.find((candidate) => candidate.key === event.target.value); if (field) setColumns([...savedColumns, { ...field, visible: true, order: savedColumns.length }]); }} className="h-7 max-w-[130px] rounded border bg-background px-1 text-[10px]" data-testid={`select-add-legacy-column-${groupKey}`}><option value="">Add column…</option>{addable.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></div>
                  <div className="mt-2 space-y-1">
                    {columns.map((column) => (
                      <div key={column.key} className="grid grid-cols-[14px_1fr_42px_42px_20px] items-center gap-1">
                        <input type="checkbox" checked={column.visible} onChange={(event) => setColumns(savedColumns.map((item) => item.key === column.key ? { ...item, visible: event.target.checked } : item))} data-testid={`checkbox-legacy-column-${groupKey}-${column.key}`} aria-label={`Show ${column.label}`} />
                        <Input value={column.label} onChange={(event) => setColumns(savedColumns.map((item) => item.key === column.key ? { ...item, label: event.target.value } : item))} className="h-7 px-1 text-[10px]" data-testid={`input-legacy-column-label-${groupKey}-${column.key}`} aria-label={`${column.label} label`} />
                        <Input type="number" min={0} value={column.order} onChange={(event) => setColumns(savedColumns.map((item) => item.key === column.key ? { ...item, order: Number(event.target.value) } : item))} className="h-7 px-1 font-mono text-[10px]" data-testid={`input-legacy-column-order-${groupKey}-${column.key}`} aria-label={`${column.label} order`} />
                        <Input type="number" min={1} max={100} value={column.width} onChange={(event) => setColumns(savedColumns.map((item) => item.key === column.key ? { ...item, width: Number(event.target.value) } : item))} className="h-7 px-1 font-mono text-[10px]" data-testid={`input-legacy-column-width-${groupKey}-${column.key}`} aria-label={`${column.label} width`} />
                        <button type="button" className="rounded p-1 text-destructive hover:bg-destructive/10" onClick={() => setColumns(savedColumns.filter((item) => item.key !== column.key))} data-testid={`button-remove-legacy-column-${groupKey}-${column.key}`} aria-label={`Remove ${column.label}`}>&times;</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}

import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  TestType,
  type ReportTemplate,
  type ReportTemplateDesign,
  type ReportTemplateObject,
  type TestType as TestTypeValue,
  getGetReportQueryKey,
  getListReportTemplateVersionsQueryKey,
  getListReportTemplatesQueryKey,
  getListRecordsQueryKey,
  useCreateReportTemplate,
  useDeleteReportTemplate,
  useDuplicateReportTemplate,
  useGetReport,
  useListRecords,
  useListReportTemplateVersions,
  useListReportTemplates,
  useListSieveStandards,
  useListStrengthStandards,
  useRequestUploadUrl,
  useRestoreReportTemplateVersion,
  useSetReportTemplateDefault,
  useUpdateReportTemplate,
} from "@workspace/api-client-react";
import { AlertTriangle, Check, FilePlus2, FileText, Layers3, RotateCcw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ReportDocument } from "./report-print";
import { REPORT_LAYOUT_FIELD_GROUPS } from "./report-layout-fields";
import { ReportDesignerCanvas } from "./report-designer-canvas";
import { ReportDesignerLayers } from "./report-designer-layers";
import { ReportDesignerProperties } from "./report-designer-properties";
import { ReportDesignerToolbar, type DesignerTool } from "./report-designer-toolbar";
import { REPORT_TEST_TYPES, addDefaultSectionObjects, cloneDesign, createEmptyDesign } from "./report-designer-types";
import "./report-designer.css";

type ReportDocumentWithTemplate = (props: ComponentProps<typeof ReportDocument> & { templateDesign?: ReportTemplateDesign }) => ReactElement;
const TemplateReportDocument = ReportDocument as unknown as ReportDocumentWithTemplate;

function initialObject(type: ReportTemplateObject["type"], index: number, testType: string): ReportTemplateObject {
  const tableKey = ({
    "Ready Mix": "readyMixResults",
    Blocks: "blockCompression",
    "Paving Blocks": "pavingResults",
    "Sand Sieve": "sieveResults",
    "Aggregate Sieve": "sieveResults",
  } as Record<string, string>)[testType] ?? Object.keys(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {})[0] ?? "genericContext";
  const base = { id: `object-${Date.now()}-${index}`, name: type === "dynamicField" ? "Approved field" : type === "line" ? "Divider line" : type === "shape" ? "Rectangle" : type === "image" ? "Image" : type === "table" ? "QC data table" : "Text box", x: type === "table" ? 13 : 24 + (index % 4) * 10, y: type === "table" ? 205 : 68 + index * 12, width: type === "line" ? 160 : type === "table" ? 184 : 70, height: type === "line" ? 1 : type === "text" ? 16 : type === "table" ? 35 : 28, zIndex: index + 10, rotation: 0, locked: false, visible: true } satisfies Partial<ReportTemplateObject>;
  if (type === "text") return { ...base, type, content: "Additional note", fontFamily: "Arial", fontSize: 12, textColor: "#20252b" } as ReportTemplateObject;
  if (type === "dynamicField") return { ...base, type, fieldKey: "REPORT_NUMBER", fontFamily: "Arial", fontSize: 12, textColor: "#20252b" } as ReportTemplateObject;
  if (type === "line") return { ...base, type, lineOrientation: "horizontal", lineStyle: "solid", borderColor: "#9b1739" } as ReportTemplateObject;
  if (type === "image") return { ...base, type, objectPath: undefined, width: 50, height: 28 } as ReportTemplateObject;
  if (type === "table") return { ...base, type, tableKey } as ReportTemplateObject;
  return { ...base, type, shapeType: "rectangle", fillColor: "#e7edf2", borderColor: "#9aa6b2", borderWidth: 1 } as ReportTemplateObject;
}

function EmptyReportPreview({ message }: { message: string }) {
  return <div className="flex h-full min-h-[760px] items-center justify-center bg-card p-8 text-center" data-testid="status-report-preview-empty"><div className="max-w-xs"><FileText className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold">No saved report selected</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{message}</p></div></div>;
}

export function ReportLayoutsEditor() {
  const queryClient = useQueryClient();
  const [testType, setTestType] = useState<TestTypeValue>(TestType.Ready_Mix);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>();
  const [draft, setDraft] = useState<ReportTemplate>();
  const [history, setHistory] = useState<ReportTemplateDesign[]>([]);
  const [future, setFuture] = useState<ReportTemplateDesign[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>();
  const [tool, setTool] = useState<DesignerTool>("select");
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(.72);
  const [recordId, setRecordId] = useState<number>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const initializedId = useRef<number | undefined>(undefined);
  const originalDesign = useRef<ReportTemplateDesign | undefined>(undefined);
  const originalMetadata = useRef<{ name: string; description: string | null }>({ name: "", description: null });

  const templatesQuery = useListReportTemplates({ testType }, { query: { queryKey: getListReportTemplatesQueryKey({ testType }) } });
  const templates = templatesQuery.data ?? [];
  const recordsQuery = useListRecords({ testType, limit: 100 }, { query: { queryKey: getListRecordsQueryKey({ testType, limit: 100 }) } });
  const records = recordsQuery.data ?? [];
  const reportQuery = useGetReport(recordId ?? 0, { query: { enabled: recordId !== undefined, queryKey: getGetReportQueryKey(recordId ?? 0) } });
  const { data: strengthStandards = [] } = useListStrengthStandards();
  const { data: sieveStandards = [] } = useListSieveStandards();
  const versionsQuery = useListReportTemplateVersions(selectedTemplateId ?? 0, { query: { enabled: selectedTemplateId !== undefined, queryKey: getListReportTemplateVersionsQueryKey(selectedTemplateId ?? 0) } });
  const create = useCreateReportTemplate();
  const update = useUpdateReportTemplate();
  const remove = useDeleteReportTemplate();
  const duplicate = useDuplicateReportTemplate();
  const setDefault = useSetReportTemplateDefault();
  const restore = useRestoreReportTemplateVersion();
  const upload = useRequestUploadUrl();
  const selectedTemplate = selectedTemplateId === undefined
    ? templates[0]
    : templates.find((template) => template.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate && initializedId.current !== selectedTemplate.id) {
      initializedId.current = selectedTemplate.id;
      setSelectedTemplateId(selectedTemplate.id);
      const prepared = {
        ...cloneDesign(selectedTemplate),
        design: addDefaultSectionObjects(
          cloneDesign(selectedTemplate.design),
          selectedTemplate.testType,
        ),
      };
      setDraft(prepared as ReportTemplate);
      originalDesign.current = cloneDesign(selectedTemplate.design);
      originalMetadata.current = { name: selectedTemplate.name, description: selectedTemplate.description };
      setHistory([]);
      setFuture([]);
      setSelectedObjectId(selectedTemplate.design.objects[0]?.id);
      setErrorMessage("");
    }
  }, [selectedTemplate]);
  useEffect(() => { setRecordId(undefined); }, [testType]);

  const selectedObject = draft?.design.objects.find((object) => object.id === selectedObjectId);
  const isDirty = Boolean(draft && originalDesign.current && (
    JSON.stringify(draft.design) !== JSON.stringify(originalDesign.current) ||
    draft.name !== originalMetadata.current.name ||
    (draft.description ?? null) !== originalMetadata.current.description
  ));
  const addHistory = (next: ReportTemplateDesign) => {
    if (!draft) return;
    setHistory((items) => [...items.slice(-39), cloneDesign(draft.design)]);
    setFuture([]);
    setDraft((current) => current ? { ...current, design: next } : current);
  };
  const patchDesign = (patch: (design: ReportTemplateDesign) => ReportTemplateDesign) => { if (draft) addHistory(patch(cloneDesign(draft.design))); };
  const patchObject = (id: string, patch: Partial<ReportTemplateObject>) => patchDesign((design) => {
    const target = design.objects.find((object) => object.id === id);
    const objects = design.objects.map((object) => object.id === id ? { ...object, ...patch } : object);
    const page = { ...design.page };
    if (target?.type === "section" && patch.height !== undefined) {
      if (target.sectionKey === "header") page.headerHeightMm = patch.height;
      if (target.sectionKey === "signatures") page.footerHeightMm = patch.height;
    }
    return { ...design, page, objects };
  });
  const patchPage = (patch: Partial<ReportTemplateDesign["page"]>) => patchDesign((design) => ({
    ...design,
    page: { ...design.page, ...patch },
    objects: design.objects.map((object) => object.type === "section" && object.sectionKey === "header" && patch.headerHeightMm !== undefined
      ? { ...object, height: patch.headerHeightMm }
      : object.type === "section" && object.sectionKey === "signatures" && patch.footerHeightMm !== undefined
        ? { ...object, height: patch.footerHeightMm }
        : object),
  }));
  const patchLayout = (patch: Partial<ReportTemplateDesign["layout"]>) => patchDesign((design) => ({ ...design, layout: { ...design.layout, ...patch } }));
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getListReportTemplatesQueryKey({ testType }) });
    if (selectedTemplateId !== undefined) void queryClient.invalidateQueries({ queryKey: getListReportTemplateVersionsQueryKey(selectedTemplateId) });
  };
  const save = () => {
    if (!draft) return;
    setErrorMessage("");
    update.mutate({ id: draft.id, data: { name: draft.name, description: draft.description, design: draft.design } }, {
      onSuccess: (result) => { setDraft(cloneDesign(result) as ReportTemplate); originalDesign.current = cloneDesign(result.design); originalMetadata.current = { name: result.name, description: result.description }; setHistory([]); setFuture([]); invalidate(); toast.success("Template saved"); },
      onError: () => { setErrorMessage("The template could not be saved. Check your changes and try again."); toast.error("Unable to save template"); },
    });
  };
  const createTemplate = () => {
    if (!createName.trim()) return;
    create.mutate({ data: { testType, name: createName.trim(), description: createDescription.trim() || null, design: createEmptyDesign(testType) } }, {
      onSuccess: (result) => { setCreateOpen(false); setCreateName(""); setCreateDescription(""); setSelectedTemplateId(result.id); initializedId.current = result.id; setDraft(cloneDesign(result) as ReportTemplate); originalDesign.current = cloneDesign(result.design); originalMetadata.current = { name: result.name, description: result.description }; setSelectedObjectId(result.design.objects[0]?.id); invalidate(); toast.success("Template created"); },
      onError: () => setErrorMessage("Unable to create template."),
    });
  };
  const saveAs = () => {
    if (!draft || !createName.trim()) return;
    duplicate.mutate({ id: draft.id, data: { name: createName.trim(), description: createDescription.trim() || null, design: draft.design } }, {
      onSuccess: (result) => { setSaveAsOpen(false); setSelectedTemplateId(result.id); initializedId.current = result.id; setDraft(cloneDesign(result) as ReportTemplate); originalDesign.current = cloneDesign(result.design); originalMetadata.current = { name: result.name, description: result.description }; setSelectedObjectId(result.design.objects[0]?.id); setCreateName(""); setCreateDescription(""); invalidate(); toast.success("Template duplicated"); },
      onError: () => setErrorMessage("Unable to duplicate template."),
    });
  };
  const handleDelete = () => {
    if (!draft) return;
    remove.mutate({ id: draft.id }, { onSuccess: () => { setDeleteOpen(false); initializedId.current = draft.id; setDraft(undefined); setSelectedTemplateId(undefined); invalidate(); toast.success("Template deleted"); }, onError: () => setErrorMessage("Unable to delete this template.") });
  };
  const restoreVersion = (version: number) => {
    if (!draft) return;
    restore.mutate({ id: draft.id, version }, { onSuccess: (result) => { setDraft({ ...cloneDesign(result), design: addDefaultSectionObjects(cloneDesign(result.design), result.testType) } as ReportTemplate); originalDesign.current = cloneDesign(result.design); setHistory([]); setFuture([]); invalidate(); toast.success(`Restored version ${version}`); }, onError: () => toast.error("Unable to restore that version") });
  };
  const reset = () => {
    if (!draft || !originalDesign.current) return;
    addHistory(cloneDesign(originalDesign.current));
    setDraft((current) => current ? {
      ...current,
      name: originalMetadata.current.name,
      description: originalMetadata.current.description,
    } : current);
    setResetOpen(false);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!draft || !previous) return;
    setFuture((items) => [...items, cloneDesign(draft.design)]); setHistory((items) => items.slice(0, -1)); setDraft({ ...draft, design: cloneDesign(previous) });
  };
  const redo = () => {
    const next = future.at(-1);
    if (!draft || !next) return;
    setHistory((items) => [...items, cloneDesign(draft.design)]); setFuture((items) => items.slice(0, -1)); setDraft({ ...draft, design: cloneDesign(next) });
  };
  const addObject = (type: ReportTemplateObject["type"]) => {
    if (!draft || draft.design.objects.length >= 200) return;
    const object = initialObject(type, draft.design.objects.length, testType);
    patchDesign((design) => ({ ...design, objects: [...design.objects, object] }));
    setSelectedObjectId(object.id);
    setTool("select");
  };
  const duplicateObject = (id: string) => {
    const object = draft?.design.objects.find((item) => item.id === id);
    if (!object || !draft) return;
    const copy = { ...cloneDesign(object), id: `object-${Date.now()}`, name: `${object.name} copy`, x: object.x + 4, y: object.y + 4, zIndex: Math.max(...draft.design.objects.map((item) => item.zIndex), 0) + 1 };
    patchDesign((design) => ({ ...design, objects: [...design.objects, copy] })); setSelectedObjectId(copy.id);
  };
  const deleteObject = (id: string) => { patchDesign((design) => ({ ...design, objects: design.objects.filter((object) => object.id !== id) })); if (selectedObjectId === id) setSelectedObjectId(undefined); };
  const moveLayer = (id: string, direction: "up" | "down") => {
    const object = draft?.design.objects.find((item) => item.id === id);
    if (object) patchObject(id, { zIndex: object.zIndex + (direction === "up" ? 1 : -1) });
  };
  const align = (alignment: string) => {
    if (!draft || !selectedObject) return;
    const page = draft.design.page;
    const pageWidth = page.orientation === "landscape" ? page.heightMm : page.widthMm;
    const pageHeight = page.orientation === "landscape" ? page.widthMm : page.heightMm;
    const patch: Partial<ReportTemplateObject> = alignment === "left" ? { x: page.marginLeftMm } : alignment === "right" ? { x: pageWidth - page.marginRightMm - selectedObject.width } : alignment === "center" ? { x: (pageWidth - selectedObject.width) / 2 } : alignment === "top" ? { y: page.marginTopMm } : alignment === "bottom" ? { y: pageHeight - page.marginBottomMm - selectedObject.height } : { y: (pageHeight - selectedObject.height) / 2 };
    patchObject(selectedObject.id, patch);
  };
  const uploadImage = async (file: File) => {
    if (!selectedObject || selectedObject.type !== "image") return;
    try {
      const result = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type, purpose: "report-template" } });
      const response = await fetch(result.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Upload failed");
      patchObject(selectedObject.id, { objectPath: result.objectPath, name: file.name }); toast.success("Image uploaded");
    } catch { toast.error("Unable to upload image"); }
  };

  const report = reportQuery.data;
  const reportPreview = reportQuery.isLoading
    ? <div className="min-h-[760px] space-y-4 bg-card p-10" data-testid="status-report-preview-loading"><div className="h-8 w-2/3 animate-pulse rounded bg-muted" /><div className="h-4 w-1/2 animate-pulse rounded bg-muted" /><div className="mt-12 h-64 animate-pulse rounded bg-muted" /></div>
    : reportQuery.isError
      ? <EmptyReportPreview message="This saved QC report could not be loaded. Choose another saved record and try again." />
      : report?.record
        ? <TemplateReportDocument report={report} strengthStandards={strengthStandards} sieveStandards={sieveStandards} templateDesign={draft?.design} />
        : <EmptyReportPreview message={records.length ? "Choose a saved QC record above to preview the certificate with real results." : `No saved ${testType} records are available. Create a QC record to preview this template.`} />;
  const legacyGroups = useMemo(() => Object.entries(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {}), [testType]);

  if (templatesQuery.isLoading) return <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground" data-testid="status-report-templates-loading"><div className="h-4 w-48 animate-pulse rounded bg-muted" /><div className="mt-3 h-20 animate-pulse rounded bg-muted" /></div>;
  if (templatesQuery.isError) return <div className="rounded-lg border border-destructive/30 bg-card p-8" data-testid="status-report-templates-error"><AlertTriangle className="h-5 w-5 text-destructive" /><p className="mt-2 text-sm font-semibold">Report templates could not be loaded.</p><p className="mt-1 text-xs text-muted-foreground">Confirm administrator access and try again.</p><Button className="mt-4" variant="outline" onClick={() => void templatesQuery.refetch()} data-testid="button-retry-report-templates">Retry</Button></div>;

  return (
    <div className="report-designer-shell overflow-hidden rounded-xl border border-border/80 shadow-sm" data-testid="report-layouts-editor">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-card px-4 py-3">
        <div className="mr-auto flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Layers3 className="h-4 w-4" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Settings / Report layouts</p><h1 className="text-lg font-semibold tracking-tight">Certificate designer</h1></div></div>
         <select value={testType} onChange={(event) => { initializedId.current = undefined; setSelectedTemplateId(undefined); setTestType(event.target.value as TestTypeValue); }} className="h-9 rounded-md border border-input bg-background px-3 text-xs font-semibold" data-testid="select-designer-test-type">{REPORT_TEST_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
        <select value={selectedTemplateId ?? ""} onChange={(event) => { initializedId.current = undefined; setSelectedTemplateId(Number(event.target.value)); }} className="h-9 max-w-[230px] rounded-md border border-input bg-background px-3 text-xs" data-testid="select-designer-template">{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " · Default" : ""}</option>)}{templates.length === 0 && <option value="">No templates</option>}</select>
        <Button type="button" size="sm" className="h-9 gap-1.5" onClick={() => { setCreateName(`${testType} certificate`); setCreateOpen(true); }} data-testid="button-create-template"><FilePlus2 className="h-4 w-4" /> New</Button>
      </div>
      {draft && <ReportDesignerToolbar tool={tool} onToolChange={(next) => { setTool(next); if (next !== "select") addObject(next); }} onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={future.length > 0} onSave={save} onSaveAs={() => { setCreateName(`${draft.name} copy`); setCreateDescription(draft.description ?? ""); setSaveAsOpen(true); }} onZoom={(delta) => setZoom((value) => Math.min(1.3, Math.max(.45, value + delta)))} zoom={zoom} grid={grid} snap={snap} onGridChange={setGrid} onSnapChange={setSnap} onAlign={align} hasSelection={Boolean(selectedObject)} isDirty={Boolean(isDirty)} isSaving={update.isPending} />}
      {errorMessage && <div className="flex items-center gap-2 border-b border-destructive/25 bg-destructive/[.05] px-4 py-2 text-xs text-destructive" role="alert" data-testid="status-designer-error"><AlertTriangle className="h-3.5 w-3.5" /> {errorMessage}</div>}
      {!draft ? <div className="flex min-h-[520px] items-center justify-center bg-muted/30 p-8" data-testid="status-report-templates-empty"><div className="max-w-md text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-4 text-lg font-semibold">No {testType} templates yet</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Create the first standards-aware certificate template. The live preview will use a real saved QC record when one is available.</p><Button className="mt-5 gap-2" onClick={() => { setCreateName(`${testType} certificate`); setCreateOpen(true); }} data-testid="button-create-first-template"><FilePlus2 className="h-4 w-4" /> Create template</Button></div></div> : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-4 py-2">
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="h-8 w-64 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0" data-testid="input-template-name" aria-label="Template name" />
            <Input value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add a description for this approved template" className="h-8 min-w-[240px] max-w-md flex-1 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0" data-testid="input-template-description" aria-label="Template description" />
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span data-testid="text-template-version">v{draft.version}</span>{draft.isDefault && <Badge className="gap-1 bg-success text-success-foreground"><Star className="h-3 w-3" /> Default</Badge>}{isDirty ? <span className="text-warning" data-testid="status-template-dirty">Unsaved changes</span> : <span className="inline-flex items-center gap-1 text-success" data-testid="status-template-saved"><Check className="h-3 w-3" /> Saved</span>}</div>
          </div>
          <div className="report-designer-workspace">
            <ReportDesignerLayers objects={draft.design.objects} selectedId={selectedObjectId} onSelect={setSelectedObjectId} onPatch={patchObject} onDelete={deleteObject} onDuplicate={duplicateObject} onMove={moveLayer} onAdd={addObject} />
            <main className="flex min-h-0 min-w-0 flex-col" data-testid="report-designer-center-panel">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/25 px-4 py-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Live certificate</span><select value={recordId ?? ""} onChange={(event) => setRecordId(event.target.value ? Number(event.target.value) : undefined)} className="h-8 min-w-[230px] rounded-md border border-input bg-background px-2 text-xs" data-testid="select-preview-record"><option value="">Choose saved QC record…</option>{records.map((record) => <option key={record.id} value={record.id}>{record.recordNo} · {record.sampleDate} · {record.material}</option>)}</select>{recordsQuery.isLoading && <span className="text-xs text-muted-foreground" data-testid="status-preview-records-loading">Loading saved records…</span>}{recordsQuery.isError && <span className="text-xs text-destructive" data-testid="status-preview-records-error">Saved records unavailable.</span>}<span className="ml-auto text-[10px] font-mono text-muted-foreground" data-testid="text-preview-record-count">{records.length} saved record{records.length === 1 ? "" : "s"}</span></div>
              <div className="report-designer-canvas-scroll flex-1 p-8"><ReportDesignerCanvas page={draft.design.page} objects={draft.design.objects} selectedId={selectedObjectId} zoom={zoom} grid={grid} snap={snap} onSelect={setSelectedObjectId} onMove={patchObject} preview={<div className="report-designer-preview-layer">{reportPreview}</div>} /></div>
            </main>
            <ReportDesignerProperties design={draft.design} selected={selectedObject} testType={testType} onPageChange={patchPage} onObjectChange={(patch) => selectedObject && patchObject(selectedObject.id, patch)} onLayoutChange={patchLayout} onUpload={uploadImage} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-card px-3 py-2"><span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Template controls</span><Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setDefault.mutate({ id: draft.id }, { onSuccess: () => { setDraft((current) => current ? { ...current, isDefault: true } : current); invalidate(); toast.success("Default template updated"); }, onError: () => toast.error("Unable to set default") })} disabled={draft.isDefault || setDefault.isPending} data-testid="button-set-default-template"><Star className="h-3.5 w-3.5" /> Set default</Button><Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setResetOpen(true)} disabled={!isDirty} data-testid="button-reset-template"><RotateCcw className="h-3.5 w-3.5" /> Reset</Button><Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setDeleteOpen(true)} data-testid="button-delete-template"><Trash2 className="h-3.5 w-3.5 text-destructive" /> Delete</Button><div className="ml-auto flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Versions</span><select className="h-8 max-w-[170px] rounded-md border border-input bg-background px-2 text-xs" value="" onChange={(event) => { if (event.target.value) restoreVersion(Number(event.target.value)); }} data-testid="select-template-version"><option value="">Restore version…</option>{(versionsQuery.data ?? []).map((version) => <option key={version.version} value={version.version}>Version {version.version} · {new Date(version.createdAt).toLocaleDateString()}</option>)}</select><span className="text-[10px] text-muted-foreground" data-testid="text-legacy-field-count">{legacyGroups.reduce((sum, [, fields]) => sum + fields.length, 0)} approved fields</span></div></div>
        </>
      )}
      {(createOpen || saveAsOpen || deleteOpen || resetOpen) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) { setCreateOpen(false); setSaveAsOpen(false); setDeleteOpen(false); setResetOpen(false); } }} data-testid="dialog-designer-overlay"><div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl" role="dialog" aria-modal="true" data-testid="dialog-designer">
        {(createOpen || saveAsOpen) && <><h2 className="text-base font-semibold">{createOpen ? "Create report template" : "Save a copy"}</h2><p className="mt-1 text-xs text-muted-foreground">Use a clear name so technicians can choose the approved certificate quickly.</p><div className="mt-4 space-y-3"><label className="space-y-1 text-xs font-medium">Name<Input value={createName} onChange={(event) => setCreateName(event.target.value)} autoFocus maxLength={160} data-testid="input-dialog-template-name" /></label><label className="space-y-1 text-xs font-medium">Description<textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} maxLength={1000} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="textarea-dialog-template-description" /></label></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => { setCreateOpen(false); setSaveAsOpen(false); }} data-testid="button-cancel-template-dialog">Cancel</Button><Button onClick={createOpen ? createTemplate : saveAs} disabled={!createName.trim() || create.isPending || duplicate.isPending} data-testid="button-confirm-template-dialog">{createOpen ? "Create template" : "Save copy"}</Button></div></>}
        {deleteOpen && <><h2 className="text-base font-semibold">Delete this template?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">This permanently removes <strong>{draft?.name}</strong>. Existing certificates are not changed.</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)} data-testid="button-cancel-delete-template">Cancel</Button><Button variant="destructive" onClick={handleDelete} disabled={remove.isPending} data-testid="button-confirm-delete-template">{remove.isPending ? "Deleting…" : "Delete template"}</Button></div></>}
        {resetOpen && <><h2 className="text-base font-semibold">Reset unsaved changes?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">This restores the last saved design and removes your current undo history.</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setResetOpen(false)} data-testid="button-cancel-reset-template">Cancel</Button><Button onClick={reset} data-testid="button-confirm-reset-template">Reset design</Button></div></>}
      </div></div>}
    </div>
  );
}

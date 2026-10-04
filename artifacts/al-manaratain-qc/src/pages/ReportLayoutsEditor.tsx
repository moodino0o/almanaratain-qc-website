import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactElement } from "react";
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
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FilePlus2, FileText, Layers3, RotateCcw, Star, Trash2 } from "lucide-react";
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
import { absolutePosition, createDesignerId, createTableStructure, descendantsOf, directChildren, parentIdFor, sectionForObject } from "./report-designer-model";
import type { TableInspectorAction } from "./report-designer-table-inspector";
import { REPORT_TEST_TYPES, addDefaultSectionObjects, cloneDesign, createEmptyDesign } from "./report-designer-types";
import { evaluateReportFormula } from "./report-template-formulas";
import "./report-designer.css";

type ReportDocumentWithTemplate = (props: ComponentProps<typeof ReportDocument> & { templateDesign?: ReportTemplateDesign }) => ReactElement;
const TemplateReportDocument = ReportDocument as unknown as ReportDocumentWithTemplate;
const INSPECTOR_PREFERENCE_KEY = "al-manaratain-qc:report-designer:inspector-open";
const DESIGNER_ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DESIGNER_PX_PER_MM = 3.7795;

function validateDesignerFormulas(design: ReportTemplateDesign) {
  for (const object of design.objects) {
    if (object.type !== "formula" && !(object.type === "tableCell" && object.formula !== undefined)) continue;
    const formula = object.formula ?? "";
    try {
      evaluateReportFormula(formula, () => 1);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid formula.";
      return `Formula in “${object.name}” is invalid: ${detail}`;
    }
  }
  return undefined;
}

function initialObject(type: ReportTemplateObject["type"], index: number, testType: string, parentSection?: ReportTemplateObject): ReportTemplateObject {
  const tableKey = ({
    "Ready Mix": "readyMixResults",
    Blocks: "blockCompression",
    "Paving Blocks": "pavingResults",
    "Sand Sieve": "sieveResults",
    "Aggregate Sieve": "sieveResults",
  } as Record<string, string>)[testType] ?? Object.keys(REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {})[0] ?? "genericContext";
  const inSection = Boolean(parentSection);
  const sectionWidth = parentSection?.width ?? 0;
  const sectionHeight = parentSection?.height ?? 0;
  const base = { id: createDesignerId(), name: type === "dynamicField" ? "Approved field" : type === "line" ? "Divider line" : type === "shape" ? "Rectangle" : type === "image" ? "Image" : type === "table" ? "QC data table" : type === "signature" ? "Signature" : type === "formula" ? "Calculated field" : type === "group" ? "Group" : "Text box", x: inSection ? 3 : type === "table" ? 13 : 24 + (index % 4) * 10, y: inSection ? 3 : type === "table" ? 205 : 68 + index * 12, width: type === "line" ? (inSection ? Math.max(1, sectionWidth - 6) : 160) : type === "table" ? (inSection ? Math.max(1, sectionWidth - 6) : 184) : 70, height: type === "line" ? 1 : type === "text" ? (inSection ? Math.max(1, Math.min(16, sectionHeight - 6)) : 16) : type === "table" ? (inSection ? Math.max(1, Math.min(35, sectionHeight - 6)) : 35) : 28, zIndex: index + 10, rotation: 0, locked: false, visible: true, ...(parentSection?.sectionKey ? { sectionKey: parentSection.sectionKey } : {}) } satisfies Partial<ReportTemplateObject>;
  if (type === "text") return { ...base, type, content: "Additional note", fontFamily: "Arial", fontSize: 12, textColor: "#20252b" } as ReportTemplateObject;
  if (type === "dynamicField") return { ...base, type, fieldKey: "REPORT_NUMBER", fontFamily: "Arial", fontSize: 12, textColor: "#20252b" } as ReportTemplateObject;
  if (type === "line") return { ...base, type, lineOrientation: "horizontal", lineStyle: "solid", borderColor: "#9b1739" } as ReportTemplateObject;
  if (type === "image") return { ...base, type, objectPath: undefined, width: 50, height: 28 } as ReportTemplateObject;
  if (type === "table") return { ...base, type, tableKey } as ReportTemplateObject;
  if (type === "signature") return { ...base, type, name: "Prepared by", content: "Signature", width: 45, height: 18, borderColor: "#9aa6b2", borderWidth: 0.4 } as ReportTemplateObject;
  if (type === "formula") return { ...base, type, name: "Calculated field", formula: "=0", fontFamily: "Arial", fontSize: 12, textColor: "#20252b" } as ReportTemplateObject;
  if (type === "group") return { ...base, type, name: "Group" } as ReportTemplateObject;
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
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [tool, setTool] = useState<DesignerTool>("select");
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(.75);
  const [fitMode, setFitMode] = useState<"screen" | "width" | null>("screen");
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem(INSPECTOR_PREFERENCE_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
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
  const editorRootRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const inspectorResizeStart = useRef<{ clientX: number; width: number } | undefined>(undefined);
  const clipboard = useRef<ReportTemplateObject[]>([]);
  const selectedObjectId = selectedObjectIds.at(-1);
  const setSelectedObjectId = (id?: string) => setSelectedObjectIds(id ? [id] : []);
  const selectObject = (id: string, extend = false) => setSelectedObjectIds((current) =>
    extend ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id],
  );
  const isFullscreen = nativeFullscreen || fullscreenFallback;

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
  useEffect(() => {
    try {
      window.localStorage.setItem(INSPECTOR_PREFERENCE_KEY, inspectorOpen ? "open" : "closed");
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [inspectorOpen]);
  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === editorRootRef.current;
      setNativeFullscreen(active);
      if (active) setFullscreenFallback(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  useEffect(() => {
    if (!fullscreenFallback) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreenFallback(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreenFallback]);

  const page = draft?.design.page;
  const applyFit = useCallback((mode: "screen" | "width") => {
    const viewport = canvasViewportRef.current;
    if (!page || !viewport) return;
    const pageWidthMm = page.orientation === "landscape" ? page.heightMm : page.widthMm;
    const pageHeightMm = page.orientation === "landscape" ? page.widthMm : page.heightMm;
    const pageWidthPx = pageWidthMm * DESIGNER_PX_PER_MM;
    const pageHeightPx = pageHeightMm * DESIGNER_PX_PER_MM;
    const availableWidth = Math.max(1, viewport.clientWidth - 64);
    const availableHeight = Math.max(1, viewport.clientHeight - 64);
    const fitWidth = availableWidth / pageWidthPx;
    const fitHeight = availableHeight / pageHeightPx;
    const scale = mode === "width" ? fitWidth : Math.min(fitWidth, fitHeight);
    setZoom(Math.min(2, Math.max(0.35, scale)));
  }, [page?.heightMm, page?.orientation, page?.widthMm]);
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport || !fitMode) return;
    applyFit(fitMode);
    const observer = new ResizeObserver(() => applyFit(fitMode));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [applyFit, fitMode, inspectorOpen, inspectorWidth, layersCollapsed, isFullscreen]);

  const selectedObject = draft?.design.objects.find((object) => object.id === selectedObjectId);
  const selectedObjects = draft?.design.objects.filter((object) => selectedObjectIds.includes(object.id)) ?? [];
  const canGroup = selectedObjects.length > 1 &&
    selectedObjects.every((object) => !["section", "table", "tableRow", "tableCell"].includes(object.type)) &&
    new Set(selectedObjects.map((object) => parentIdFor(object, draft?.design.objects ?? []))).size === 1;
  const canUngroup = selectedObject?.type === "group";
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
    if (target?.locked && Object.keys(patch).some((key) => key !== "locked" && key !== "visible")) {
      return design;
    }
    let adjustedPatch = patch;
    if (target && target.type !== "section" && Object.hasOwn(patch, "sectionKey")) {
      const oldPosition = absolutePosition(target, design.objects);
      const newParent = design.objects.find((object) =>
        object.type === "section" && object.sectionKey === patch.sectionKey,
      );
      const newParentPosition = newParent ? absolutePosition(newParent, design.objects) : { x: 0, y: 0 };
      adjustedPatch = {
        ...patch,
        parentId: newParent?.id,
        x: oldPosition.x - newParentPosition.x,
        y: oldPosition.y - newParentPosition.y,
      };
    }
    let objects = design.objects.map((object) => object.id === id ? { ...object, ...adjustedPatch } : object);
    if (target?.type === "table" && patch.tableKey !== undefined && patch.tableKey !== target.tableKey) {
      const oldDescendants = descendantsOf(design.objects, target.id);
      const removedIds = new Set(oldDescendants.map((object) => object.id));
      const updatedTable = objects.find((object) => object.id === target.id)!;
      const remaining = objects.filter((object) => !removedIds.has(object.id));
      const newChildren = createTableStructure(updatedTable, remaining, testType);
      if (remaining.length + newChildren.length > 200) {
        toast.error("Changing this table group would exceed the 200-object template limit.");
        return design;
      }
      objects = [...remaining, ...newChildren];
    } else if (target?.type === "table" && patch.width !== undefined && target.width > 0) {
      const ratio = patch.width / target.width;
      const rowIds = new Set(directChildren(design.objects, target.id)
        .filter((object) => object.type === "tableRow")
        .map((object) => object.id));
      objects = objects.map((object) => object.type === "tableRow" && object.parentId === target.id
        ? { ...object, width: patch.width! }
        : object.type === "tableCell" && object.parentId && rowIds.has(object.parentId)
          ? { ...object, x: object.x * ratio, width: object.width * ratio }
          : object);
    } else if (target?.type === "tableRow" && patch.width !== undefined && target.width > 0) {
      const ratio = patch.width / target.width;
      objects = objects.map((object) => object.type === "tableCell" && object.parentId === target.id
        ? { ...object, x: object.x * ratio, width: object.width * ratio }
        : object);
    } else if (target?.type === "tableCell" &&
      (patch.x !== undefined || patch.width !== undefined || patch.y !== undefined)) {
      const parentRow = design.objects.find((object) => object.id === target.parentId);
      if (parentRow) {
        const cells = directChildren(design.objects, parentRow.id)
          .filter((object) => object.type === "tableCell")
          .map((object) => object.id === target.id
            ? { ...object, x: patch.x === undefined ? object.x : Math.max(0, patch.x), width: patch.width ?? object.width }
            : object)
          .sort((left, right) => left.x - right.x || (left.columnIndex ?? 0) - (right.columnIndex ?? 0));
        let nextX = 0;
        const positions = new Map(cells.map((cell, columnIndex) => {
          const position = { id: cell.id, x: nextX, y: 0, columnIndex };
          nextX += cell.width;
          return [cell.id, position] as const;
        }));
        objects = objects.map((object) => {
          const position = positions.get(object.id);
          return position ? { ...object, ...position } : object;
        });
      }
    }
    const page = { ...design.page };
    if (target?.type === "section" && patch.height !== undefined) {
      if (target.sectionKey === "header") page.headerHeightMm = patch.height;
      if (target.sectionKey === "signatures") page.footerHeightMm = patch.height;
    }
    return {
      ...design,
      schemaVersion: objects.some((object) => object.parentId || object.type === "tableRow" || object.type === "tableCell" || object.type === "group") ? 2 : design.schemaVersion,
      page,
      objects,
    };
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
    const formulaError = validateDesignerFormulas(draft.design);
    if (formulaError) {
      setErrorMessage(formulaError);
      toast.error("Fix the invalid formula before saving.");
      return;
    }
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
    const formulaError = validateDesignerFormulas(draft.design);
    if (formulaError) {
      setErrorMessage(formulaError);
      toast.error("Fix the invalid formula before saving a copy.");
      return;
    }
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
    const selected = draft.design.objects.find((object) => object.id === selectedObjectId);
    const parentSection = selected
      ? selected.type === "section" || selected.type === "group" ? selected : sectionForObject(selected, draft.design.objects)
      : undefined;
    const initial = initialObject(type, draft.design.objects.length, testType, parentSection);
    const object = {
      ...initial,
      ...(parentSection ? { parentId: parentSection.id, sectionKey: parentSection.sectionKey } : {}),
    };
    const tableChildren = type === "table"
      ? createTableStructure(object, draft.design.objects, testType)
      : [];
    if (draft.design.objects.length + 1 + tableChildren.length > 200) {
      toast.error("This table would exceed the 200-object template limit.");
      return;
    }
    patchDesign((design) => ({
      ...design,
      schemaVersion: 2,
      objects: [...design.objects, object, ...tableChildren],
    }));
    setSelectedObjectId(object.id);
    setTool("select");
  };
  const duplicateObject = (id: string) => {
    const object = draft?.design.objects.find((item) => item.id === id);
    if (!object || !draft) return;
    const descendants = descendantsOf(draft.design.objects, object.id);
    const subtree = [object, ...descendants];
    if (draft.design.objects.length + subtree.length > 200) {
      toast.error("Duplicating this object would exceed the 200-object template limit.");
      return;
    }
    const idMap = new Map(subtree.map((item) => [item.id, createDesignerId(item.type)]));
    const duplicatedSectionKey = object.type === "section" ? `custom-${createDesignerId("section")}` : undefined;
    const copies = subtree.map((item, index) => {
      const parentId = parentIdFor(item, draft.design.objects);
      const isRoot = item.id === object.id;
      const parentWasCopied = Boolean(parentId && idMap.has(parentId));
      const legacySectionChild = object.type === "section" && !item.parentId && item.sectionKey === object.sectionKey;
      return {
        ...cloneDesign(item),
        id: idMap.get(item.id)!,
        ...(parentWasCopied ? { parentId: idMap.get(parentId!) } : isRoot ? { parentId } : legacySectionChild ? { parentId: idMap.get(object.id) } : {}),
        ...(duplicatedSectionKey && item.sectionKey === object.sectionKey ? { sectionKey: duplicatedSectionKey } : {}),
        name: isRoot ? `${item.name} copy` : item.name,
        x: item.x + (isRoot ? 4 : 0),
        y: item.y + (isRoot ? 4 : 0),
        zIndex: Math.max(...draft.design.objects.map((candidate) => candidate.zIndex), 0) + index + 1,
      } as ReportTemplateObject;
    });
    patchDesign((design) => ({ ...design, schemaVersion: 2, objects: [...design.objects, ...copies] }));
    setSelectedObjectId(idMap.get(object.id));
  };
  const deleteObject = (id: string) => {
    const section = draft?.design.objects.find((object) => object.id === id && object.type === "section");
    const removeIds = new Set([id, ...descendantsOf(draft?.design.objects ?? [], id).map((object) => object.id)]);
    patchDesign((design) => ({
      ...design,
      objects: design.objects
        .filter((object) => section ? object.id !== id : !removeIds.has(object.id))
        .map((object) => {
          if (!section || parentIdFor(object, design.objects) !== section.id) return object;
          const { sectionKey: _sectionKey, parentId: _parentId, ...pageLevelObject } = object;
          const sectionPosition = absolutePosition(section, design.objects);
          return { ...pageLevelObject, x: object.x + sectionPosition.x, y: object.y + sectionPosition.y };
        }),
    }));
    if (selectedObjectIds.includes(id) || selectedObjectIds.some((selectedId) => removeIds.has(selectedId))) setSelectedObjectId(undefined);
  };
  const tableAction = (action: TableInspectorAction, objectId: string) => {
    if (!draft) return;
    const clicked = draft.design.objects.find((object) => object.id === objectId);
    if (!clicked) return;
    const selectedRow = clicked.type === "tableRow"
      ? clicked
      : clicked.type === "tableCell" && clicked.parentId
        ? draft.design.objects.find((object) => object.id === clicked.parentId)
        : undefined;
    const table = clicked.type === "table"
      ? clicked
      : selectedRow?.parentId
        ? draft.design.objects.find((object) => object.id === selectedRow.parentId)
        : undefined;
    if (!table || table.type !== "table") return;
    const rows = directChildren(draft.design.objects, table.id)
      .filter((object) => object.type === "tableRow")
      .sort((left, right) => left.y - right.y);
    const cellsByRow = new Map(rows.map((row) => [
      row.id,
      directChildren(draft.design.objects, row.id)
        .filter((object) => object.type === "tableCell")
        .sort((left, right) => (left.columnIndex ?? left.x) - (right.columnIndex ?? right.x)),
    ]));
    let nextSelection: string | undefined;
    patchDesign((design) => {
      let nextObjects = [...design.objects];
      const removeSubtree = (id: string) => {
        const ids = new Set([id, ...descendantsOf(nextObjects, id).map((item) => item.id)]);
        nextObjects = nextObjects.filter((item) => !ids.has(item.id));
      };
      const selectedColumn = clicked.type === "tableCell" ? clicked.columnIndex ?? 0 : undefined;
      const targetRow = selectedRow ?? rows.at(-1);
      if (action === "addRow" || action === "duplicateRow") {
        const sourceRow = action === "duplicateRow" ? targetRow : rows.at(-1);
        if (!sourceRow) return design;
        const rowId = createDesignerId("row");
        const nextY = rows.reduce((bottom, row) => Math.max(bottom, row.y + row.height), 0);
        const row = {
          ...cloneDesign(sourceRow),
          id: rowId,
          parentId: table.id,
          name: action === "duplicateRow" ? `${sourceRow.name} copy` : "New row",
          x: 0,
          y: nextY,
          width: table.width,
          zIndex: Math.max(0, ...design.objects.map((item) => item.zIndex)) + 1,
          ...(action === "addRow" ? { rowType: "static" as const } : {}),
        };
        const sourceCells = cellsByRow.get(sourceRow.id) ?? [];
        const cellCopies = sourceCells.map((cell, index) => ({
          ...cloneDesign(cell),
          id: createDesignerId("cell"),
          parentId: rowId,
          name: action === "duplicateRow" ? cell.name : `${cell.name} value`,
          y: 0,
          zIndex: row.zIndex + index + 1,
          ...(action === "addRow" ? { content: "", fieldKey: undefined, formula: undefined } : {}),
        }));
        nextObjects = [...nextObjects, row, ...cellCopies];
        nextSelection = rowId;
      } else if (action === "deleteRow") {
        if (!targetRow) return design;
        removeSubtree(targetRow.id);
        nextSelection = table.id;
      } else if (action === "addColumn" || action === "duplicateColumn" || action === "deleteColumn") {
        const targetIndex = selectedColumn ?? Math.max(0, ...[...cellsByRow.values()].map((cells) => cells.length - 1));
        const newCells: ReportTemplateObject[] = [];
        let selectedDuplicateCellId: string | undefined;
        for (const rowItem of rows) {
          const rowCells = cellsByRow.get(rowItem.id) ?? [];
          if (action === "deleteColumn") {
            const victim = rowCells.find((cell, index) => (cell.columnIndex ?? index) === targetIndex);
            if (victim) removeSubtree(victim.id);
            const remaining = rowCells.filter((cell) => cell.id !== victim?.id);
            const width = remaining.length ? table.width / remaining.length : table.width;
            remaining.forEach((cell, index) => {
              nextObjects = nextObjects.map((item) => item.id === cell.id
                ? { ...item, columnIndex: index, x: index * width, width }
                : item);
            });
            continue;
          }
          const insertionIndex = action === "addColumn" ? rowCells.length : Math.min(targetIndex + 1, rowCells.length);
          const sourceCell = action === "addColumn"
            ? rowCells.at(-1)
            : rowCells.find((cell, index) => (cell.columnIndex ?? index) === targetIndex) ?? rowCells.at(-1);
          const cells = [...rowCells];
          const newCell: ReportTemplateObject = sourceCell
            ? {
              ...cloneDesign(sourceCell),
              id: createDesignerId("cell"),
              parentId: rowItem.id,
              name: action === "duplicateColumn" ? `${sourceCell.name} copy` : "New column",
              ...(action === "addColumn" ? { content: "", fieldKey: undefined, formula: undefined } : {}),
            }
            : {
              id: createDesignerId("cell"),
              parentId: rowItem.id,
              type: "tableCell",
              name: "New column",
              x: 0,
              y: 0,
              width: table.width,
              height: rowItem.height,
              zIndex: rowItem.zIndex + 1,
              rotation: 0,
              locked: false,
              visible: true,
              content: "",
            };
          if (action === "duplicateColumn" && clicked.type === "tableCell" && clicked.parentId === rowItem.id) {
            selectedDuplicateCellId = newCell.id;
          }
          cells.splice(insertionIndex, 0, newCell);
          const width = table.width / cells.length;
          cells.forEach((cell, index) => {
            newCells.push({ ...cell, columnIndex: index, x: index * width, width, y: 0 });
          });
          const priorIds = new Set(rowCells.map((cell) => cell.id));
          nextObjects = nextObjects.filter((item) => !priorIds.has(item.id));
        }
        nextObjects = [...nextObjects, ...newCells];
        nextSelection = action === "duplicateColumn" ? selectedDuplicateCellId ?? table.id : table.id;
      } else if (action === "duplicateCell" || action === "deleteCell") {
        if (clicked.type !== "tableCell" || !selectedRow) return design;
        const rowCells = cellsByRow.get(selectedRow.id) ?? [];
        const index = rowCells.findIndex((cell) => cell.id === clicked.id);
        if (action === "deleteCell") {
          removeSubtree(clicked.id);
          const remaining = rowCells.filter((cell) => cell.id !== clicked.id);
          const width = remaining.length ? table.width / remaining.length : table.width;
          remaining.forEach((cell, cellIndex) => {
            nextObjects = nextObjects.map((item) => item.id === cell.id
              ? { ...item, columnIndex: cellIndex, x: cellIndex * width, width }
              : item);
          });
          nextSelection = selectedRow.id;
        } else {
          const copy = { ...cloneDesign(clicked), id: createDesignerId("cell"), name: `${clicked.name} copy` };
          const cells = [...rowCells];
          cells.splice(index + 1, 0, copy);
          const width = table.width / cells.length;
          cells.forEach((cell, cellIndex) => {
            nextObjects = nextObjects.map((item) => item.id === cell.id
              ? { ...item, columnIndex: cellIndex, x: cellIndex * width, width }
              : item);
          });
          nextObjects.push({ ...copy, columnIndex: index + 1, x: (index + 1) * width, width });
          nextSelection = copy.id;
        }
      }
      return { ...design, schemaVersion: 2, objects: nextObjects };
    });
    if (nextSelection) setSelectedObjectId(nextSelection);
  };
  const moveLayer = (id: string, direction: "up" | "down") => {
    const object = draft?.design.objects.find((item) => item.id === id);
    if (object) patchObject(id, { zIndex: object.zIndex + (direction === "up" ? 1 : -1) });
  };
  const align = (alignment: string) => {
    if (!draft || !selectedObject) return;
    const page = draft.design.page;
    const pageWidth = page.orientation === "landscape" ? page.heightMm : page.widthMm;
    const pageHeight = page.orientation === "landscape" ? page.widthMm : page.heightMm;
    const parentId = selectedObject.type === "section" ? undefined : parentIdFor(selectedObject, draft.design.objects);
    const parent = parentId ? draft.design.objects.find((object) => object.id === parentId) : undefined;
    const bounds = parent
      ? { width: parent.width, height: parent.height, left: 0, right: 0, top: 0, bottom: 0 }
      : { width: pageWidth, height: pageHeight, left: page.marginLeftMm, right: page.marginRightMm, top: page.marginTopMm, bottom: page.marginBottomMm };
    const patch: Partial<ReportTemplateObject> = alignment === "left" ? { x: bounds.left } : alignment === "right" ? { x: bounds.width - bounds.right - selectedObject.width } : alignment === "center" ? { x: (bounds.width - selectedObject.width) / 2 } : alignment === "top" ? { y: bounds.top } : alignment === "bottom" ? { y: bounds.height - bounds.bottom - selectedObject.height } : { y: (bounds.height - selectedObject.height) / 2 };
    patchObject(selectedObject.id, patch);
  };
  const groupSelection = () => {
    if (!draft || selectedObjectIds.length < 2) return;
    const selectedObjects = draft.design.objects.filter((object) => selectedObjectIds.includes(object.id));
    if (selectedObjects.length < 2 || selectedObjects.some((object) => ["section", "table", "tableRow", "tableCell"].includes(object.type))) return;
    const parentId = parentIdFor(selectedObjects[0], draft.design.objects);
    if (selectedObjects.some((object) => parentIdFor(object, draft.design.objects) !== parentId)) return;
    const left = Math.min(...selectedObjects.map((object) => object.x));
    const top = Math.min(...selectedObjects.map((object) => object.y));
    const right = Math.max(...selectedObjects.map((object) => object.x + object.width));
    const bottom = Math.max(...selectedObjects.map((object) => object.y + object.height));
    const groupId = createDesignerId("group");
    const sectionKey = selectedObjects[0].sectionKey;
    const group: ReportTemplateObject = {
      id: groupId,
      ...(parentId ? { parentId } : {}),
      type: "group",
      name: "Group",
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      zIndex: Math.max(0, ...selectedObjects.map((object) => object.zIndex)) + 1,
      rotation: 0,
      locked: false,
      visible: true,
      ...(sectionKey ? { sectionKey } : {}),
    };
    patchDesign((design) => ({
      ...design,
      schemaVersion: 2,
      objects: [
        ...design.objects.map((object) => selectedObjectIds.includes(object.id)
          ? { ...object, parentId: groupId, x: object.x - left, y: object.y - top }
          : object),
        group,
      ],
    }));
    setSelectedObjectId(groupId);
  };
  const ungroupSelection = () => {
    if (!draft || selectedObject?.type !== "group") return;
    const group = selectedObject;
    const children = directChildren(draft.design.objects, group.id);
    patchDesign((design) => ({
      ...design,
      objects: design.objects
        .filter((object) => object.id !== group.id)
        .map((object) => object.parentId === group.id
          ? {
            ...object,
            parentId: group.parentId,
            x: object.x + group.x,
            y: object.y + group.y,
          }
          : object),
    }));
    setSelectedObjectIds(children.map((object) => object.id));
  };
  const copySelection = () => {
    if (!draft || selectedObjectIds.length === 0) return;
    const roots = draft.design.objects.filter((object) => selectedObjectIds.includes(object.id))
      .filter((object) => {
        let parentId = parentIdFor(object, draft.design.objects);
        while (parentId) {
          if (selectedObjectIds.includes(parentId)) return false;
          parentId = parentIdFor(draft.design.objects.find((candidate) => candidate.id === parentId)!, draft.design.objects);
        }
        return true;
      });
    clipboard.current = roots.flatMap((root) => [root, ...descendantsOf(draft.design.objects, root.id)])
      .map((object) => ({ ...cloneDesign(object), parentId: parentIdFor(object, draft.design.objects) }));
  };
  const pasteSelection = () => {
    if (!draft || !clipboard.current.length || draft.design.objects.length + clipboard.current.length > 200) return;
    const source = clipboard.current;
    const idMap = new Map(source.map((object) => [object.id, createDesignerId(object.type)]));
    const sourceIds = new Set(source.map((object) => object.id));
    const sectionKeys = new Map(source
      .filter((object) => object.type === "section" && object.sectionKey)
      .map((object) => [object.sectionKey!, `custom-${createDesignerId("section")}`]));
    const rootIds = source.filter((object) => !object.parentId || !sourceIds.has(object.parentId)).map((object) => object.id);
    const copies = source.map((object, index) => {
      const root = rootIds.includes(object.id);
      return {
        ...cloneDesign(object),
        id: idMap.get(object.id)!,
        ...(object.parentId && sourceIds.has(object.parentId) ? { parentId: idMap.get(object.parentId) } : {}),
        ...(object.sectionKey && sectionKeys.has(object.sectionKey) ? { sectionKey: sectionKeys.get(object.sectionKey) } : {}),
        x: object.x + (root ? 4 : 0),
        y: object.y + (root ? 4 : 0),
        zIndex: Math.max(0, ...draft.design.objects.map((item) => item.zIndex)) + index + 1,
      } as ReportTemplateObject;
    });
    patchDesign((design) => ({ ...design, schemaVersion: 2, objects: [...design.objects, ...copies] }));
    setSelectedObjectIds(rootIds.map((id) => idMap.get(id)!));
  };
  const deleteSelection = () => {
    if (!draft || !selectedObjectIds.length) return;
    const selectedSet = new Set(selectedObjectIds);
    const roots = draft.design.objects.filter((object) => selectedSet.has(object.id))
      .filter((object) => {
        const parentId = parentIdFor(object, draft.design.objects);
        return !parentId || !selectedSet.has(parentId);
      });
    const deletingIds = new Set<string>();
    for (const root of roots) {
      if (root.type !== "section") {
        deletingIds.add(root.id);
        descendantsOf(draft.design.objects, root.id).forEach((child) => deletingIds.add(child.id));
      }
    }
    patchDesign((design) => ({
      ...design,
      objects: design.objects
        .filter((object) => !deletingIds.has(object.id) && !roots.some((root) => root.type === "section" && root.id === object.id))
        .map((object) => {
          const removedSection = roots.find((root) => root.type === "section" && parentIdFor(object, design.objects) === root.id);
          if (!removedSection) return object;
          const sectionPosition = absolutePosition(removedSection, design.objects);
          const { parentId: _parentId, sectionKey: _sectionKey, ...remaining } = object;
          return { ...remaining, x: object.x + sectionPosition.x, y: object.y + sectionPosition.y };
        }),
    }));
    setSelectedObjectId(undefined);
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        if ((event.key === "Delete" || event.key === "Backspace") &&
          !["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) {
          event.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === "c") { event.preventDefault(); copySelection(); }
      else if (key === "v") { event.preventDefault(); pasteSelection(); }
      else if (key === "d" && selectedObjectId) { event.preventDefault(); duplicateObject(selectedObjectId); }
      else if (key === "g" && event.shiftKey) { event.preventDefault(); ungroupSelection(); }
      else if (key === "g") { event.preventDefault(); groupSelection(); }
      else if (key === "z" && event.shiftKey) { event.preventDefault(); redo(); }
      else if (key === "z") { event.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draft, selectedObjectIds, selectedObjectId, history, future]);
  const uploadImage = async (file: File) => {
    if (!selectedObject || selectedObject.type !== "image") return;
    try {
      const result = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type, purpose: "report-template" } });
      const response = await fetch(result.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Upload failed");
      patchObject(selectedObject.id, { objectPath: result.objectPath, name: file.name }); toast.success("Image uploaded");
    } catch { toast.error("Unable to upload image"); }
  };

  const changeZoomStep = (direction: -1 | 1) => {
    setFitMode(null);
    setZoom((current) => direction > 0
      ? DESIGNER_ZOOM_PRESETS.find((value) => value > current + 0.001) ?? 2
      : [...DESIGNER_ZOOM_PRESETS].reverse().find((value) => value < current - 0.001) ?? current);
  };
  const chooseZoom = (value: number) => {
    setFitMode(null);
    setZoom(value);
  };
  const fitToScreen = () => {
    setFitMode("screen");
    applyFit("screen");
  };
  const fitToWidth = () => {
    setFitMode("width");
    applyFit("width");
  };
  const toggleFullscreen = async () => {
    if (fullscreenFallback) {
      setFullscreenFallback(false);
      return;
    }
    if (document.fullscreenElement === editorRootRef.current) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    const editor = editorRootRef.current;
    if (!editor) return;
    try {
      await editor.requestFullscreen();
    } catch {
      setFullscreenFallback(true);
    }
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
    <div
      ref={editorRootRef}
      className={`report-designer-shell overflow-hidden rounded-xl border border-border/80 shadow-sm ${fullscreenFallback ? "report-designer-shell--fullscreen-fallback" : ""}`}
      data-testid="report-layouts-editor"
      data-fullscreen={isFullscreen}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-card px-4 py-3">
        <div className="mr-auto flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Layers3 className="h-4 w-4" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Settings / Report layouts</p><h1 className="text-lg font-semibold tracking-tight">Certificate designer</h1></div></div>
         <select value={testType} onChange={(event) => { initializedId.current = undefined; setSelectedTemplateId(undefined); setTestType(event.target.value as TestTypeValue); }} className="h-9 rounded-md border border-input bg-background px-3 text-xs font-semibold" data-testid="select-designer-test-type">{REPORT_TEST_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
        <select value={selectedTemplateId ?? ""} onChange={(event) => { initializedId.current = undefined; setSelectedTemplateId(Number(event.target.value)); }} className="h-9 max-w-[230px] rounded-md border border-input bg-background px-3 text-xs" data-testid="select-designer-template">{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " · Default" : ""}</option>)}{templates.length === 0 && <option value="">No templates</option>}</select>
        <Button type="button" size="sm" className="h-9 gap-1.5" onClick={() => { setCreateName(`${testType} certificate`); setCreateOpen(true); }} data-testid="button-create-template"><FilePlus2 className="h-4 w-4" /> New</Button>
      </div>
       {draft && <ReportDesignerToolbar tool={tool} onToolChange={(next) => { setTool(next); if (next !== "select") addObject(next); }} onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={future.length > 0} onSave={save} onSaveAs={() => { setCreateName(`${draft.name} copy`); setCreateDescription(draft.description ?? ""); setSaveAsOpen(true); }} onZoom={changeZoomStep} onSetZoom={chooseZoom} onFitToScreen={fitToScreen} onFitToWidth={fitToWidth} onToggleFullscreen={() => void toggleFullscreen()} isFullscreen={isFullscreen} zoom={zoom} grid={grid} snap={snap} onGridChange={setGrid} onSnapChange={setSnap} onAlign={align} hasSelection={Boolean(selectedObject)} isDirty={Boolean(isDirty)} isSaving={update.isPending} canGroup={canGroup} canUngroup={canUngroup} onGroup={groupSelection} onUngroup={ungroupSelection} />}
      {errorMessage && <div className="flex items-center gap-2 border-b border-destructive/25 bg-destructive/[.05] px-4 py-2 text-xs text-destructive" role="alert" data-testid="status-designer-error"><AlertTriangle className="h-3.5 w-3.5" /> {errorMessage}</div>}
      {!draft ? <div className="flex min-h-[520px] items-center justify-center bg-muted/30 p-8" data-testid="status-report-templates-empty"><div className="max-w-md text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-4 text-lg font-semibold">No {testType} templates yet</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Create the first standards-aware certificate template. The live preview will use a real saved QC record when one is available.</p><Button className="mt-5 gap-2" onClick={() => { setCreateName(`${testType} certificate`); setCreateOpen(true); }} data-testid="button-create-first-template"><FilePlus2 className="h-4 w-4" /> Create template</Button></div></div> : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-4 py-2">
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="h-8 w-64 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0" data-testid="input-template-name" aria-label="Template name" />
            <Input value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add a description for this approved template" className="h-8 min-w-[240px] max-w-md flex-1 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0" data-testid="input-template-description" aria-label="Template description" />
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span data-testid="text-template-version">v{draft.version}</span>{draft.isDefault && <Badge className="gap-1 bg-success text-success-foreground"><Star className="h-3 w-3" /> Default</Badge>}{isDirty ? <span className="text-warning" data-testid="status-template-dirty">Unsaved changes</span> : <span className="inline-flex items-center gap-1 text-success" data-testid="status-template-saved"><Check className="h-3 w-3" /> Saved</span>}</div>
          </div>
          <div
            className="report-designer-workspace"
            data-inspector-open={inspectorOpen}
            data-left-collapsed={layersCollapsed}
            style={{ "--designer-inspector-width": `${inspectorWidth}px` } as CSSProperties}
          >
            <ReportDesignerLayers objects={draft.design.objects} selectedIds={selectedObjectIds} onSelect={selectObject} onPatch={patchObject} onDelete={deleteObject} onDuplicate={duplicateObject} onMove={moveLayer} onAdd={addObject} collapsed={layersCollapsed} onToggleCollapsed={() => setLayersCollapsed((value) => !value)} />
            <main className="relative flex min-h-0 min-w-0 flex-col" data-testid="report-designer-center-panel">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/25 px-4 py-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Live certificate</span><select value={recordId ?? ""} onChange={(event) => setRecordId(event.target.value ? Number(event.target.value) : undefined)} className="h-8 min-w-[230px] rounded-md border border-input bg-background px-2 text-xs" data-testid="select-preview-record"><option value="">Choose saved QC record…</option>{records.map((record) => <option key={record.id} value={record.id}>{record.recordNo} · {record.sampleDate} · {record.material}</option>)}</select>{recordsQuery.isLoading && <span className="text-xs text-muted-foreground" data-testid="status-preview-records-loading">Loading saved records…</span>}{recordsQuery.isError && <span className="text-xs text-destructive" data-testid="status-preview-records-error">Saved records unavailable.</span>}<span className="ml-auto text-[10px] font-mono text-muted-foreground" data-testid="text-preview-record-count">{records.length} saved record{records.length === 1 ? "" : "s"}</span></div>
              <div ref={canvasViewportRef} className="report-designer-canvas-scroll flex-1">
                <div className="report-designer-canvas-center">
                   <ReportDesignerCanvas page={draft.design.page} objects={draft.design.objects} selectedId={selectedObjectId} zoom={zoom} grid={grid} snap={snap} onSelect={selectObject} onMove={patchObject} preview={<div className="report-designer-preview-layer">{reportPreview}</div>} />
                </div>
                {!inspectorOpen && <Button type="button" variant="outline" size="sm" className="absolute right-3 top-3 z-20 h-9 gap-1.5 bg-card/95 shadow-md" onClick={() => setInspectorOpen(true)} data-testid="button-reopen-inspector"><ChevronRight className="h-4 w-4" /> Inspector</Button>}
              </div>
            </main>
            {inspectorOpen && (
              <aside className="report-designer-inspector-shell border-l border-border/70" data-testid="report-designer-inspector" style={{ width: inspectorWidth }}>
                <div
                  className="report-designer-inspector-resizer"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize inspector"
                  aria-valuemin={280}
                  aria-valuemax={500}
                  aria-valuenow={inspectorWidth}
                  tabIndex={0}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    inspectorResizeStart.current = { clientX: event.clientX, width: inspectorWidth };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const start = inspectorResizeStart.current;
                    if (start) setInspectorWidth(Math.min(500, Math.max(280, start.width + start.clientX - event.clientX)));
                  }}
                  onPointerUp={() => { inspectorResizeStart.current = undefined; }}
                  onPointerCancel={() => { inspectorResizeStart.current = undefined; }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") setInspectorWidth((value) => Math.min(500, value + 16));
                    if (event.key === "ArrowRight") setInspectorWidth((value) => Math.max(280, value - 16));
                  }}
                  data-testid="separator-resize-inspector"
                />
                <div className="report-designer-inspector-header">
                  <span className="text-xs font-semibold">Inspector</span>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => setInspectorOpen(false)} data-testid="button-close-inspector"><ChevronLeft className="h-4 w-4" /> Close Inspector</Button>
                </div>
                <div className="min-h-0 flex-1">
                   <ReportDesignerProperties design={draft.design} objects={draft.design.objects} selected={selectedObject} testType={testType} onPageChange={patchPage} onObjectChange={(patch) => selectedObject && patchObject(selectedObject.id, patch)} onLayoutChange={patchLayout} onUpload={uploadImage} onTableAction={tableAction} />
                </div>
              </aside>
            )}
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

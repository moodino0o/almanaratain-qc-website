import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ReportTemplateObject, ReportTemplatePage } from "@workspace/api-client-react";
import { absolutePosition, parentIdFor, sectionForObject, visibleWithParents } from "./report-designer-model";
import { snapValue } from "./report-designer-types";

const PX_PER_MM = 3.7795;

type CanvasProps = {
  page: ReportTemplatePage;
  objects: ReportTemplateObject[];
  selectedId?: string;
  zoom: number;
  grid: boolean;
  snap: boolean;
  onSelect: (id: string, extend?: boolean) => void;
  onMove: (id: string, patch: Partial<ReportTemplateObject>) => void;
  preview?: ReactNode;
};

type DragState = { id: string; mode: "move" | "resize"; startX: number; startY: number; origin: ReportTemplateObject };

function objectStyle(object: ReportTemplateObject, scale: number) {
  return {
    left: object.x * PX_PER_MM * scale,
    top: object.y * PX_PER_MM * scale,
    width: object.width * PX_PER_MM * scale,
    height: object.height * PX_PER_MM * scale,
    transform: `rotate(${object.rotation}deg)`,
    opacity: 1,
    zIndex: object.zIndex,
    display: object.visible ? undefined : "none",
  };
}

function objectHandle(object: ReportTemplateObject) {
  if (object.type === "section" || object.type === "group") {
    return <div
      className="h-full w-full border border-dashed border-slate-400/50 bg-transparent"
      aria-hidden="true"
    />;
  }
  return <div className="h-full w-full bg-transparent" aria-hidden="true" />;
}

function canvasObjectPosition(
  object: ReportTemplateObject,
  objects: ReportTemplateObject[],
  page: ReportTemplatePage,
) {
  const position = absolutePosition(object, objects);
  const section = sectionForObject(object, objects);
  if (object.type === "section") {
    const pageVisibility = object.sectionKey === "header"
      ? page.showHeader
      : object.sectionKey === "signatures"
        ? page.showFooter
        : true;
    return { ...object, ...position, visible: visibleWithParents(object, objects) && pageVisibility };
  }
  const pageVisible = section?.sectionKey === "header"
    ? page.showHeader
    : section?.sectionKey === "signatures"
      ? page.showFooter
      : true;
  return {
    ...object,
    ...position,
    visible: visibleWithParents(object, objects) && pageVisible,
  };
}

export function ReportDesignerCanvas({ page, objects, selectedId, zoom, grid, snap, onSelect, onMove, preview }: CanvasProps) {
  const drag = useRef<DragState | null>(null);
  const latestPatch = useRef<{ id: string; patch: Partial<ReportTemplateObject> } | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ id: string; patch: Partial<ReportTemplateObject> }>();
  const scale = zoom;
  const pageWidthMm = page.orientation === "landscape" ? page.heightMm : page.widthMm;
  const pageHeightMm = page.orientation === "landscape" ? page.widthMm : page.heightMm;
  const width = pageWidthMm * PX_PER_MM * scale;
  const height = pageHeightMm * PX_PER_MM * scale;

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const dx = (event.clientX - state.startX) / PX_PER_MM / scale;
      const dy = (event.clientY - state.startY) / PX_PER_MM / scale;
      const nextX = snapValue(state.origin.x + dx, 2, snap);
      const nextY = snapValue(state.origin.y + dy, 2, snap);
      const patch = state.mode === "resize"
        ? { width: Math.max(1, snapValue(state.origin.width + dx, 2, snap)), height: Math.max(1, snapValue(state.origin.height + dy, 2, snap)) }
        : { x: nextX, y: nextY };
      latestPatch.current = { id: state.id, patch };
      setDragPreview(latestPatch.current);
    };
    const up = () => {
      const finalPatch = latestPatch.current;
      if (finalPatch) onMove(finalPatch.id, finalPatch.patch);
      drag.current = null;
      latestPatch.current = undefined;
      setDragPreview(undefined);
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [onMove, scale, snap]);

  return (
    <div className="relative" style={{ width, height, "--designer-zoom": scale } as CSSProperties} data-testid="report-designer-page">
      <div className="absolute inset-0 overflow-hidden bg-card shadow-[0_10px_35px_rgba(21,35,49,.16)] ring-1 ring-border/70" data-testid="report-designer-report-preview">
        {preview}
      </div>
      {grid && <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(to right, rgba(79,101,117,.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(79,101,117,.16) 1px, transparent 1px)", backgroundSize: `${2 * PX_PER_MM * scale}px ${2 * PX_PER_MM * scale}px` }} data-testid="report-designer-grid" />}
      <div className="absolute inset-0">
        {[...objects]
          .sort((left, right) => {
            const leftDepth = objectDepth(left, objects);
            const rightDepth = objectDepth(right, objects);
            return leftDepth - rightDepth || left.zIndex - right.zIndex;
          })
          .map((object) => {
          const selected = object.id === selectedId;
          let previewObject = canvasObjectPosition(
            {
              ...(dragPreview?.id === object.id ? { ...object, ...dragPreview.patch } : object),
              zIndex: object.zIndex + objectDepth(object, objects) * 1000,
            },
            objects,
            page,
          );
          if (dragPreview && dragPreview.id !== object.id && isDescendantOf(object, dragPreview.id, objects)) {
            const draggedObject = objects.find((candidate) => candidate.id === dragPreview.id);
            if (draggedObject) {
              previewObject = {
                ...previewObject,
                x: previewObject.x + (dragPreview.patch.x ?? draggedObject.x) - draggedObject.x,
                y: previewObject.y + (dragPreview.patch.y ?? draggedObject.y) - draggedObject.y,
              };
            }
          }
          return (
            <div
              key={object.id}
              className={`absolute overflow-visible ${selected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/60"} ${object.locked ? "cursor-not-allowed" : "cursor-move"}`}
              style={objectStyle(previewObject, scale)}
              onPointerDown={(event) => {
                event.stopPropagation();
                const extendSelection = event.shiftKey || event.metaKey || event.ctrlKey;
                onSelect(object.id, extendSelection);
                if (extendSelection) return;
                if (object.locked) return;
                latestPatch.current = undefined;
                setDragPreview(undefined);
                drag.current = { id: object.id, mode: "move", startX: event.clientX, startY: event.clientY, origin: object };
                setDragging(true);
              }}
              data-testid={`canvas-object-${object.id}`}
              role="button"
              tabIndex={0}
              aria-label={`Select ${object.name}`}
            >
              {objectHandle(object)}
              {selected && !object.locked && (
                <button
                  type="button"
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-sm border border-primary bg-card shadow-sm"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    latestPatch.current = undefined;
                    setDragPreview(undefined);
                    drag.current = { id: object.id, mode: "resize", startX: event.clientX, startY: event.clientY, origin: object };
                    setDragging(true);
                  }}
                  data-testid={`button-resize-object-${object.id}`}
                  aria-label={`Resize ${object.name}`}
                />
              )}
            </div>
          );
        })}
      </div>
      {dragging && <div className="pointer-events-none absolute left-2 top-2 rounded bg-foreground px-2 py-1 font-mono text-[10px] text-background" data-testid="status-dragging-object">Editing placement</div>}
    </div>
  );
}

function objectDepth(object: ReportTemplateObject, objects: ReportTemplateObject[]) {
  let depth = 0;
  let current = object;
  const visited = new Set<string>();
  while (parentIdFor(current, objects) && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = objects.find((candidate) => candidate.id === parentIdFor(current, objects));
    if (!parent) break;
    current = parent;
    depth += 1;
  }
  return depth;
}

function isDescendantOf(
  object: ReportTemplateObject,
  ancestorId: string,
  objects: ReportTemplateObject[],
) {
  const visited = new Set<string>();
  let parentId = parentIdFor(object, objects);
  while (parentId && !visited.has(parentId)) {
    if (parentId === ancestorId) return true;
    visited.add(parentId);
    const parent = objects.find((candidate) => candidate.id === parentId);
    parentId = parent ? parentIdFor(parent, objects) : undefined;
  }
  return false;
}

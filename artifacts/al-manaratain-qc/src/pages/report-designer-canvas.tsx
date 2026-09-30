import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ReportTemplateObject, ReportTemplatePage } from "@workspace/api-client-react";
import { snapValue } from "./report-designer-types";

const PX_PER_MM = 3.7795;

type CanvasProps = {
  page: ReportTemplatePage;
  objects: ReportTemplateObject[];
  selectedId?: string;
  zoom: number;
  grid: boolean;
  snap: boolean;
  onSelect: (id: string) => void;
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
    opacity: object.opacity ?? 1,
    zIndex: object.zIndex,
    display: object.visible ? undefined : "none",
  };
}

function renderObject(object: ReportTemplateObject) {
  const common = { color: object.textColor ?? "#20252b", fontFamily: object.fontFamily ?? "Arial", fontSize: `${(object.fontSize ?? 12) * 0.85}px`, fontWeight: object.bold ? 700 : 400, textAlign: object.textAlign ?? "left" as const };
  if (object.type === "text") return <span style={common}>{object.content || "Text box"}</span>;
  if (object.type === "dynamicField") return <span style={{ ...common, fontStyle: "italic" }}>{object.fieldKey ? `{{ ${object.fieldKey} }}` : "Choose field"}</span>;
  if (object.type === "line") return <div className="h-full w-full" style={{ borderTop: object.lineOrientation === "vertical" ? undefined : `1px ${object.lineStyle ?? "solid"} ${object.borderColor ?? "#9b1739"}`, borderLeft: object.lineOrientation === "vertical" ? `1px ${object.lineStyle ?? "solid"} ${object.borderColor ?? "#9b1739"}` : undefined }} />;
  if (object.type === "image") return object.objectPath ? <img src={`/api/storage${object.objectPath}`} alt={object.name} className="h-full w-full object-contain" /> : <div className="flex h-full w-full items-center justify-center border border-dashed border-primary/50 text-[10px] text-primary">Image</div>;
  if (object.type === "table") return <div className="h-full w-full overflow-hidden border border-border bg-card/90 p-1"><div className="grid h-full grid-rows-4 gap-px border border-border bg-border">{Array.from({ length: 4 }, (_, row) => <div key={row} className="grid grid-cols-4 gap-px">{Array.from({ length: 4 }, (_, column) => <div key={column} className={row === 0 ? "bg-primary/10" : "bg-background"} />)}</div>)}</div></div>;
  if (object.type === "section") return <div className="h-full w-full rounded-sm border border-dashed border-primary/40 bg-primary/[.025]" />;
  const shape = object.shapeType ?? "rectangle";
  return <div className="h-full w-full" style={{ background: object.fillColor ?? "transparent", border: `${object.borderWidth ?? 1}px solid ${object.borderColor ?? "#9aa6b2"}`, borderRadius: shape === "circle" ? "50%" : `${object.borderRadius ?? 0}px` }} />;
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
        {objects.map((object) => {
          const selected = object.id === selectedId;
          const previewObject = dragPreview?.id === object.id ? { ...object, ...dragPreview.patch } : object;
          return (
            <div
              key={object.id}
              className={`absolute overflow-visible ${selected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-primary/60"} ${object.locked ? "cursor-not-allowed" : "cursor-move"}`}
              style={objectStyle(previewObject, scale)}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect(object.id);
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
              {renderObject(object)}
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

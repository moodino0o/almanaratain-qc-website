import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Copy,
  Grid3X3,
  Plus,
  Redo2,
  Save,
  Settings2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type DesignerTool = "select" | "text" | "dynamicField" | "line" | "shape" | "image" | "table";

type ToolbarProps = {
  tool: DesignerTool;
  onToolChange: (tool: DesignerTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onZoom: (delta: number) => void;
  zoom: number;
  grid: boolean;
  snap: boolean;
  onGridChange: (value: boolean) => void;
  onSnapChange: (value: boolean) => void;
  onAlign: (alignment: string) => void;
  hasSelection: boolean;
  isDirty: boolean;
  isSaving: boolean;
};

const tools: Array<{ id: DesignerTool; label: string; icon: typeof Plus }> = [
  { id: "select", label: "Select", icon: Settings2 },
  { id: "text", label: "Text", icon: Plus },
  { id: "dynamicField", label: "Field", icon: Plus },
  { id: "line", label: "Line", icon: Plus },
  { id: "shape", label: "Shape", icon: Plus },
  { id: "image", label: "Image", icon: Plus },
  { id: "table", label: "Table", icon: Plus },
];

export function ReportDesignerToolbar(props: ToolbarProps) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-border/70 bg-card px-3 py-2 shadow-sm" data-testid="report-designer-toolbar">
      <div className="mr-2 flex items-center gap-1 border-r border-border/70 pr-2">
        <span className="mr-1 hidden text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground lg:inline">Insert</span>
        {tools.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={props.tool === id ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={() => props.onToolChange(id)}
            data-testid={`button-tool-${id}`}
            aria-pressed={props.tool === id}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{label}</span>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1 border-r border-border/70 pr-2">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!props.canUndo} onClick={props.onUndo} data-testid="button-designer-undo" aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!props.canRedo} onClick={props.onRedo} data-testid="button-designer-redo" aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant={props.grid ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => props.onGridChange(!props.grid)} data-testid="button-toggle-grid" aria-label="Toggle grid">
          <Grid3X3 className="h-4 w-4" />
        </Button>
        <label className="hidden items-center gap-1 text-[11px] text-muted-foreground 2xl:flex">
          <input type="checkbox" checked={props.snap} onChange={(event) => props.onSnapChange(event.target.checked)} data-testid="checkbox-snap-grid" />
          Snap
        </label>
      </div>
      <div className="flex items-center gap-1 border-r border-border/70 pr-2">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!props.hasSelection} onClick={() => props.onAlign("left")} data-testid="button-align-left" aria-label="Align left"><AlignStartHorizontal className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!props.hasSelection} onClick={() => props.onAlign("center")} data-testid="button-align-center" aria-label="Align center"><AlignCenterHorizontal className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!props.hasSelection} onClick={() => props.onAlign("right")} data-testid="button-align-right" aria-label="Align right"><AlignEndHorizontal className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={!props.hasSelection} onClick={() => props.onAlign("top")} data-testid="button-align-top" aria-label="Align top"><AlignStartVertical className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" disabled={!props.hasSelection} onClick={() => props.onAlign("middle")} data-testid="button-align-middle" aria-label="Align middle"><AlignCenterVertical className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" disabled={!props.hasSelection} onClick={() => props.onAlign("bottom")} data-testid="button-align-bottom" aria-label="Align bottom"><AlignEndVertical className="h-4 w-4" /></Button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => props.onZoom(-0.1)} data-testid="button-zoom-out" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
        <span className="w-11 text-center font-mono text-[11px] text-muted-foreground" data-testid="text-designer-zoom">{Math.round(props.zoom * 100)}%</span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => props.onZoom(0.1)} data-testid="button-zoom-in" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
        <Button type="button" variant="outline" size="sm" className="ml-2 h-8 gap-1.5 text-xs" onClick={props.onSaveAs} data-testid="button-save-as">
          <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Save as</span>
        </Button>
        <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={props.onSave} disabled={props.isSaving || !props.isDirty} data-testid="button-save-template">
          <Save className="h-3.5 w-3.5" /> {props.isSaving ? "Saving" : "Save"}
        </Button>
        {props.isDirty && <Badge variant="outline" className="hidden border-warning/40 text-warning lg:inline-flex">Unsaved</Badge>}
      </div>
    </header>
  );
}

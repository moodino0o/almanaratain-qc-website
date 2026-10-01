import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Lock, LockOpen, MoreHorizontal, Plus, Trash2, Copy } from "lucide-react";
import type { ReportTemplateObject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { objectLabel } from "./report-designer-types";

type LayersProps = {
  objects: ReportTemplateObject[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<ReportTemplateObject>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onAdd: (type: ReportTemplateObject["type"]) => void;
};

export function ReportDesignerLayers({ objects, selectedId, onSelect, onPatch, onDelete, onDuplicate, onMove, onAdd }: LayersProps) {
  const ordered = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  const sectionNames = new Map(
    objects
      .filter((object) => object.type === "section" && object.sectionKey)
      .map((object) => [object.sectionKey!, object.name]),
  );
  return (
    <aside className="flex min-h-0 flex-col border-r border-border/70 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]" data-testid="report-designer-left-panel">
      <div className="border-b border-[hsl(var(--sidebar-border))] px-3 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--sidebar-foreground)/.6)]">Template objects</p>
            <p className="mt-1 text-sm font-semibold">Layers</p>
          </div>
          <span className="font-mono text-[11px] text-[hsl(var(--sidebar-foreground)/.55)]" data-testid="text-layer-count">{objects.length}/200</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 border-b border-[hsl(var(--sidebar-border))] p-2">
        {(["text", "dynamicField", "line", "shape", "image", "table"] as const).map((type) => (
          <Button key={type} variant="ghost" size="sm" className="h-8 justify-start gap-1 px-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.8)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]" onClick={() => onAdd(type)} data-testid={`button-layer-add-${type}`}>
            <Plus className="h-3 w-3" /> {type === "dynamicField" ? "Field" : type === "table" ? "Table" : type}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {ordered.length === 0 ? (
          <div className="rounded border border-dashed border-[hsl(var(--sidebar-border))] p-4 text-center text-xs text-[hsl(var(--sidebar-foreground)/.65)]" data-testid="status-layers-empty">No objects yet. Add a text box, field, line, shape, image, or table.</div>
        ) : ordered.map((object) => (
          <div key={object.id} className={`group mb-1 rounded-md border px-1.5 py-1.5 ${selectedId === object.id ? "border-[hsl(var(--sidebar-accent))] bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]" : "border-transparent hover:border-[hsl(var(--sidebar-border))]"}`} data-testid={`row-layer-${object.id}`}>
            <div className="flex items-center gap-1">
              <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-40" />
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onSelect(object.id)} className="block w-full truncate text-left text-xs font-medium" data-testid={`button-select-layer-${object.id}`}>{objectLabel(object)}</button>
                {object.type !== "section" && object.sectionKey && (
                  <p className="truncate pl-2 text-[9px] text-current/60" data-testid={`text-layer-parent-${object.id}`}>
                    in {sectionNames.get(object.sectionKey) ?? object.sectionKey}
                  </p>
                )}
              </div>
              <button type="button" className="rounded p-1 opacity-70 hover:opacity-100" onClick={() => onPatch(object.id, { visible: !object.visible })} data-testid={`button-toggle-visibility-${object.id}`} aria-label={object.visible ? "Hide object" : "Show object"}>{object.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
              <button type="button" className="rounded p-1 opacity-70 hover:opacity-100" onClick={() => onPatch(object.id, { locked: !object.locked })} data-testid={`button-toggle-lock-${object.id}`} aria-label={object.locked ? "Unlock object" : "Lock object"}>{object.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}</button>
            </div>
            {selectedId === object.id && (
              <div className="mt-2 flex items-center gap-1 border-t border-current/10 pt-1">
                <Input value={object.name} onChange={(event) => onPatch(object.id, { name: event.target.value })} className="h-7 border-0 bg-transparent px-1 text-[11px] text-inherit shadow-none" data-testid={`input-layer-name-${object.id}`} aria-label="Object name" />
                <button type="button" onClick={() => onMove(object.id, "up")} className="rounded p-1 hover:bg-black/10" data-testid={`button-layer-up-${object.id}`} aria-label="Move layer up"><ChevronUp className="h-3 w-3" /></button>
                <button type="button" onClick={() => onMove(object.id, "down")} className="rounded p-1 hover:bg-black/10" data-testid={`button-layer-down-${object.id}`} aria-label="Move layer down"><ChevronDown className="h-3 w-3" /></button>
                {object.type !== "section" && <button type="button" onClick={() => onDuplicate(object.id)} className="rounded p-1 hover:bg-black/10" data-testid={`button-layer-duplicate-${object.id}`} aria-label="Duplicate layer"><Copy className="h-3 w-3" /></button>}
                <button type="button" onClick={() => onDelete(object.id)} className="rounded p-1 text-destructive hover:bg-black/10" data-testid={`button-layer-delete-${object.id}`} aria-label="Delete layer"><Trash2 className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">
        <div className="flex items-center gap-1"><MoreHorizontal className="h-3 w-3" /> Top layer renders last</div>
      </div>
    </aside>
  );
}

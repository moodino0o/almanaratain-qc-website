import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getListSieveStandardsQueryKey,
  getListShapeFactorsQueryKey,
  getListStrengthStandardsQueryKey,
  getGetLookupsQueryKey,
  getGetReferenceDataQueryKey,
  SieveStandard,
  ShapeFactor,
  StrengthStandard,
  TestType,
  useCreateSieveStandard,
  useCreateShapeFactor,
  useCreateReferenceItem,
  useCreateStrengthStandard,
  useDeleteSieveStandard,
  useDeleteShapeFactor,
  useDeleteStrengthStandard,
  useGetLookups,
  useGetReferenceData,
  useListSieveStandards,
  useListShapeFactors,
  useListStrengthStandards,
  useUpdateSieveStandard,
  useUpdateShapeFactor,
  useUpdateStrengthStandard,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Edit2,
  FileCheck2,
  FlaskConical,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypeaheadInput } from "@/components/ui/typeahead-input";

type AutomatedTestType = "Ready Mix" | "Blocks" | "Paving Blocks";
type SieveTestType = "Sand Sieve" | "Aggregate Sieve";

type ShapeFactorForm = {
  blockSize: string;
  shapeFactor: string;
  correctionFactor: string;
};

type StandardForm = {
  testType: AutomatedTestType;
  material: string;
  blockType: string;
  blockSize: string;
  bsStandard: string;
  requiredStrength: string;
  strengthUnit: string;
};

type SieveCriterion = {
  id?: number;
  sieveSizeReferenceItemId: string;
  minimum: string;
  maximum: string;
  measurementType: "percentage" | "amount";
  unit: string;
};

type SieveForm = {
  testType: SieveTestType;
  materialReferenceItemId: string;
  standardReference: string;
  criteria: SieveCriterion[];
};

const emptyForm: StandardForm = {
  testType: TestType.Ready_Mix,
  material: "",
  blockType: "",
  blockSize: "",
  bsStandard: "",
  requiredStrength: "",
  strengthUnit: "N/mm²",
};

const emptySieveForm: SieveForm = {
  testType: TestType.Sand_Sieve,
  materialReferenceItemId: "",
  standardReference: "",
  criteria: [
    {
      sieveSizeReferenceItemId: "",
      minimum: "",
      maximum: "",
      measurementType: "percentage",
      unit: "%",
    },
  ],
};

const emptyShapeFactorForm: ShapeFactorForm = {
  blockSize: "",
  shapeFactor: "",
  correctionFactor: "",
};

function formFromStandard(standard: StrengthStandard): StandardForm {
  return {
    testType: standard.testType as StandardForm["testType"],
    material: standard.material,
    blockType: standard.blockType ?? "",
    blockSize: standard.blockSize ?? "",
    bsStandard: standard.bsStandard,
    requiredStrength: String(standard.requiredStrength),
    strengthUnit: standard.strengthUnit,
  };
}

function formFromSieveStandards(standards: SieveStandard[]): SieveForm {
  const standard = standards[0];
  return {
    testType: standard.testType as SieveForm["testType"],
    materialReferenceItemId: String(standard.materialReferenceItemId),
    standardReference: standard.standardReference,
    criteria: standards.map((item) => ({
      id: item.id,
      sieveSizeReferenceItemId: String(item.sieveSizeReferenceItemId),
      measurementType: item.measurementType,
      minimum: item.minimum == null ? "" : String(item.minimum),
      maximum: item.maximum == null ? "" : String(item.maximum),
      unit: item.unit,
    })),
  };
}

function formFromShapeFactor(shapeFactor: ShapeFactor): ShapeFactorForm {
  return {
    blockSize: shapeFactor.blockSize,
    shapeFactor:
      shapeFactor.shapeFactor === null ? "" : String(shapeFactor.shapeFactor),
    correctionFactor:
      shapeFactor.correctionFactor === null ? "" : String(shapeFactor.correctionFactor),
  };
}

function StandardEditor({
  form,
  setForm,
  editing,
  onCancel,
  onSave,
  isSaving,
  lookups,
  onCreateReferenceItem,
}: {
  form: StandardForm;
  setForm: (value: StandardForm) => void;
  editing: StrengthStandard | null;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  onCreateReferenceItem: (
    categoryKey: string,
    value: string,
  ) => Promise<string | void>;
  lookups?: {
    materials: string[];
    mixStrengths: string[];
    blockTypes: string[];
    blockSizes: string[];
  };
}) {
  const materialOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(lookups?.materials ?? []),
          ...(form.testType === TestType.Ready_Mix
            ? (lookups?.mixStrengths ?? [])
            : []),
        ]),
      ),
    [form.testType, lookups],
  );

  return (
    <Card className="border-primary/20 bg-card text-foreground shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              {editing ? "Edit strength standard" : "Add strength standard"}
            </CardTitle>
            <CardDescription>
               Set the minimum compressive strength used when Ready Mix, Blocks, or Paving Blocks
              records are checked.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Close editor"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Test Type</Label>
          <Select
            value={form.testType}
            onValueChange={(value: StandardForm["testType"]) =>
              setForm({
                ...form,
                testType: value,
                blockType: "",
                blockSize: "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TestType.Ready_Mix}>Ready Mix</SelectItem>
              <SelectItem value={TestType.Blocks}>Blocks</SelectItem>
                <SelectItem value={TestType.Paving_Blocks}>Paving Blocks</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Material or mix design</Label>
          <TypeaheadInput
            value={form.material}
            onChange={(value) => setForm({ ...form, material: value })}
            options={materialOptions}
            placeholder="Select or type a material..."
            onCreateOption={(value) =>
              onCreateReferenceItem("materials", value)
            }
          />
        </div>
        {(form.testType === TestType.Blocks || form.testType === TestType.Paving_Blocks) && (
          <>
            {form.testType === TestType.Blocks && <div className="space-y-2">
              <Label>Block Type</Label>
              <TypeaheadInput
                value={form.blockType}
                onChange={(value) => setForm({ ...form, blockType: value })}
                options={lookups?.blockTypes ?? []}
                placeholder="Select block type..."
                onCreateOption={(value) =>
                  onCreateReferenceItem("blockTypes", value)
                }
              />
            </div>}
            <div className="space-y-2">
              <Label>Block Size</Label>
              <TypeaheadInput
                value={form.blockSize}
                onChange={(value) => setForm({ ...form, blockSize: value })}
                options={lookups?.blockSizes ?? []}
                placeholder="Select block size..."
                  onCreateOption={(value) => onCreateReferenceItem("blockSizes", value)}
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label>BS standard reference</Label>
          <Input
            value={form.bsStandard}
            onChange={(event) =>
              setForm({ ...form, bsStandard: event.target.value })
            }
            placeholder="For example, BS EN 12390-3:2009"
          />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-2">
            <Label>Minimum strength</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.requiredStrength}
              onChange={(event) =>
                setForm({ ...form, requiredStrength: event.target.value })
              }
              placeholder="For example, 30"
            />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Input
              value={form.strengthUnit}
              onChange={(event) =>
                setForm({ ...form, strengthUnit: event.target.value })
              }
              placeholder="N/mm²"
            />
          </div>
        </div>
        <div className="flex items-end justify-end gap-2 md:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            <Check className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Standard"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SieveEditor({
  form,
  setForm,
  editing,
  onCancel,
  onSave,
  isSaving,
  materialItems,
  sieveItems,
}: {
  form: SieveForm;
  setForm: (value: SieveForm) => void;
  editing: SieveStandard[] | null;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  materialItems: { id: number; value: string }[];
  sieveItems: { id: number; value: string }[];
}) {
  const updateCriterion = (index: number, patch: Partial<SieveCriterion>) => {
    setForm({
      ...form,
      criteria: form.criteria.map((criterion, criterionIndex) =>
        criterionIndex === index ? { ...criterion, ...patch } : criterion,
      ),
    });
  };
  const addCriterion = () => {
    setForm({
      ...form,
      criteria: [
        ...form.criteria,
        {
          sieveSizeReferenceItemId: "",
          minimum: "",
          maximum: "",
          measurementType: form.criteria[0]?.measurementType ?? "percentage",
          unit:
            form.criteria[0]?.measurementType === "amount"
              ? form.criteria[0].unit
              : "%",
        },
      ],
    });
  };
  const removeCriterion = (index: number) => {
    if (form.criteria.length === 1) return;
    setForm({
      ...form,
      criteria: form.criteria.filter(
        (_, criterionIndex) => criterionIndex !== index,
      ),
    });
  };
  return (
    <Card className="border-primary/20 bg-card text-foreground shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              {editing ? "Edit sieve standard" : "Add sieve standard"}
            </CardTitle>
            <CardDescription>
              Add each sieve or pore-size limit that belongs to this material
              and reference.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Close editor"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Test Type</Label>
            <Select
              value={form.testType}
              onValueChange={(value: SieveTestType) =>
                setForm({ ...form, testType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TestType.Sand_Sieve}>Sand Sieve</SelectItem>
                <SelectItem value={TestType.Aggregate_Sieve}>
                  Aggregate Sieve
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Material from Reference Data</Label>
            <Select
              value={form.materialReferenceItemId}
              onValueChange={(value) =>
                setForm({ ...form, materialReferenceItemId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select material..." />
              </SelectTrigger>
              <SelectContent>
                {materialItems.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>BS / Project Reference</Label>
            <Input
              value={form.standardReference}
              onChange={(event) =>
                setForm({ ...form, standardReference: event.target.value })
              }
              placeholder="e.g. BS 812-103.1"
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/20">
          <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                Acceptance limits
              </h3>
              <p className="text-xs text-muted-foreground">
                Add one row for each sieve or pore size in this standard.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addCriterion}>
              <Plus className="mr-2 h-4 w-4" /> Add another limit
            </Button>
          </div>
          <div className="space-y-3 p-4">
            {form.criteria.map((criterion, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-end gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[1.35fr_1.15fr_1fr_1fr_110px_40px]"
              >
                <div className="space-y-2">
                  <Label>Sieve or pore size {index + 1}</Label>
                  <Select
                    value={criterion.sieveSizeReferenceItemId}
                    onValueChange={(value) =>
                      updateCriterion(index, {
                        sieveSizeReferenceItemId: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sieveItems.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Limit type</Label>
                  <Select
                    value={criterion.measurementType}
                    onValueChange={(value: SieveCriterion["measurementType"]) =>
                      updateCriterion(index, {
                        measurementType: value,
                        unit:
                          value === "percentage"
                            ? "%"
                            : criterion.unit === "%"
                              ? "g"
                              : criterion.unit,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        Percentage passing
                      </SelectItem>
                      <SelectItem value="amount">Amount passing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minimum</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={criterion.minimum}
                    onChange={(event) =>
                      updateCriterion(index, { minimum: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={criterion.maximum}
                    onChange={(event) =>
                      updateCriterion(index, { maximum: event.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input
                    value={
                      criterion.measurementType === "percentage"
                        ? "%"
                        : criterion.unit
                    }
                    disabled={criterion.measurementType === "percentage"}
                    onChange={(event) =>
                      updateCriterion(index, { unit: event.target.value })
                    }
                    placeholder="g"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => removeCriterion(index)}
                  disabled={form.criteria.length === 1}
                  aria-label={`Remove pore size ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 md:col-span-2">
          <p className="max-w-xl text-xs text-muted-foreground">
            Add at least one limit for every size. Limits are inclusive, so a
            result on the boundary passes.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={isSaving}>
              <Check className="mr-2 h-4 w-4" />
              {isSaving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Add Standard"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type StrengthFolderKey = "readyMix" | "blocks" | "paving";

function StrengthStandardsFolder({
  label,
  standards,
  expanded,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  label: string;
  standards: StrengthStandard[];
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (standard: StrengthStandard) => void;
  onDelete: (standard: StrengthStandard) => void;
}) {
  return (
    <Card className="border-border shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex min-w-0 items-center gap-3">
          {expanded ? (
            <FolderOpen className="h-5 w-5 shrink-0 text-foreground" />
          ) : (
            <Folder className="h-5 w-5 shrink-0 text-foreground" />
          )}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {label}
            </span>
            <span className="block text-xs text-muted-foreground">
              {standards.length}{" "}
              {standards.length === 1 ? "standard" : "standards"}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border">
          {standards.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-xs sm:text-sm">
                <thead className="bg-muted/40 text-left text-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-3 font-semibold">Test Type</th>
                    <th className="px-4 py-3 font-semibold">Material / Mix</th>
                    <th className="px-4 py-3 font-semibold">Block Type</th>
                    <th className="px-4 py-3 font-semibold">Block Size</th>
                    <th className="px-4 py-3 font-semibold">BS Standard</th>
                    <th className="px-4 py-3 font-semibold">Minimum</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standards.map((standard) => (
                    <tr key={standard.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">
                        {standard.testType}
                      </td>
                      <td className="px-4 py-3">{standard.material}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {standard.blockType || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {standard.blockSize || "—"}
                      </td>
                      <td className="px-4 py-3">{standard.bsStandard}</td>
                      <td className="px-4 py-3 font-semibold">
                        {standard.requiredStrength} {standard.strengthUnit}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(standard)}
                            aria-label={`Edit ${standard.bsStandard}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => onDelete(standard)}
                            aria-label={`Delete ${standard.bsStandard}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <Folder className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                No standards in this folder yet.
              </p>
              <Button variant="outline" size="sm" onClick={onAdd}>
                <Plus className="mr-2 h-4 w-4" /> Add standard
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ShapeFactorsFolder({
  shapeFactors,
  canEdit,
  expanded,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  shapeFactors: ShapeFactor[];
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (shapeFactor: ShapeFactor) => void;
  onDelete: (shapeFactor: ShapeFactor) => void;
}) {
  return (
    <Card className="border-border shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex min-w-0 items-center gap-3">
          {expanded ? (
            <FolderOpen className="h-5 w-5 shrink-0 text-foreground" />
          ) : (
            <Folder className="h-5 w-5 shrink-0 text-foreground" />
          )}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              Block shape factors
            </span>
            <span className="block text-xs text-muted-foreground">
              {shapeFactors.length} {shapeFactors.length === 1 ? "block size" : "block sizes"}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs sm:text-sm">
              <thead className="bg-muted/40 text-left text-foreground">
                <tr className="border-b">
                  <th className="px-4 py-3 font-semibold">Block Size</th>
                  <th className="px-4 py-3 font-semibold">Default Shape Factor</th>
                  <th className="px-4 py-3 font-semibold">Paving Correction Factor</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shapeFactors.map((shapeFactor) => (
                  <tr key={shapeFactor.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{shapeFactor.blockSize}</td>
                    <td className="px-4 py-3 font-semibold">
                      {shapeFactor.shapeFactor === null ? "Not configured" : shapeFactor.shapeFactor}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {shapeFactor.correctionFactor === null ? "Not configured" : shapeFactor.correctionFactor}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(shapeFactor)}
                            aria-label={`Edit shape factor for ${shapeFactor.blockSize}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => onDelete(shapeFactor)}
                            aria-label={`Delete shape factor for ${shapeFactor.blockSize}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!shapeFactors.length && (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <Folder className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                No block shape factors configured yet.
              </p>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={onAdd}>
                  <Plus className="mr-2 h-4 w-4" /> Add shape factor
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ShapeFactorEditor({
  form,
  setForm,
  editing,
  onCancel,
  onSave,
  isSaving,
  blockSizes,
}: {
  form: ShapeFactorForm;
  setForm: (value: ShapeFactorForm) => void;
  editing: ShapeFactor | null;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  blockSizes: string[];
}) {
  return (
    <Card className="border-primary/20 bg-card text-foreground shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{editing ? "Edit shape factor" : "Add shape factor"}</CardTitle>
            <CardDescription>
               Set the default used for Block entries and the Paving correction factor for this size. Existing records with a saved value are not changed.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close shape factor editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Block Size</Label>
          <TypeaheadInput
            value={form.blockSize}
            onChange={(value) => setForm({ ...form, blockSize: value })}
            options={blockSizes}
            placeholder="Select or type a block size..."
          />
        </div>
        <div className="space-y-2">
          <Label>Default Shape Factor</Label>
          <Input
            type="number"
            min="0"
            step="0.001"
            value={form.shapeFactor}
            onChange={(event) => setForm({ ...form, shapeFactor: event.target.value })}
            placeholder="Leave blank until configured"
          />
        </div>
        <div className="space-y-2">
          <Label>Paving Correction Factor</Label>
          <Input
            type="number"
            min="0"
            step="0.001"
            value={form.correctionFactor}
            onChange={(event) => setForm({ ...form, correctionFactor: event.target.value })}
            placeholder="0.87 for 60 mm, 1.00 for 80 mm"
          />
        </div>
        <div className="flex items-end justify-end gap-2 md:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            <Check className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Shape Factor"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Standards() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const canEditStandards = role === "administrator";
  const {
    data: strengthStandards,
    isLoading: strengthLoading,
    isError: strengthError,
    refetch: refetchStrength,
  } = useListStrengthStandards();
  const {
    data: sieveStandards,
    isLoading: sieveLoading,
    isError: sieveError,
    refetch: refetchSieve,
  } = useListSieveStandards();
  const {
    data: shapeFactors,
    isLoading: shapeFactorLoading,
    isError: shapeFactorError,
    refetch: refetchShapeFactors,
  } = useListShapeFactors();
  const { data: lookups } = useGetLookups();
  const { data: referenceData } = useGetReferenceData();
  const createStandard = useCreateStrengthStandard();
  const updateStandard = useUpdateStrengthStandard();
  const deleteStandard = useDeleteStrengthStandard();
  const createSieveStandard = useCreateSieveStandard();
  const createReferenceItem = useCreateReferenceItem();
  const updateSieveStandard = useUpdateSieveStandard();
  const deleteSieveStandard = useDeleteSieveStandard();
  const createShapeFactor = useCreateShapeFactor();
  const updateShapeFactor = useUpdateShapeFactor();
  const deleteShapeFactor = useDeleteShapeFactor();
  const [editorOpen, setEditorOpen] = useState(false);
  const [sieveEditorOpen, setSieveEditorOpen] = useState(false);
  const [shapeFactorEditorOpen, setShapeFactorEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StrengthStandard | null>(null);
  const [editingSieve, setEditingSieve] = useState<SieveStandard[] | null>(
    null,
  );
  const [editingShapeFactor, setEditingShapeFactor] = useState<ShapeFactor | null>(
    null,
  );
  const [form, setForm] = useState<StandardForm>(emptyForm);
  const [sieveForm, setSieveForm] = useState<SieveForm>(emptySieveForm);
  const [shapeFactorForm, setShapeFactorForm] =
    useState<ShapeFactorForm>(emptyShapeFactorForm);
  const [standardView, setStandardView] = useState<"strength" | "sieve" | "shapeFactor">(
    "strength",
  );
  const [expandedStrengthFolders, setExpandedStrengthFolders] = useState<
    Record<StrengthFolderKey, boolean>
  >({ readyMix: false, blocks: false, paving: false });
  const [shapeFactorsExpanded, setShapeFactorsExpanded] = useState(true);

  const materialItems = useMemo(
    () =>
      referenceData?.categories.find((category) => category.key === "materials")
        ?.items ?? [],
    [referenceData],
  );
  const sieveItems = useMemo(
    () =>
      referenceData?.categories.find(
        (category) => category.key === "sieveSizes",
      )?.items ?? [],
    [referenceData],
  );
  const sieveGroups = useMemo(() => {
    const groups = new Map<string, SieveStandard[]>();
    for (const standard of sieveStandards ?? []) {
      const key = [
        standard.testType,
        standard.materialReferenceItemId,
        standard.standardReference,
      ].join("|");
      groups.set(key, [...(groups.get(key) ?? []), standard]);
    }
    return Array.from(groups.values()).map((standards) => ({
      standards,
      representative: standards[0],
    }));
  }, [sieveStandards]);
  const strengthFolders = useMemo(
    () => [
      {
        key: "readyMix" as const,
        label: "Ready Mix standards",
        standards:
          strengthStandards?.filter(
            (standard) => standard.testType === TestType.Ready_Mix,
          ) ?? [],
      },
      {
        key: "blocks" as const,
        label: "Blocks standards",
        standards:
          strengthStandards?.filter(
            (standard) => standard.testType === TestType.Blocks,
          ) ?? [],
      },
      {
        key: "paving" as const,
        label: "Paving Blocks standards",
        standards:
          strengthStandards?.filter(
            (standard) => standard.testType === TestType.Paving_Blocks,
          ) ?? [],
      },
    ],
    [strengthStandards],
  );

  const invalidateStandards = () => {
    queryClient.invalidateQueries({
      queryKey: getListStrengthStandardsQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getListSieveStandardsQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getListShapeFactorsQueryKey(),
    });
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) => {
        const key = queryKey[0];
        return (
          typeof key === "string" &&
          (key === "/api/dashboard" ||
            key === "/api/records" ||
            key.startsWith("/api/records/") ||
            key.startsWith("/api/reports/"))
        );
      },
    });
  };

  const addReferenceDataItem = async (categoryKey: string, value: string) => {
    const category = referenceData?.categories.find(
      (item) => item.key === categoryKey,
    );
    if (!category) {
      toast.error("This Reference Data category is not available.");
      throw new Error(
        `Reference Data category "${categoryKey}" is not available.`,
      );
    }

    try {
      const createdItem = await createReferenceItem.mutateAsync({
        categoryId: category.id,
        data: { value },
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetReferenceDataQueryKey(),
        }),
        queryClient.invalidateQueries({ queryKey: getGetLookupsQueryKey() }),
      ]);
      toast.success(`Added “${createdItem.value}” to Reference Data.`);
      return createdItem.value;
    } catch {
      toast.error("That value could not be added to Reference Data.");
      throw new Error("Reference Data value could not be added.");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setStandardView("strength");
    setEditorOpen(true);
    setSieveEditorOpen(false);
    setShapeFactorEditorOpen(false);
  };

  const openEdit = (standard: StrengthStandard) => {
    setEditing(standard);
    setForm(formFromStandard(standard));
    setStandardView("strength");
    setEditorOpen(true);
    setSieveEditorOpen(false);
    setShapeFactorEditorOpen(false);
  };

  const openSieveCreate = () => {
    setEditingSieve(null);
    setSieveForm(emptySieveForm);
    setStandardView("sieve");
    setSieveEditorOpen(true);
    setEditorOpen(false);
    setShapeFactorEditorOpen(false);
  };

  const openSieveEdit = (standards: SieveStandard[]) => {
    setEditingSieve(standards);
    setSieveForm(formFromSieveStandards(standards));
    setStandardView("sieve");
    setSieveEditorOpen(true);
    setEditorOpen(false);
    setShapeFactorEditorOpen(false);
  };

  const openShapeFactorCreate = () => {
    setEditingShapeFactor(null);
    setShapeFactorForm(emptyShapeFactorForm);
    setStandardView("shapeFactor");
    setShapeFactorEditorOpen(true);
    setEditorOpen(false);
    setSieveEditorOpen(false);
  };

  const openShapeFactorEdit = (shapeFactor: ShapeFactor) => {
    setEditingShapeFactor(shapeFactor);
    setShapeFactorForm(formFromShapeFactor(shapeFactor));
    setStandardView("shapeFactor");
    setShapeFactorEditorOpen(true);
    setEditorOpen(false);
    setSieveEditorOpen(false);
  };

  const handleSave = () => {
    const requiredStrength = Number(form.requiredStrength);
    if (
      !form.material.trim() ||
      !form.bsStandard.trim() ||
      !form.strengthUnit.trim() ||
      !Number.isFinite(requiredStrength) ||
      requiredStrength < 0 ||
      ((form.testType === TestType.Blocks &&
        (!form.blockType.trim() || !form.blockSize.trim())) ||
        (form.testType === TestType.Paving_Blocks && !form.blockSize.trim()))
    ) {
      toast.error("Complete the strength standard fields before saving.");
      return;
    }
    const data = {
      testType: form.testType,
      material: form.material.trim(),
      blockType:
        form.testType === TestType.Blocks ? form.blockType.trim() : null,
      blockSize:
        form.testType === TestType.Blocks || form.testType === TestType.Paving_Blocks
          ? form.blockSize.trim()
          : null,
      bsStandard: form.bsStandard.trim(),
      requiredStrength,
      strengthUnit: form.strengthUnit.trim(),
    };
    const options = {
      onSuccess: () => {
        toast.success(
          editing ? "Strength standard updated." : "Strength standard added.",
        );
        setEditorOpen(false);
        setExpandedStrengthFolders((current) => ({
          ...current,
           [data.testType === TestType.Blocks
             ? "blocks"
             : data.testType === TestType.Paving_Blocks
               ? "paving"
               : "readyMix"]: true,
        }));
        invalidateStandards();
      },
      onError: () => toast.error("Unable to save the strength standard."),
    };
    if (editing) updateStandard.mutate({ id: editing.id, data }, options);
    else createStandard.mutate({ data }, options);
  };

  const handleSaveShapeFactor = () => {
    const shapeFactor =
      shapeFactorForm.shapeFactor.trim() === ""
        ? null
        : Number(shapeFactorForm.shapeFactor);
    const correctionFactor =
      shapeFactorForm.correctionFactor.trim() === ""
        ? null
        : Number(shapeFactorForm.correctionFactor);
    if (
      !shapeFactorForm.blockSize.trim() ||
      (shapeFactor !== null &&
        (!Number.isFinite(shapeFactor) || shapeFactor < 0)) ||
      (correctionFactor !== null &&
        (!Number.isFinite(correctionFactor) || correctionFactor < 0))
    ) {
      toast.error("Enter a block size and a valid shape factor.");
      return;
    }
    const data = {
      blockSize: shapeFactorForm.blockSize.trim(),
      shapeFactor,
      correctionFactor,
    };
    const options = {
      onSuccess: () => {
        toast.success(
          editingShapeFactor
            ? "Shape factor updated."
            : "Shape factor added.",
        );
        setShapeFactorEditorOpen(false);
        setShapeFactorsExpanded(true);
        invalidateStandards();
      },
      onError: () => toast.error("Unable to save the shape factor."),
    };
    if (editingShapeFactor) {
      updateShapeFactor.mutate({ id: editingShapeFactor.id, data }, options);
    } else {
      createShapeFactor.mutate({ data }, options);
    }
  };

  const handleSaveSieve = () => {
    const invalidCriterion = sieveForm.criteria.some((criterion) => {
      const minimum =
        criterion.minimum.trim() === "" ? null : Number(criterion.minimum);
      const maximum =
        criterion.maximum.trim() === "" ? null : Number(criterion.maximum);
      return (
        !criterion.sieveSizeReferenceItemId ||
        (minimum === null && maximum === null) ||
        (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) ||
        (maximum !== null && (!Number.isFinite(maximum) || maximum < 0)) ||
        (minimum !== null && maximum !== null && minimum > maximum)
      );
    });
    const sizeIds = sieveForm.criteria.map(
      (criterion) => criterion.sieveSizeReferenceItemId,
    );
    if (
      !sieveForm.materialReferenceItemId ||
      !sieveForm.standardReference.trim() ||
      !sieveForm.criteria.length ||
      invalidCriterion ||
      new Set(sizeIds).size !== sizeIds.length
    ) {
      toast.error(
        "Complete every pore-size row and use a valid, non-duplicate limit range.",
      );
      return;
    }
    const materialReferenceItemId = Number(sieveForm.materialReferenceItemId);
    const standardReference = sieveForm.standardReference.trim();
    const dataForCriterion = (criterion: SieveCriterion) => ({
      testType: sieveForm.testType,
      materialReferenceItemId,
      sieveSizeReferenceItemId: Number(criterion.sieveSizeReferenceItemId),
      standardReference,
      measurementType: criterion.measurementType,
      minimum:
        criterion.minimum.trim() === "" ? null : Number(criterion.minimum),
      maximum:
        criterion.maximum.trim() === "" ? null : Number(criterion.maximum),
      unit:
        criterion.measurementType === "percentage"
          ? "%"
          : criterion.unit.trim() || "g",
    });

    const saveSieveCriteria = async () => {
      const existing = editingSieve ?? [];
      const existingById = new Map(
        existing.map((standard) => [standard.id, standard]),
      );
      const retainedIds = new Set<number>();
      for (const criterion of sieveForm.criteria) {
        const data = dataForCriterion(criterion);
        if (criterion.id && existingById.has(criterion.id)) {
          await updateSieveStandard.mutateAsync({ id: criterion.id, data });
          retainedIds.add(criterion.id);
        } else {
          await createSieveStandard.mutateAsync({ data });
        }
      }
      await Promise.all(
        existing
          .filter((standard) => !retainedIds.has(standard.id))
          .map((standard) =>
            deleteSieveStandard.mutateAsync({ id: standard.id }),
          ),
      );
    };

    void saveSieveCriteria()
      .then(() => {
        toast.success(
          editingSieve ? "Sieve standard updated." : "Sieve standard added.",
        );
        setSieveEditorOpen(false);
        invalidateStandards();
      })
      .catch(() => toast.error("Unable to save the sieve standard."));
  };

  const handleDelete = (standard: StrengthStandard) => {
    if (
      !confirm(
        `Delete the ${standard.testType} standard for ${standard.material}?`,
      )
    )
      return;
    deleteStandard.mutate(
      { id: standard.id },
      {
        onSuccess: () => {
          toast.success("Strength standard deleted.");
          invalidateStandards();
        },
        onError: () => toast.error("Unable to delete the strength standard."),
      },
    );
  };

  const handleDeleteSieve = (standards: SieveStandard[]) => {
    const standard = standards[0];
    if (
      !confirm(
        `Delete the ${standard.testType} standard for ${standard.material} with all ${standards.length} pore-size criteria?`,
      )
    )
      return;
    Promise.all(
      standards.map((item) => deleteSieveStandard.mutateAsync({ id: item.id })),
    )
      .then(() => {
        toast.success("Sieve standard deleted.");
        invalidateStandards();
      })
      .catch(() => toast.error("Unable to delete the sieve standard."));
  };

  const handleDeleteShapeFactor = (shapeFactor: ShapeFactor) => {
    if (!confirm(`Delete the shape factor for ${shapeFactor.blockSize}?`)) return;
    deleteShapeFactor.mutate(
      { id: shapeFactor.id },
      {
        onSuccess: () => {
          toast.success("Shape factor deleted.");
          invalidateStandards();
        },
        onError: () => toast.error("Unable to delete the shape factor."),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/"
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
              <FileCheck2 className="h-8 w-8 text-foreground" /> Quality standards
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditStandards &&
            !editorOpen &&
            !sieveEditorOpen &&
            !shapeFactorEditorOpen && (
            <>
              <Button variant="outline" onClick={openShapeFactorCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add shape factor
              </Button>
              <Button variant="outline" onClick={openSieveCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add sieve standard
              </Button>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add strength standard
              </Button>
            </>
          )}
        </div>
      </div>

      {editorOpen && (
        <StandardEditor
          form={form}
          setForm={setForm}
          editing={editing}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSave}
          isSaving={createStandard.isPending || updateStandard.isPending}
          lookups={{
            materials: lookups?.materials ?? [],
            mixStrengths: lookups?.mixStrengths ?? [],
            blockTypes: lookups?.blockTypes ?? [],
            blockSizes: lookups?.blockSizes ?? [],
          }}
          onCreateReferenceItem={addReferenceDataItem}
        />
      )}
      {sieveEditorOpen && (
        <SieveEditor
          form={sieveForm}
          setForm={setSieveForm}
          editing={editingSieve}
          onCancel={() => setSieveEditorOpen(false)}
          onSave={handleSaveSieve}
          isSaving={
            createSieveStandard.isPending || updateSieveStandard.isPending
          }
          materialItems={materialItems}
          sieveItems={sieveItems}
        />
      )}
      {shapeFactorEditorOpen && (
        <ShapeFactorEditor
          form={shapeFactorForm}
          setForm={setShapeFactorForm}
          editing={editingShapeFactor}
          onCancel={() => setShapeFactorEditorOpen(false)}
          onSave={handleSaveShapeFactor}
          isSaving={createShapeFactor.isPending || updateShapeFactor.isPending}
           blockSizes={lookups?.blockSizes ?? []}
        />
      )}

      <div
        role="tablist"
        aria-label="Standard type"
        className="inline-flex rounded-md border border-border bg-muted/40 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={standardView === "strength"}
          onClick={() => setStandardView("strength")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            standardView === "strength"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Strength standards
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({strengthStandards?.length ?? 0})
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={standardView === "sieve"}
          onClick={() => setStandardView("sieve")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            standardView === "sieve"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sieve standards
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({sieveGroups.length})
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={standardView === "shapeFactor"}
          onClick={() => setStandardView("shapeFactor")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            standardView === "shapeFactor"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Shape factors
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({shapeFactors?.length ?? 0})
          </span>
        </button>
      </div>

      <div className={standardView === "strength" ? "space-y-3" : "hidden"}>
        {strengthLoading ? (
          <Card className="border-border shadow-sm">
            <CardContent className="p-12 text-center text-muted-foreground">
              Loading strength standards...
            </CardContent>
          </Card>
        ) : strengthError ? (
          <Card className="border-border shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-destructive">
                Strength standards could not be loaded.
              </p>
              <Button variant="outline" onClick={() => refetchStrength()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          strengthFolders.map((folder) => (
            <StrengthStandardsFolder
              key={folder.key}
              label={folder.label}
              standards={folder.standards}
              expanded={expandedStrengthFolders[folder.key]}
              onToggle={() =>
                setExpandedStrengthFolders((current) => ({
                  ...current,
                  [folder.key]: !current[folder.key],
                }))
              }
               onAdd={() => {
                 if (!canEditStandards) return;
                setStandardView("strength");
                setEditing(null);
                setForm({
                  ...emptyForm,
                  testType:
                     folder.key === "blocks"
                       ? TestType.Blocks
                       : folder.key === "paving"
                         ? TestType.Paving_Blocks
                         : TestType.Ready_Mix,
                });
                setEditorOpen(true);
                setSieveEditorOpen(false);
              }}
               onEdit={canEditStandards ? openEdit : () => undefined}
               onDelete={canEditStandards ? handleDelete : () => undefined}
            />
          ))
        )}
      </div>

      <div className={standardView === "shapeFactor" ? "space-y-3" : "hidden"}>
        {shapeFactorLoading ? (
          <Card className="border-border shadow-sm">
            <CardContent className="p-12 text-center text-muted-foreground">
              Loading shape factors...
            </CardContent>
          </Card>
        ) : shapeFactorError ? (
          <Card className="border-border shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-destructive">
                Shape factors could not be loaded.
              </p>
              <Button variant="outline" onClick={() => refetchShapeFactors()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ShapeFactorsFolder
            shapeFactors={shapeFactors ?? []}
            canEdit={canEditStandards}
            expanded={shapeFactorsExpanded}
            onToggle={() => setShapeFactorsExpanded((current) => !current)}
            onAdd={openShapeFactorCreate}
            onEdit={canEditStandards ? openShapeFactorEdit : () => undefined}
            onDelete={
              canEditStandards ? handleDeleteShapeFactor : () => undefined
            }
          />
        )}
      </div>

      <Card
        className={`border-border shadow-sm ${
          standardView === "sieve" ? "" : "hidden"
        }`}
      >
        <CardHeader className="border-b border-border/70 bg-muted/40">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-card p-2 text-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-foreground">Sieve standards</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sieveLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              Loading sieve standards...
            </div>
          ) : sieveError ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-destructive">
                Sieve standards could not be loaded.
              </p>
              <Button variant="outline" onClick={() => refetchSieve()}>
                Try Again
              </Button>
            </div>
          ) : sieveGroups.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs sm:text-sm">
                <thead className="bg-muted/40 text-left text-foreground">
                  <tr className="border-y">
                    <th className="px-4 py-3 font-semibold">Test Type</th>
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">
                      Sieve / Pore Size
                    </th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Acceptance</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sieveGroups.map(({ standards, representative }) => (
                    <tr
                      key={`${representative.testType}-${representative.materialReferenceItemId}-${representative.standardReference}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {representative.testType}
                      </td>
                      <td className="px-4 py-3">
                        {representative.material || "Missing reference value"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {standards.map((standard) => (
                            <span
                              key={standard.id}
                              className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                            >
                              {standard.sieveSize || "Missing size"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {representative.standardReference}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <div className="space-y-1">
                          {standards.map((standard) => (
                            <div key={standard.id}>
                              {standard.sieveSize}:{" "}
                              {standard.minimum == null
                                ? "—"
                                : standard.minimum}
                              {" to "}
                              {standard.maximum == null
                                ? "—"
                                : standard.maximum}{" "}
                              {standard.unit}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                           {canEditStandards && <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openSieveEdit(standards)}
                            aria-label={`Edit ${representative.standardReference}`}
                          >
                            <Edit2 className="h-4 w-4" />
                           </Button>}
                           {canEditStandards && <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDeleteSieve(standards)}
                            aria-label={`Delete ${representative.standardReference}`}
                          >
                            <Trash2 className="h-4 w-4" />
                           </Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FlaskConical className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <h3 className="font-semibold">No sieve standards configured</h3>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                  Add sieve sizes in Reference Data first, then configure the
                  accepted passing range for each material.
                </p>
              </div>
               {canEditStandards && <Button onClick={openSieveCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add first sieve standard
               </Button>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

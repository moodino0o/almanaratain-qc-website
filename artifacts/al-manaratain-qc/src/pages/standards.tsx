import { useMemo, useState, type ReactNode } from "react";
import {
  getListSieveStandardsQueryKey,
  getListShapeFactorsQueryKey,
  getListStrengthStandardsQueryKey,
  getListWaterStandardsQueryKey,
  getGetLookupsQueryKey,
  getGetReferenceDataQueryKey,
  SieveStandard,
  ShapeFactor,
  StrengthStandard,
  WaterStandard,
  TestType,
  useCreateSieveStandard,
  useCreateShapeFactor,
  useCreateReferenceItem,
  useCreateStrengthStandard,
  useCreateWaterStandard,
  useDeleteSieveStandard,
  useDeleteShapeFactor,
  useDeleteStrengthStandard,
  useDeleteWaterStandard,
  useGetLookups,
  useGetReferenceData,
  useListSieveStandards,
  useListShapeFactors,
  useListStrengthStandards,
  useListWaterStandards,
  useUpdateSieveStandard,
  useUpdateShapeFactor,
  useUpdateStrengthStandard,
  useUpdateWaterStandard,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  ArrowLeft,
  ArrowRight,
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
import { useAppBack } from "@/hooks/use-app-back";
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
import {
  BLOCK_RECORD_MATERIAL,
  blockSizeMatches,
  blockTypeMatches,
  isSandwichBlockType,
  PRECAST_AGE_STRENGTH_CRITERIA,
} from "./record-form-utils";

type AutomatedTestType = "Ready Mix" | "Blocks" | "Paving Blocks" | "Precast" | "Kerb Stone";
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
  cubeAge: string;
  kerbClass: string;
  kerbMarking: string;
  minimumIndividualStrength: string;
  waterAbsorptionLimit: string;
  bsStandard: string;
  requiredStrength: string;
  dammamAverageStrength: string;
  dammamMinimumStrength: string;
  strengthUnit: string;
};

type WaterLimitForm = {
  name: string;
  phMin: string;
  phMax: string;
  chlorideMin: string;
  chlorideMax: string;
  tdsMin: string;
  tdsMax: string;
  so3Min: string;
  so3Max: string;
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
  cubeAge: "",
  kerbClass: "",
  kerbMarking: "",
  minimumIndividualStrength: "",
  waterAbsorptionLimit: "",
  bsStandard: "",
  requiredStrength: "",
  dammamAverageStrength: "",
  dammamMinimumStrength: "",
  strengthUnit: "N/mm²",
};

function defaultDammamCriteria(blockType: string) {
  return isSandwichBlockType(blockType)
    ? { dammamAverageStrength: "4.14", dammamMinimumStrength: "" }
    : { dammamAverageStrength: "13.8", dammamMinimumStrength: "12.4" };
}

const emptyWaterForm: WaterLimitForm = {
  name: "Water Quality Limits",
  phMin: "4.5",
  phMax: "8",
  chlorideMin: "0",
  chlorideMax: "350",
  tdsMin: "0",
  tdsMax: "2000",
  so3Min: "0",
  so3Max: "1000",
};

const waterFormFromStandard = (standard: WaterStandard): WaterLimitForm => ({
  name: standard.name,
  phMin: String(standard.phMin),
  phMax: String(standard.phMax),
  chlorideMin: String(standard.chlorideMin),
  chlorideMax: String(standard.chlorideMax),
  tdsMin: String(standard.tdsMin),
  tdsMax: String(standard.tdsMax),
  so3Min: String(standard.so3Min),
  so3Max: String(standard.so3Max),
});

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
    cubeAge: standard.cubeAge == null ? "" : String(standard.cubeAge),
    kerbClass: standard.kerbClass == null ? "" : String(standard.kerbClass),
    kerbMarking: standard.kerbMarking ?? "",
    minimumIndividualStrength: standard.minimumIndividualStrength == null
      ? ""
      : String(standard.minimumIndividualStrength),
    waterAbsorptionLimit: standard.waterAbsorptionLimit == null
      ? ""
      : String(standard.waterAbsorptionLimit),
    bsStandard: standard.bsStandard,
    requiredStrength: String(standard.requiredStrength),
    dammamAverageStrength: String(
      standard.dammamAverageStrength ??
        Number(defaultDammamCriteria(standard.blockType ?? "").dammamAverageStrength),
    ),
    dammamMinimumStrength:
      standard.dammamMinimumStrength == null
        ? defaultDammamCriteria(standard.blockType ?? "").dammamMinimumStrength
        : String(standard.dammamMinimumStrength),
    strengthUnit: standard.strengthUnit,
  };
}

function strengthStandardApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error) || error.name !== "ApiError") return fallback;

  const apiError = error as Error & { status?: unknown; data?: unknown };
  if (
    typeof apiError.status !== "number" ||
    apiError.status < 400 ||
    apiError.status >= 600 ||
    !apiError.data ||
    typeof apiError.data !== "object"
  ) {
    return fallback;
  }

  const message = (apiError.data as Record<string, unknown>).error;
  if (typeof message !== "string") return fallback;

  const safeMessage = message
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!safeMessage) return fallback;
  return safeMessage.length > 200
    ? `${safeMessage.slice(0, 199)}…`
    : safeMessage;
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
    precastTypes: string[];
  };
}) {
  const materialOptions = useMemo(
    () => form.testType === TestType.Precast
      ? [...(lookups?.precastTypes ?? [])]
      : Array.from(
        new Set([
          ...(lookups?.materials ?? []),
          ...(form.testType === TestType.Ready_Mix
            ? (lookups?.mixStrengths ?? [])
            : []),
          ...(form.testType === TestType.Paving_Blocks
            ? (lookups?.blockTypes ?? [])
            : []),
          ...(form.testType === TestType.Kerb_Stone ? ["Kerbstone"] : []),
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
              Set the standard limits for the selected product. Dammam Block limits are configured separately below.
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
                material:
                  value === TestType.Blocks
                    ? BLOCK_RECORD_MATERIAL
                    : value === TestType.Kerb_Stone
                      ? "Kerbstone"
                    : form.testType === TestType.Blocks || value !== form.testType
                      ? ""
                      : form.material,
                blockType: "",
                blockSize: "",
                cubeAge: "",
                kerbClass: "",
                kerbMarking: "",
                minimumIndividualStrength: "",
                waterAbsorptionLimit: value === TestType.Kerb_Stone ? "6.5" : "",
                bsStandard: value === TestType.Kerb_Stone
                  ? "BS EN 1340 : 2003"
                  : form.testType === TestType.Kerb_Stone
                    ? ""
                    : form.bsStandard,
                strengthUnit: value === TestType.Kerb_Stone
                  ? "MPa"
                  : form.testType === TestType.Kerb_Stone
                    ? "N/mm²"
                    : form.strengthUnit,
                dammamAverageStrength:
                  value === TestType.Blocks
                    ? defaultDammamCriteria("").dammamAverageStrength
                    : "",
                dammamMinimumStrength:
                  value === TestType.Blocks
                    ? defaultDammamCriteria("").dammamMinimumStrength
                    : "",
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
              <SelectItem value={TestType.Precast}>Precast</SelectItem>
              <SelectItem value={TestType.Kerb_Stone}>Kerb Stone</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.testType !== TestType.Blocks && (
          <div className="space-y-2">
            <Label>
              {form.testType === TestType.Paving_Blocks
                ? "Block Type"
                : form.testType === TestType.Precast
                  ? "Precast type"
                  : "Material or mix design"}
            </Label>
            {form.testType === TestType.Kerb_Stone ? (
              <Input value="Kerbstone" readOnly />
            ) : <TypeaheadInput
              value={form.material}
              onChange={(value) => setForm({ ...form, material: value })}
              options={materialOptions}
              placeholder={
                form.testType === TestType.Paving_Blocks
                  ? "Select or type a Block Type..."
                  : form.testType === TestType.Precast
                    ? "Select or type a Precast type..."
                    : "Select or type a material..."
              }
              onCreateOption={(value) =>
                onCreateReferenceItem(
                  form.testType === TestType.Paving_Blocks
                    ? "blockTypes"
                    : form.testType === TestType.Precast
                      ? "precastTypes"
                      : "materials",
                  value,
                )
              }
            />}
          </div>
        )}
        {form.testType === TestType.Kerb_Stone && (
          <>
            <div className="space-y-2">
              <Label>Kerb Type</Label>
              <Select
                value={form.blockType}
                onValueChange={(value) => setForm({ ...form, blockType: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select kerb type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Road kerb">Road kerb</SelectItem>
                  <SelectItem value="Edge kerb">Edge kerb</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kerb Size</Label>
              <Input
                value={form.blockSize}
                onChange={(event) => setForm({ ...form, blockSize: event.target.value })}
                placeholder="Enter kerb dimensions"
              />
            </div>
          </>
        )}
        {form.testType === TestType.Precast && (
          <div className="space-y-2">
            <Label>Cube age</Label>
            <Select
              value={form.cubeAge}
              onValueChange={(cubeAge) => setForm({ ...form, cubeAge })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select age..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="28">28 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {(form.testType === TestType.Blocks || form.testType === TestType.Paving_Blocks) && (
          <>
        {form.testType === TestType.Blocks && <div className="space-y-2">
              <Label>Block Type</Label>
              <TypeaheadInput
                value={form.blockType}
                onChange={(value) =>
                  setForm({
                    ...form,
                    blockType: value,
                    ...defaultDammamCriteria(value),
                  })
                }
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
            <Label>{form.testType === TestType.Blocks ? "Standard reference (display only)" : "BS standard reference"}</Label>
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
            <Label>
              {form.testType === TestType.Kerb_Stone
                ? "Characteristic bending strength"
                : form.testType === TestType.Blocks
                ? "Other-plant minimum average"
                : form.testType === TestType.Precast
                  ? "Minimum average"
                  : "Minimum strength"}
            </Label>
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
        {form.testType === TestType.Kerb_Stone && (
          <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-3 md:col-span-2">
            <div className="space-y-2">
              <Label>Class</Label>
              <Input type="number" min="1" step="1" value={form.kerbClass}
                onChange={(event) => setForm({ ...form, kerbClass: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Marking</Label>
              <Input value={form.kerbMarking}
                onChange={(event) => setForm({ ...form, kerbMarking: event.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label>Minimum individual strength (MPa)</Label>
              <Input type="number" min="0" step="0.1" value={form.minimumIndividualStrength}
                onChange={(event) => setForm({ ...form, minimumIndividualStrength: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Maximum water absorption (%)</Label>
              <Input type="number" min="0" step="0.01" value={form.waterAbsorptionLimit}
                onChange={(event) => setForm({ ...form, waterAbsorptionLimit: event.target.value })} />
            </div>
          </div>
        )}
        {form.testType === TestType.Blocks && (
          <div className="space-y-3 rounded-md border border-primary/20 bg-primary/[0.03] p-4 md:col-span-2">
            <div>
              <h3 className="font-semibold">Dammam-only strength limits</h3>
              <p className="text-sm text-muted-foreground">
                These fields control Dammam Block pass/fail. The standard reference and other-plant minimum above do not set Dammam limits.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Minimum average {isSandwichBlockType(form.blockType) ? "Air-dry" : "Net"} Strength (N/mm²)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.dammamAverageStrength}
                  onChange={(event) =>
                    setForm({ ...form, dammamAverageStrength: event.target.value })
                  }
                  placeholder={isSandwichBlockType(form.blockType) ? "4.14" : "13.8"}
                />
              </div>
              {!isSandwichBlockType(form.blockType) && (
                <div className="space-y-2">
                  <Label>Minimum specimen Net Strength (N/mm²)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.dammamMinimumStrength}
                    onChange={(event) =>
                      setForm({ ...form, dammamMinimumStrength: event.target.value })
                    }
                    placeholder="12.4"
                  />
                </div>
              )}
            </div>
          </div>
        )}
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

function WaterStandardEditor({
  form,
  setForm,
  editing,
  onCancel,
  onSave,
  isSaving,
}: {
  form: WaterLimitForm;
  setForm: (value: WaterLimitForm) => void;
  editing: WaterStandard | null;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const fields: Array<{
    label: string;
    min: Exclude<keyof WaterLimitForm, "name">;
    max: Exclude<keyof WaterLimitForm, "name">;
  }> = [
    { label: "pH", min: "phMin", max: "phMax" },
    { label: "Chloride (Cl)", min: "chlorideMin", max: "chlorideMax" },
    { label: "TDS", min: "tdsMin", max: "tdsMax" },
    { label: "SO3", min: "so3Min", max: "so3Max" },
  ];
  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{editing ? "Edit Water limits" : "Add Water limit profile"}</CardTitle>
            <CardDescription>
              Define inclusive minimum and maximum results. Records can link to a profile when entered.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-2">
          <Label>Profile name</Label>
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Water Quality Limits"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="rounded-lg border p-3">
              <Label className="mb-3 block">{field.label}</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`water-${field.min}`} className="text-xs text-muted-foreground">Minimum</Label>
                  <Input
                    id={`water-${field.min}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form[field.min]}
                    onChange={(event) => setForm({ ...form, [field.min]: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`water-${field.max}`} className="text-xs text-muted-foreground">Maximum</Label>
                  <Input
                    id={`water-${field.max}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form[field.max]}
                    onChange={(event) => setForm({ ...form, [field.max]: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            <Check className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Profile"}
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

type StrengthFolderKey = "readyMix" | "blocks" | "paving" | "precast" | "kerbstone";

function StrengthStandardsFolder({
  label,
  standards,
  isPrecast = false,
  expanded,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  label: string;
  standards: StrengthStandard[];
  isPrecast?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (standard: StrengthStandard) => void;
  onDelete: (standard: StrengthStandard) => void;
}) {
  const isBlocks = standards[0]?.testType === TestType.Blocks;
  const isKerbStone = standards[0]?.testType === TestType.Kerb_Stone;
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
              <table className="w-full min-w-[980px] text-xs sm:text-sm">
                <thead className="bg-muted/40 text-left text-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-3 font-semibold">Test Type</th>
                    <th className="px-4 py-3 font-semibold">{isPrecast ? "Precast Type" : "Material / Mix"}</th>
                    <th className={`px-4 py-3 font-semibold ${isPrecast ? "" : "hidden"}`}>Cube Age</th>
                    <th className={`px-4 py-3 font-semibold ${isPrecast ? "hidden" : ""}`}>{isKerbStone ? "Kerb Type" : "Block Type"}</th>
                    <th className={`px-4 py-3 font-semibold ${isPrecast ? "hidden" : ""}`}>{isKerbStone ? "Kerb Size" : "Block Size"}</th>
                    {isKerbStone && <><th className="px-4 py-3 font-semibold">Class</th><th className="px-4 py-3 font-semibold">Marking</th></>}
                    <th className="px-4 py-3 font-semibold">{isBlocks ? "Reference (not Dammam limit)" : isKerbStone ? "Strength type" : "BS Standard"}</th>
                    <th className="px-4 py-3 font-semibold">
                      {isBlocks ? "Other-plant minimum average" : isPrecast ? "Minimum average" : isKerbStone ? "Characteristic bending" : "Minimum"}
                    </th>
                    {isKerbStone && <th className="px-4 py-3 font-semibold">Minimum individual</th>}
                    {isBlocks && <th className="px-4 py-3 font-semibold">Dammam limits</th>}
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
                      <td className={`px-4 py-3 text-muted-foreground ${isPrecast ? "" : "hidden"}`}>
                        {standard.cubeAge
                          ? `${standard.cubeAge} day${standard.cubeAge === 1 ? "" : "s"}`
                          : "—"}
                      </td>
                      <td className={`px-4 py-3 text-muted-foreground ${isPrecast ? "hidden" : ""}`}>
                        {standard.blockType || "—"}
                      </td>
                      <td className={`px-4 py-3 text-muted-foreground ${isPrecast ? "hidden" : ""}`}>
                        {standard.blockSize || "—"}
                      </td>
                      {isKerbStone && <>
                        <td className="px-4 py-3">{standard.kerbClass == null ? "—" : `Class ${standard.kerbClass}`}</td>
                        <td className="px-4 py-3">{standard.kerbMarking || "—"}</td>
                      </>}
                      <td className="px-4 py-3">{standard.bsStandard}</td>
                      <td className="px-4 py-3 font-semibold">
                        {standard.requiredStrength} {standard.strengthUnit}
                      </td>
                      {isKerbStone && <td className="px-4 py-3 font-semibold">
                        {standard.minimumIndividualStrength == null ? "—" : `${standard.minimumIndividualStrength} ${standard.strengthUnit}`}
                      </td>}
                      {isKerbStone && <td className="px-4 py-3 font-semibold">
                        {standard.waterAbsorptionLimit == null ? "—" : `< ${standard.waterAbsorptionLimit}%`}
                      </td>}
                      {isBlocks && (
                        <td className="px-4 py-3">
                          {isSandwichBlockType(standard.blockType)
                            ? `Average Air-dry ≥ ${standard.dammamAverageStrength ?? "—"} ${standard.strengthUnit}`
                            : `Average Net ≥ ${standard.dammamAverageStrength ?? "—"} ${standard.strengthUnit}; minimum specimen Net ≥ ${standard.dammamMinimumStrength ?? "—"} ${standard.strengthUnit}`}
                        </td>
                      )}
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
          {isKerbStone && (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Reference only: Class 3 · Marking U · characteristic bending strength 6.0 MPa · minimum individual strength 4.8 MPa. No product has been assigned to Class 3.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function PrecastStrengthStandardsFolder({
  expanded,
  onToggle,
  precastTypes,
}: {
  expanded: boolean;
  onToggle: () => void;
  precastTypes: string[];
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
              Precast fallback criteria
            </span>
            <span className="block text-xs text-muted-foreground">
              Used only when no type-specific age standard is configured
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
          <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Fallback criteria for Precast types without configured age rows:
            </span>{" "}
            {precastTypes.length
              ? precastTypes.join(", ")
              : "types configured in Settings."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs sm:text-sm">
              <thead className="bg-muted/40 text-left text-foreground">
                <tr className="border-b">
                  <th className="px-4 py-3 font-semibold">Cube Age</th>
                  <th className="px-4 py-3 font-semibold">Minimum Average Strength</th>
                  <th className="px-4 py-3 font-semibold">When Met</th>
                  <th className="px-4 py-3 font-semibold">When Below Minimum</th>
                </tr>
              </thead>
              <tbody>
                {PRECAST_AGE_STRENGTH_CRITERIA.map((criterion) => (
                  <tr key={criterion.age} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{criterion.age} day{criterion.age === 1 ? "" : "s"}</td>
                    <td className="px-4 py-3 font-semibold">
                      ≥ {criterion.minimumStrength} N/mm²
                    </td>
                    <td className="px-4 py-3">{criterion.passOutcome}</td>
                    <td className="px-4 py-3">{criterion.failOutcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function BlockStandardAssignmentFlow({
  standards,
  blockTypes,
  blockSizes,
  onCreateReferenceItem,
  onCreateBlockStandard,
  onLinkStandard,
  isLinking,
  typeSelector,
}: {
  standards: StrengthStandard[];
  blockTypes: string[];
  blockSizes: string[];
  onCreateReferenceItem: (
    categoryKey: string,
    value: string,
  ) => Promise<string | void>;
  onCreateBlockStandard: (blockType: string, blockSize: string) => void;
  onLinkStandard: (
    standard: StrengthStandard,
    blockType: string,
    blockSize: string,
  ) => void;
  isLinking: boolean;
  typeSelector: ReactNode;
}) {
  const [blockTypeInput, setBlockTypeInput] = useState("");
  const [blockSizeInput, setBlockSizeInput] = useState("");
  const [manualStandardId, setManualStandardId] = useState("");
  const blockStandards = useMemo(
    () => standards.filter((standard) => standard.testType === TestType.Blocks),
    [standards],
  );
  const blockTypeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...blockTypes,
          ...blockStandards.map((standard) => standard.blockType ?? ""),
        ]),
      ).filter(Boolean),
    [blockStandards, blockTypes],
  );
  const blockSizeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...blockSizes,
          ...blockStandards.map((standard) => standard.blockSize ?? ""),
        ]),
      ).filter(Boolean),
    [blockStandards, blockSizes],
  );
  const blockType = blockTypeInput || blockTypeOptions[0] || "";
  const blockSize = blockSizeInput || blockSizeOptions[0] || "";
  const automaticMatches = useMemo(
    () =>
      blockStandards
        .filter(
          (standard) =>
            blockTypeMatches(standard.blockType, blockType) &&
            blockSizeMatches(standard.blockSize, blockSize),
        )
        .sort((left, right) => left.id - right.id),
    [blockSize, blockStandards, blockType],
  );
  const manualStandard =
    blockStandards.find(
      (standard) => String(standard.id) === manualStandardId,
    ) ?? blockStandards[0];
  const manualStandardAlreadyLinked =
    Boolean(manualStandard) &&
    blockTypeMatches(manualStandard?.blockType, blockType) &&
    blockSizeMatches(manualStandard?.blockSize, blockSize);

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Product Type → Standard Flow</CardTitle>
            <CardDescription>
              Choose a product type and link its standard to the specific product. Matching records
              use it automatically, or users can choose another matching standard manually.
            </CardDescription>
          </div>
          {typeSelector}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1.25fr]">
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1 · Block Type
            </span>
            <TypeaheadInput
              value={blockType}
              onChange={setBlockTypeInput}
              options={blockTypeOptions}
              placeholder="Select or type a Block Type"
              onCreateOption={(value) => onCreateReferenceItem("blockTypes", value)}
            />
          </div>
          <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground md:block" aria-hidden="true" />
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2 · Block Size
            </span>
            <TypeaheadInput
              value={blockSize}
              onChange={setBlockSizeInput}
              options={blockSizeOptions}
              placeholder="Select or type a Block Size"
              onCreateOption={(value) => onCreateReferenceItem("blockSizes", value)}
            />
          </div>
          <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground md:block" aria-hidden="true" />
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              3 · Automatic Match
            </span>
            {automaticMatches[0] ? (
              <div className="text-sm">
                <p className="font-semibold">{automaticMatches[0].bsStandard}</p>
                <p className="text-muted-foreground">
                  {automaticMatches[0].requiredStrength} {automaticMatches[0].strengthUnit}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No standard is linked yet.</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Automatic
              </span>
              <span className="text-sm font-semibold">Match by Block Type + Size</span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Assigning these values to a standard makes it available for automatic record evaluation.
            </p>
            {automaticMatches.length > 1 && (
              <p className="mb-3 text-xs text-amber-700">
                {automaticMatches.length} standards match this type and size. Automatic matching uses
                the first listed; users can choose another match in the Block record.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!blockType || !blockSize}
              onClick={() => onCreateBlockStandard(blockType, blockSize)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add a standard for this type and size
            </Button>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                Manual link
              </span>
              <span className="text-sm font-semibold">Choose the standard to link</span>
            </div>
            {blockStandards.length ? (
              <>
                <select
                  aria-label="Strength standard to link to this Block Type and Size"
                  value={manualStandard ? String(manualStandard.id) : ""}
                  onChange={(event) => setManualStandardId(event.target.value)}
                  className="mb-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {blockStandards.map((standard) => (
                    <option key={standard.id} value={standard.id}>
                      {standard.bsStandard} — {standard.requiredStrength} {standard.strengthUnit}
                      {standard.blockType && standard.blockSize
                        ? ` · ${standard.blockType} · ${standard.blockSize}`
                        : ""}
                    </option>
                  ))}
                </select>
                {manualStandard && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!blockType || !blockSize || manualStandardAlreadyLinked || isLinking}
                    onClick={() => onLinkStandard(manualStandard, blockType, blockSize)}
                  >
                    {isLinking
                      ? "Linking..."
                      : manualStandardAlreadyLinked
                        ? "Already linked"
                        : `Link to ${blockType} · ${blockSize}`}
                  </Button>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  This changes the selected standard’s Block Type and Size. A user can still choose
                  among matching standards manually when entering a Block record.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a Block standard first, then link it to a type and size.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ProductStrengthTestType =
  | typeof TestType.Ready_Mix
  | typeof TestType.Paving_Blocks
  | typeof TestType.Precast;

function ProductStrengthStandardAssignmentFlow({
  testType,
  standards,
  productOptions,
  blockSizes,
  onCreateReferenceItem,
  onCreateStandard,
  onLinkStandard,
  isLinking,
  typeSelector,
}: {
  testType: ProductStrengthTestType;
  standards: StrengthStandard[];
  productOptions: string[];
  blockSizes: string[];
  onCreateReferenceItem: (
    categoryKey: string,
    value: string,
  ) => Promise<string | void>;
  onCreateStandard: (product: string, blockSize: string) => void;
  onLinkStandard: (
    standard: StrengthStandard,
    product: string,
    blockSize: string,
  ) => void;
  isLinking: boolean;
  typeSelector: ReactNode;
}) {
  const isPaving = testType === TestType.Paving_Blocks;
  const isPrecast = testType === TestType.Precast;
  const [productInput, setProductInput] = useState("");
  const [blockSizeInput, setBlockSizeInput] = useState("");
  const [manualStandardId, setManualStandardId] = useState("");
  const productStandards = useMemo(
    () => standards.filter((standard) => standard.testType === testType),
    [standards, testType],
  );
  const availableProducts = useMemo(
    () =>
      Array.from(
        new Set([
          ...productOptions,
          ...productStandards.map((standard) => standard.material),
        ]),
      ).filter(Boolean),
    [productOptions, productStandards],
  );
  const availableBlockSizes = useMemo(
    () =>
      Array.from(
        new Set([
          ...blockSizes,
          ...productStandards.map((standard) => standard.blockSize ?? ""),
        ]),
      ).filter(Boolean),
    [blockSizes, productStandards],
  );
  const product = productInput || availableProducts[0] || "";
  const blockSize = isPaving
    ? blockSizeInput || availableBlockSizes[0] || ""
    : "";
  const matchingStandards = useMemo(
    () =>
      productStandards
        .filter(
          (standard) =>
            standard.material.trim().toLocaleLowerCase() ===
              product.trim().toLocaleLowerCase() &&
            (!isPaving ||
              !standard.blockSize ||
              blockSizeMatches(standard.blockSize, blockSize)),
        )
        .sort((left, right) => left.id - right.id),
    [blockSize, isPaving, product, productStandards],
  );
  const manualStandard =
    productStandards.find(
      (standard) => String(standard.id) === manualStandardId,
    ) ?? productStandards[0];
  const manualStandardAlreadyLinked =
    Boolean(manualStandard) &&
    manualStandard?.material.trim().toLocaleLowerCase() ===
      product.trim().toLocaleLowerCase() &&
    (!isPaving || blockSizeMatches(manualStandard?.blockSize, blockSize));
  const productLabel = isPaving
    ? "Block Type"
    : isPrecast
      ? "Precast Type"
      : "Mix design";
  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-muted/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Product Type → Standard Flow</CardTitle>
            <CardDescription>
              Choose a product type and link its standard to the specific product. Matching records
              use it automatically, or users can choose another matching standard manually.
            </CardDescription>
          </div>
          {typeSelector}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div
          className={`grid items-center gap-3 ${
            isPaving
              ? "md:grid-cols-[1fr_auto_1fr_auto_1.25fr]"
              : "md:grid-cols-[1fr_auto_1fr_auto_1.25fr]"
          }`}
        >
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1 · {productLabel}
            </span>
            <TypeaheadInput
              value={product}
              onChange={setProductInput}
              options={availableProducts}
              placeholder={`Select or type a ${productLabel}`}
              onCreateOption={(value) =>
                onCreateReferenceItem(
                  isPaving
                    ? "blockTypes"
                    : isPrecast
                      ? "precastTypes"
                      : "materials",
                  value,
                )
              }
            />
          </div>
          {isPaving && (
            <>
              <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground md:block" aria-hidden="true" />
              <div className="space-y-2 rounded-lg border bg-background p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  2 · Block Size
                </span>
                <TypeaheadInput
                  value={blockSize}
                  onChange={setBlockSizeInput}
                  options={availableBlockSizes}
                  placeholder="Select or type a Block Size"
                  onCreateOption={(value) =>
                    onCreateReferenceItem("blockSizes", value)
                  }
                />
              </div>
            </>
          )}
          <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground md:block" aria-hidden="true" />
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isPaving ? "3" : "2"} · Automatic Match
            </span>
            {matchingStandards[0] ? (
              <div className="text-sm">
                <p className="font-semibold">{matchingStandards[0].bsStandard}</p>
                <p className="text-muted-foreground">
                  {matchingStandards[0].requiredStrength} {matchingStandards[0].strengthUnit}
                  {isPaving && matchingStandards[0].blockSize
                    ? ` · ${matchingStandards[0].blockSize}`
                    : ""}
                  {isPrecast && matchingStandards[0].cubeAge
                    ? ` · ${matchingStandards[0].cubeAge} day${matchingStandards[0].cubeAge === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No standard is linked yet.</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Automatic
              </span>
              <span className="text-sm font-semibold">Match by {productLabel}{isPaving ? " + Size" : ""}</span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Add a new product-specific standard without changing the existing standards.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!product || (isPaving && !blockSize)}
              onClick={() => onCreateStandard(product, blockSize)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add a standard for this product
            </Button>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                Manual link
              </span>
              <span className="text-sm font-semibold">Choose the standard to link</span>
            </div>
            {productStandards.length ? (
              <>
                <select
                  aria-label={`Strength standard to link to this ${productLabel}`}
                  value={manualStandard ? String(manualStandard.id) : ""}
                  onChange={(event) => setManualStandardId(event.target.value)}
                  className="mb-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {productStandards.map((standard) => (
                    <option key={standard.id} value={standard.id}>
                      {standard.bsStandard} — {standard.requiredStrength} {standard.strengthUnit}
                      {isPrecast && standard.cubeAge
                        ? ` · ${standard.cubeAge} day${standard.cubeAge === 1 ? "" : "s"}`
                        : ""}
                      {` · ${standard.material}`}
                      {isPaving ? ` · ${standard.blockSize || "All sizes"}` : ""}
                    </option>
                  ))}
                </select>
                {manualStandard && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !product ||
                      (isPaving && !blockSize) ||
                      manualStandardAlreadyLinked ||
                      isLinking
                    }
                    onClick={() =>
                      onLinkStandard(manualStandard, product, blockSize)
                    }
                  >
                    {isLinking
                      ? "Linking..."
                      : manualStandardAlreadyLinked
                        ? "Already linked"
                        : `Link to ${product}${isPaving ? ` · ${blockSize}` : ""}`}
                  </Button>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Linking updates the selected standard’s product assignment; its reference and strength stay unchanged.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a {isPaving ? "Paving Blocks" : "Ready Mix"} standard first, then link it to a product.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type StrengthAssignmentTestType =
  | ProductStrengthTestType
  | typeof TestType.Blocks;

function StrengthStandardAssignmentFlow({
  standards,
  blockTypes,
  blockSizes,
  materials,
  mixStrengths,
  precastTypes,
  onCreateReferenceItem,
  onCreateBlockStandard,
  onLinkBlockStandard,
  onCreateProductStandard,
  onLinkProductStandard,
  isLinking,
}: {
  standards: StrengthStandard[];
  blockTypes: string[];
  blockSizes: string[];
  materials: string[];
  mixStrengths: string[];
  precastTypes: string[];
  onCreateReferenceItem: (
    categoryKey: string,
    value: string,
  ) => Promise<string | void>;
  onCreateBlockStandard: (blockType: string, blockSize: string) => void;
  onLinkBlockStandard: (
    standard: StrengthStandard,
    blockType: string,
    blockSize: string,
  ) => void;
  onCreateProductStandard: (
    testType: ProductStrengthTestType,
    product: string,
    blockSize: string,
  ) => void;
  onLinkProductStandard: (
    standard: StrengthStandard,
    testType: ProductStrengthTestType,
    product: string,
    blockSize: string,
  ) => void;
  isLinking: boolean;
}) {
  const [testType, setTestType] = useState<StrengthAssignmentTestType>(
    TestType.Blocks,
  );
  const typeSelector = (
    <div className="w-full space-y-1.5 sm:w-56">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Product Type
      </span>
      <Select
        value={testType}
        onValueChange={(value: StrengthAssignmentTestType) =>
          setTestType(value)
        }
      >
        <SelectTrigger aria-label="Product type for standard assignment">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TestType.Ready_Mix}>Ready Mix</SelectItem>
          <SelectItem value={TestType.Blocks}>Blocks</SelectItem>
          <SelectItem value={TestType.Paving_Blocks}>Paving Blocks</SelectItem>
          <SelectItem value={TestType.Precast}>Precast</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (testType === TestType.Blocks) {
    return (
      <BlockStandardAssignmentFlow
        standards={standards}
        blockTypes={blockTypes}
        blockSizes={blockSizes}
        onCreateReferenceItem={onCreateReferenceItem}
        onCreateBlockStandard={onCreateBlockStandard}
        onLinkStandard={onLinkBlockStandard}
        isLinking={isLinking}
        typeSelector={typeSelector}
      />
    );
  }

  return (
    <ProductStrengthStandardAssignmentFlow
      testType={testType}
      standards={standards}
      productOptions={
        testType === TestType.Ready_Mix
          ? [...materials, ...mixStrengths]
          : testType === TestType.Paving_Blocks
            ? blockTypes
            : precastTypes
      }
      blockSizes={blockSizes}
      onCreateReferenceItem={onCreateReferenceItem}
      onCreateStandard={(product, blockSize) =>
        onCreateProductStandard(testType, product, blockSize)
      }
      onLinkStandard={(standard, product, blockSize) =>
        onLinkProductStandard(standard, testType, product, blockSize)
      }
      isLinking={isLinking}
      typeSelector={typeSelector}
    />
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
  const goBack = useAppBack("/");
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
    data: waterStandards,
    isLoading: waterLoading,
    isError: waterError,
    refetch: refetchWaterStandards,
  } = useListWaterStandards();
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
  const createWaterStandard = useCreateWaterStandard();
  const updateWaterStandard = useUpdateWaterStandard();
  const deleteWaterStandard = useDeleteWaterStandard();
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
  const [waterEditorOpen, setWaterEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StrengthStandard | null>(null);
  const [editingSieve, setEditingSieve] = useState<SieveStandard[] | null>(
    null,
  );
  const [editingShapeFactor, setEditingShapeFactor] = useState<ShapeFactor | null>(
    null,
  );
  const [editingWaterStandard, setEditingWaterStandard] = useState<WaterStandard | null>(null);
  const [form, setForm] = useState<StandardForm>(emptyForm);
  const [sieveForm, setSieveForm] = useState<SieveForm>(emptySieveForm);
  const [shapeFactorForm, setShapeFactorForm] =
    useState<ShapeFactorForm>(emptyShapeFactorForm);
  const [waterForm, setWaterForm] = useState<WaterLimitForm>(emptyWaterForm);
  const [standardView, setStandardView] = useState<"strength" | "sieve" | "shapeFactor" | "water">(
    "strength",
  );
  const [expandedStrengthFolders, setExpandedStrengthFolders] = useState<
    Record<StrengthFolderKey, boolean>
  >({ readyMix: false, blocks: false, paving: false, precast: true, kerbstone: true });
  const [shapeFactorsExpanded, setShapeFactorsExpanded] = useState(true);

  const materialItems = useMemo(
    () =>
      referenceData?.categories.find((category) => category.key === "materials")
        ?.items ?? [],
    [referenceData],
  );
  const precastTypes = useMemo(
    () =>
      referenceData?.categories
        .find((category) => category.key === "precastTypes")
        ?.items.map((item) => item.value) ?? [],
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
      {
        key: "precast" as const,
        label: "Precast standards by type",
        standards:
          strengthStandards?.filter(
            (standard) => standard.testType === TestType.Precast,
          ) ?? [],
      },
      {
        key: "kerbstone" as const,
        label: "Kerbstone standards",
        standards:
          strengthStandards?.filter(
            (standard) => standard.testType === TestType.Kerb_Stone,
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
      queryKey: getListWaterStandardsQueryKey(),
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
        queryClient.invalidateQueries({
          queryKey: getListStrengthStandardsQueryKey(),
        }),
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

  const openCreateBlockStandardFor = (blockType: string, blockSize: string) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      testType: TestType.Blocks,
      material: BLOCK_RECORD_MATERIAL,
      blockType,
      blockSize,
      ...defaultDammamCriteria(blockType),
    });
    setStandardView("strength");
    setEditorOpen(true);
    setSieveEditorOpen(false);
    setShapeFactorEditorOpen(false);
  };

  const openCreateProductStandardFor = (
    testType: ProductStrengthTestType,
    product: string,
    blockSize: string,
  ) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      testType,
      material: product,
      blockSize: testType === TestType.Paving_Blocks ? blockSize : "",
      cubeAge: testType === TestType.Precast ? "1" : "",
    });
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

  const openWaterCreate = () => {
    setEditingWaterStandard(null);
    setWaterForm(emptyWaterForm);
    setStandardView("water");
    setWaterEditorOpen(true);
    setEditorOpen(false);
    setSieveEditorOpen(false);
    setShapeFactorEditorOpen(false);
  };

  const openWaterEdit = (standard: WaterStandard) => {
    setEditingWaterStandard(standard);
    setWaterForm(waterFormFromStandard(standard));
    setStandardView("water");
    setWaterEditorOpen(true);
    setEditorOpen(false);
    setSieveEditorOpen(false);
    setShapeFactorEditorOpen(false);
  };

  const handleSaveWaterStandard = () => {
    const numberFields = [
      "phMin",
      "phMax",
      "chlorideMin",
      "chlorideMax",
      "tdsMin",
      "tdsMax",
      "so3Min",
      "so3Max",
    ] as const;
    const numbers = Object.fromEntries(
      numberFields.map((key) => [key, Number(waterForm[key])]),
    ) as Record<(typeof numberFields)[number], number>;
    const allValid = numberFields.every(
      (key) => waterForm[key].trim() !== "" && Number.isFinite(numbers[key]) && numbers[key] >= 0,
    );
    const rangesValid = [
      ["phMin", "phMax"],
      ["chlorideMin", "chlorideMax"],
      ["tdsMin", "tdsMax"],
      ["so3Min", "so3Max"],
    ].every(([minimum, maximum]) =>
      numbers[minimum as keyof typeof numbers] <= numbers[maximum as keyof typeof numbers],
    );
    if (!waterForm.name.trim() || !allValid || !rangesValid) {
      toast.error("Enter a profile name and valid minimum/maximum limits.");
      return;
    }
    const data = { name: waterForm.name.trim(), ...numbers };
    const options = {
      onSuccess: () => {
        toast.success(
          editingWaterStandard
            ? "Water limits updated."
            : "Water limit profile added.",
        );
        setWaterEditorOpen(false);
        invalidateStandards();
      },
      onError: () => toast.error("Unable to save the Water limit profile."),
    };
    if (editingWaterStandard) {
      updateWaterStandard.mutate(
        { id: editingWaterStandard.id, data },
        options,
      );
    } else {
      createWaterStandard.mutate({ data }, options);
    }
  };

  const handleDeleteWaterStandard = async (standard: WaterStandard) => {
    if (standard.isDefault) return;
    if (!confirm(`Delete the Water limit profile "${standard.name}"?`)) return;
    try {
      await deleteWaterStandard.mutateAsync({ id: standard.id });
      toast.success("Water limit profile deleted.");
      invalidateStandards();
    } catch {
      toast.error("Unable to delete this profile. It may be linked to Water records.");
    }
  };

  const handleSave = () => {
    const requiredStrength = Number(form.requiredStrength);
    const dammamAverageStrength = Number(form.dammamAverageStrength);
    const dammamMinimumStrength = Number(form.dammamMinimumStrength);
    const kerbClass = Number(form.kerbClass);
    const minimumIndividualStrength = Number(form.minimumIndividualStrength);
    const waterAbsorptionLimit = Number(form.waterAbsorptionLimit);
    const isDammamSandwichStandard =
      form.testType === TestType.Blocks && isSandwichBlockType(form.blockType);
    if (
      (form.testType !== TestType.Blocks && !form.material.trim()) ||
      !form.bsStandard.trim() ||
      !form.strengthUnit.trim() ||
      !Number.isFinite(requiredStrength) ||
      requiredStrength < 0 ||
      (form.testType === TestType.Precast &&
        !["1", "7", "28"].includes(form.cubeAge)) ||
      ((form.testType === TestType.Blocks &&
        (!form.blockType.trim() || !form.blockSize.trim())) ||
        (form.testType === TestType.Paving_Blocks && !form.blockSize.trim()) ||
        (form.testType === TestType.Kerb_Stone &&
          (!form.blockType.trim() ||
            !form.blockSize.trim() ||
            !Number.isInteger(kerbClass) ||
            kerbClass < 1 ||
            !form.kerbMarking.trim() ||
            form.minimumIndividualStrength.trim() === "" ||
            !Number.isFinite(minimumIndividualStrength) ||
             minimumIndividualStrength < 0 ||
             form.waterAbsorptionLimit.trim() === "" ||
             !Number.isFinite(waterAbsorptionLimit) ||
             waterAbsorptionLimit < 0))) ||
      (form.testType === TestType.Blocks &&
        (form.dammamAverageStrength.trim() === "" ||
          !Number.isFinite(dammamAverageStrength) ||
          dammamAverageStrength < 0 ||
          (!isDammamSandwichStandard &&
            (form.dammamMinimumStrength.trim() === "" ||
              !Number.isFinite(dammamMinimumStrength) ||
              dammamMinimumStrength < 0))))
    ) {
      toast.error("Complete the strength standard fields before saving.");
      return;
    }
    const data = {
      testType: form.testType,
      material:
        form.testType === TestType.Blocks
          ? BLOCK_RECORD_MATERIAL
          : form.testType === TestType.Kerb_Stone
            ? "Kerbstone"
          : form.material.trim(),
      blockType:
        form.testType === TestType.Blocks || form.testType === TestType.Kerb_Stone
          ? form.blockType.trim()
          : null,
      blockSize:
        form.testType === TestType.Blocks ||
        form.testType === TestType.Paving_Blocks ||
        form.testType === TestType.Kerb_Stone
          ? form.blockSize.trim()
          : null,
      cubeAge:
        form.testType === TestType.Precast
          ? (Number(form.cubeAge) as 1 | 7 | 28)
          : null,
      kerbClass:
        form.testType === TestType.Kerb_Stone ? kerbClass : null,
      kerbMarking:
        form.testType === TestType.Kerb_Stone ? form.kerbMarking.trim().toUpperCase() : null,
      bsStandard: form.bsStandard.trim(),
      requiredStrength,
      minimumIndividualStrength:
        form.testType === TestType.Kerb_Stone ? minimumIndividualStrength : null,
      waterAbsorptionLimit:
        form.testType === TestType.Kerb_Stone ? waterAbsorptionLimit : null,
      dammamAverageStrength:
        form.testType === TestType.Blocks ? dammamAverageStrength : null,
      dammamMinimumStrength:
        form.testType === TestType.Blocks && !isDammamSandwichStandard
          ? dammamMinimumStrength
          : null,
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
           [data.testType === TestType.Kerb_Stone
             ? "kerbStone"
             : data.testType === TestType.Blocks
               ? "blocks"
               : data.testType === TestType.Paving_Blocks
                 ? "paving"
                 : data.testType === TestType.Precast
                   ? "precast"
                   : "readyMix"]: true,
        }));
        invalidateStandards();
      },
      onError: (error: unknown) =>
        toast.error(
          strengthStandardApiErrorMessage(
            error,
            "Unable to save the strength standard.",
          ),
        ),
    };
    if (editing) updateStandard.mutate({ id: editing.id, data }, options);
    else createStandard.mutate({ data }, options);
  };

  const handleLinkBlockStandard = async (
    standard: StrengthStandard,
    blockType: string,
    blockSize: string,
  ) => {
    const targetIsSandwich = isSandwichBlockType(blockType);
    const sourceIsSandwich = isSandwichBlockType(standard.blockType);
    const defaultCriteria = defaultDammamCriteria(blockType);
    const changedBlockFamily = targetIsSandwich !== sourceIsSandwich;
    const alreadyLinked =
      blockTypeMatches(standard.blockType, blockType) &&
      blockSizeMatches(standard.blockSize, blockSize);
    if (alreadyLinked) return;
    const hasPreviousLink = Boolean(standard.blockType || standard.blockSize);
    if (
      hasPreviousLink &&
      !confirm(
        `Move ${standard.bsStandard} from ${standard.blockType || "an unset Block Type"} / ${standard.blockSize || "an unset Block Size"} to ${blockType} / ${blockSize}?`,
      )
    ) {
      return;
    }
    try {
      await updateStandard.mutateAsync({
        id: standard.id,
        data: {
          testType: TestType.Blocks,
          material: standard.material || BLOCK_RECORD_MATERIAL,
          blockType,
          blockSize,
          bsStandard: standard.bsStandard,
          requiredStrength: standard.requiredStrength,
          dammamAverageStrength:
            !changedBlockFamily && standard.dammamAverageStrength !== null
              ? standard.dammamAverageStrength
              : Number(defaultCriteria.dammamAverageStrength),
          dammamMinimumStrength: targetIsSandwich
            ? null
            : !changedBlockFamily && standard.dammamMinimumStrength !== null
              ? standard.dammamMinimumStrength
              : Number(defaultCriteria.dammamMinimumStrength),
          strengthUnit: standard.strengthUnit,
        },
      });
      toast.success(`${standard.bsStandard} linked to ${blockType} / ${blockSize}.`);
      setExpandedStrengthFolders((current) => ({ ...current, blocks: true }));
      invalidateStandards();
    } catch (error) {
      toast.error(
        strengthStandardApiErrorMessage(
          error,
          "Unable to link the Block standard.",
        ),
      );
    }
  };

  const handleLinkProductStandard = async (
    standard: StrengthStandard,
    testType: ProductStrengthTestType,
    product: string,
    blockSize: string,
  ) => {
    const sameProduct =
      standard.material.trim().toLocaleLowerCase() ===
        product.trim().toLocaleLowerCase() &&
      (testType !== TestType.Paving_Blocks ||
        blockSizeMatches(standard.blockSize, blockSize));
    if (sameProduct) return;

    const currentProduct = testType === TestType.Paving_Blocks
      ? `${standard.material} / ${standard.blockSize || "all sizes"}`
      : standard.material;
    const nextProduct = testType === TestType.Paving_Blocks
      ? `${product} / ${blockSize}`
      : product;
    if (
      (standard.material.trim() || standard.blockSize?.trim()) &&
      !confirm(
        `Move ${standard.bsStandard} from ${currentProduct} to ${nextProduct}?`,
      )
    ) {
      return;
    }

    try {
      await updateStandard.mutateAsync({
        id: standard.id,
        data: {
          testType,
          material: product,
          blockType: null,
          blockSize: testType === TestType.Paving_Blocks ? blockSize : null,
          cubeAge:
            testType === TestType.Precast
              ? (standard.cubeAge as 1 | 7 | 28)
              : null,
          bsStandard: standard.bsStandard,
          requiredStrength: standard.requiredStrength,
          strengthUnit: standard.strengthUnit,
        },
      });
      toast.success(`${standard.bsStandard} linked to ${nextProduct}.`);
      setExpandedStrengthFolders((current) => ({
        ...current,
        [testType === TestType.Ready_Mix
          ? "readyMix"
          : testType === TestType.Paving_Blocks
            ? "paving"
            : "precast"]: true,
      }));
      invalidateStandards();
    } catch (error) {
      toast.error(
        strengthStandardApiErrorMessage(
          error,
          "Unable to link the strength standard to this product.",
        ),
      );
    }
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
        onError: (error) =>
          toast.error(
            strengthStandardApiErrorMessage(
              error,
              "Unable to delete the strength standard.",
            ),
          ),
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
          <button
            type="button"
            onClick={goBack}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
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
            precastTypes,
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
        <button
          type="button"
          role="tab"
          aria-selected={standardView === "water"}
          onClick={() => setStandardView("water")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            standardView === "water"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Water limits
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({waterStandards?.length ?? 0})
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
          <>
            {canEditStandards && (
              <StrengthStandardAssignmentFlow
                standards={strengthStandards ?? []}
                blockTypes={lookups?.blockTypes ?? []}
                blockSizes={lookups?.blockSizes ?? []}
                materials={lookups?.materials ?? []}
                mixStrengths={lookups?.mixStrengths ?? []}
                precastTypes={precastTypes}
                onCreateReferenceItem={addReferenceDataItem}
                onCreateBlockStandard={openCreateBlockStandardFor}
                onLinkBlockStandard={handleLinkBlockStandard}
                onCreateProductStandard={openCreateProductStandardFor}
                onLinkProductStandard={handleLinkProductStandard}
                isLinking={updateStandard.isPending}
              />
            )}
            {strengthFolders.map((folder) => (
              <StrengthStandardsFolder
                key={folder.key}
                label={folder.label}
                standards={folder.standards}
                isPrecast={folder.key === "precast"}
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
                          : folder.key === "precast"
                            ? TestType.Precast
                            : folder.key === "kerbstone"
                              ? TestType.Kerb_Stone
                            : TestType.Ready_Mix,
                  });
                  setEditorOpen(true);
                  setSieveEditorOpen(false);
                }}
                onEdit={canEditStandards ? openEdit : () => undefined}
                onDelete={canEditStandards ? handleDelete : () => undefined}
              />
            ))}
            {!strengthStandards?.some(
              (standard) => standard.testType === TestType.Precast,
            ) && (
              <PrecastStrengthStandardsFolder
                expanded={expandedStrengthFolders.precast}
                precastTypes={precastTypes}
                onToggle={() =>
                  setExpandedStrengthFolders((current) => ({
                    ...current,
                    precast: !current.precast,
                  }))
                }
              />
            )}
          </>
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

      <div className={standardView === "water" ? "space-y-3" : "hidden"}>
        {waterLoading ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              Loading Water limits...
            </CardContent>
          </Card>
        ) : waterError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-destructive">Water limits could not be loaded.</p>
              <Button variant="outline" onClick={() => refetchWaterStandards()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : waterEditorOpen ? (
          <WaterStandardEditor
            form={waterForm}
            setForm={setWaterForm}
            editing={editingWaterStandard}
            onCancel={() => setWaterEditorOpen(false)}
            onSave={handleSaveWaterStandard}
            isSaving={createWaterStandard.isPending || updateWaterStandard.isPending}
          />
        ) : (
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border/70 bg-muted/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Water limit profiles</CardTitle>
                  <CardDescription>
                    Select a profile when entering a Water record. Values on the limits are inclusive.
                  </CardDescription>
                </div>
                {canEditStandards && (
                  <Button onClick={openWaterCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Water limits
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {waterStandards?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr className="border-b">
                        <th className="px-4 py-3">Profile</th>
                        <th className="px-4 py-3">pH</th>
                        <th className="px-4 py-3">Chloride (Cl)</th>
                        <th className="px-4 py-3">TDS</th>
                        <th className="px-4 py-3">SO3</th>
                        <th className="px-4 py-3">Status</th>
                        {canEditStandards && <th className="px-4 py-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {waterStandards.map((standard) => (
                        <tr key={standard.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">{standard.name}</td>
                          <td className="px-4 py-3">{standard.phMin}–{standard.phMax}</td>
                          <td className="px-4 py-3">{standard.chlorideMin}–{standard.chlorideMax}</td>
                          <td className="px-4 py-3">{standard.tdsMin}–{standard.tdsMax}</td>
                          <td className="px-4 py-3">{standard.so3Min}–{standard.so3Max}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-muted px-2 py-1 text-xs">
                              {standard.isDefault ? "Default" : "Available to link"}
                            </span>
                          </td>
                          {canEditStandards && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openWaterEdit(standard)}
                                  aria-label={`Edit ${standard.name}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleDeleteWaterStandard(standard)}
                                  disabled={standard.isDefault || deleteWaterStandard.isPending}
                                  aria-label={`Delete ${standard.name}`}
                                  title={standard.isDefault ? "The default profile cannot be deleted" : "Delete profile"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No Water limit profiles are configured.
                </p>
              )}
            </CardContent>
          </Card>
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

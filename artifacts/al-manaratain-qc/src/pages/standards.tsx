import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getListSieveStandardsQueryKey,
  getListStrengthStandardsQueryKey,
  SieveStandard,
  StrengthStandard,
  TestType,
  useCreateSieveStandard,
  useCreateStrengthStandard,
  useDeleteSieveStandard,
  useDeleteStrengthStandard,
  useGetLookups,
  useGetReferenceData,
  useListSieveStandards,
  useListStrengthStandards,
  useUpdateSieveStandard,
  useUpdateStrengthStandard,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Edit2, FileCheck2, FlaskConical, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TypeaheadInput } from "@/components/ui/typeahead-input";

type AutomatedTestType = "Ready Mix" | "Blocks";
type SieveTestType = "Sand Sieve" | "Aggregate Sieve";

type StandardForm = {
  testType: AutomatedTestType;
  material: string;
  blockType: string;
  blockSize: string;
  bsStandard: string;
  requiredStrength: string;
  strengthUnit: string;
};

type SieveForm = {
  testType: SieveTestType;
  materialReferenceItemId: string;
  sieveSizeReferenceItemId: string;
  standardReference: string;
  measurementType: "percentage" | "amount";
  minimum: string;
  maximum: string;
  unit: string;
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
  sieveSizeReferenceItemId: "",
  standardReference: "",
  measurementType: "percentage",
  minimum: "",
  maximum: "",
  unit: "%",
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

function formFromSieveStandard(standard: SieveStandard): SieveForm {
  return {
    testType: standard.testType as SieveForm["testType"],
    materialReferenceItemId: String(standard.materialReferenceItemId),
    sieveSizeReferenceItemId: String(standard.sieveSizeReferenceItemId),
    standardReference: standard.standardReference,
    measurementType: standard.measurementType,
    minimum: standard.minimum == null ? "" : String(standard.minimum),
    maximum: standard.maximum == null ? "" : String(standard.maximum),
    unit: standard.unit,
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
}: {
  form: StandardForm;
  setForm: (value: StandardForm) => void;
  editing: StrengthStandard | null;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  lookups?: {
    materials: string[];
    mixStrengths: string[];
    blockTypes: string[];
    blockSizes: string[];
  };
}) {
  const materialOptions = useMemo(
    () => Array.from(new Set([
      ...(lookups?.materials ?? []),
      ...(form.testType === TestType.Ready_Mix ? lookups?.mixStrengths ?? [] : []),
    ])),
    [form.testType, lookups],
  );

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{editing ? "Edit Strength Standard" : "Add Strength Standard"}</CardTitle>
            <CardDescription>
              Configure the minimum compressive strength used when Ready Mix or Blocks records are evaluated.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Test Type</Label>
          <Select
            value={form.testType}
            onValueChange={(value: StandardForm["testType"]) =>
              setForm({ ...form, testType: value, blockType: "", blockSize: "" })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TestType.Ready_Mix}>Ready Mix</SelectItem>
              <SelectItem value={TestType.Blocks}>Blocks</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Material / Mix Design</Label>
          <TypeaheadInput
            value={form.material}
            onChange={(value) => setForm({ ...form, material: value })}
            options={materialOptions}
            placeholder="Select or type material..."
          />
        </div>
        {form.testType === TestType.Blocks && (
          <>
            <div className="space-y-2">
              <Label>Block Type</Label>
              <TypeaheadInput
                value={form.blockType}
                onChange={(value) => setForm({ ...form, blockType: value })}
                options={lookups?.blockTypes ?? []}
                placeholder="Select block type..."
              />
            </div>
            <div className="space-y-2">
              <Label>Block Size</Label>
              <TypeaheadInput
                value={form.blockSize}
                onChange={(value) => setForm({ ...form, blockSize: value })}
                options={lookups?.blockSizes ?? []}
                placeholder="Select block size..."
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label>BS Standard Reference</Label>
          <Input
            value={form.bsStandard}
            onChange={(event) => setForm({ ...form, bsStandard: event.target.value })}
            placeholder="e.g. BS EN 12390-3:2009"
          />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-2">
            <Label>Required Minimum</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.requiredStrength}
              onChange={(event) => setForm({ ...form, requiredStrength: event.target.value })}
              placeholder="e.g. 30"
            />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Input
              value={form.strengthUnit}
              onChange={(event) => setForm({ ...form, strengthUnit: event.target.value })}
              placeholder="N/mm²"
            />
          </div>
        </div>
        <div className="flex items-end justify-end gap-2 md:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
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
  editing: SieveStandard | null;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  materialItems: { id: number; value: string }[];
  sieveItems: { id: number; value: string }[];
}) {
  const selectedUnit = form.measurementType === "percentage" ? "%" : form.unit || "kg";
  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{editing ? "Edit Sieve Standard" : "Add Sieve Standard"}</CardTitle>
            <CardDescription>
              Match a Reference Data material and sieve/pore size to its acceptable passing range.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Test Type</Label>
          <Select
            value={form.testType}
            onValueChange={(value: SieveTestType) => setForm({ ...form, testType: value })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TestType.Sand_Sieve}>Sand Sieve</SelectItem>
              <SelectItem value={TestType.Aggregate_Sieve}>Aggregate Sieve</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Material from Reference Data</Label>
          <Select
            value={form.materialReferenceItemId}
            onValueChange={(value) => setForm({ ...form, materialReferenceItemId: value })}
          >
            <SelectTrigger><SelectValue placeholder="Select material..." /></SelectTrigger>
            <SelectContent>
              {materialItems.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sieve / Pore Size from Reference Data</Label>
          <Select
            value={form.sieveSizeReferenceItemId}
            onValueChange={(value) => setForm({ ...form, sieveSizeReferenceItemId: value })}
          >
            <SelectTrigger><SelectValue placeholder="Select sieve size..." /></SelectTrigger>
            <SelectContent>
              {sieveItems.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>BS / Project Reference</Label>
          <Input
            value={form.standardReference}
            onChange={(event) => setForm({ ...form, standardReference: event.target.value })}
            placeholder="e.g. BS 812-103.1"
          />
        </div>
        <div className="space-y-2">
          <Label>Measured Value</Label>
          <Select
            value={form.measurementType}
            onValueChange={(value: SieveForm["measurementType"]) =>
              setForm({
                ...form,
                measurementType: value,
                unit: value === "percentage" ? "%" : form.unit === "%" ? "kg" : form.unit,
              })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage passing (%)</SelectItem>
              <SelectItem value="amount">Amount passing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[1fr_1fr_110px] gap-3">
          <div className="space-y-2">
            <Label>Minimum</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.minimum}
              onChange={(event) => setForm({ ...form, minimum: event.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={form.maximum}
              onChange={(event) => setForm({ ...form, maximum: event.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Input
              value={selectedUnit}
              disabled={form.measurementType === "percentage"}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
              placeholder="kg"
            />
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 md:col-span-2">
          <p className="text-xs text-muted-foreground">
            Enter at least one limit. Limits are inclusive; a result on the boundary passes.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="button" onClick={onSave} disabled={isSaving}>
              <Check className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : editing ? "Save Changes" : "Add Standard"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Standards() {
  const queryClient = useQueryClient();
  const { data: strengthStandards, isLoading: strengthLoading, isError: strengthError, refetch: refetchStrength } = useListStrengthStandards();
  const { data: sieveStandards, isLoading: sieveLoading, isError: sieveError, refetch: refetchSieve } = useListSieveStandards();
  const { data: lookups } = useGetLookups();
  const { data: referenceData } = useGetReferenceData();
  const createStandard = useCreateStrengthStandard();
  const updateStandard = useUpdateStrengthStandard();
  const deleteStandard = useDeleteStrengthStandard();
  const createSieveStandard = useCreateSieveStandard();
  const updateSieveStandard = useUpdateSieveStandard();
  const deleteSieveStandard = useDeleteSieveStandard();
  const [editorOpen, setEditorOpen] = useState(false);
  const [sieveEditorOpen, setSieveEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StrengthStandard | null>(null);
  const [editingSieve, setEditingSieve] = useState<SieveStandard | null>(null);
  const [form, setForm] = useState<StandardForm>(emptyForm);
  const [sieveForm, setSieveForm] = useState<SieveForm>(emptySieveForm);

  const materialItems = useMemo(
    () => referenceData?.categories.find((category) => category.key === "materials")?.items ?? [],
    [referenceData],
  );
  const sieveItems = useMemo(
    () => referenceData?.categories.find((category) => category.key === "sieveSizes")?.items ?? [],
    [referenceData],
  );

  const invalidateStandards = () => {
    queryClient.invalidateQueries({ queryKey: getListStrengthStandardsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSieveStandardsQueryKey() });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setSieveEditorOpen(false);
  };

  const openEdit = (standard: StrengthStandard) => {
    setEditing(standard);
    setForm(formFromStandard(standard));
    setEditorOpen(true);
    setSieveEditorOpen(false);
  };

  const openSieveCreate = () => {
    setEditingSieve(null);
    setSieveForm(emptySieveForm);
    setSieveEditorOpen(true);
    setEditorOpen(false);
  };

  const openSieveEdit = (standard: SieveStandard) => {
    setEditingSieve(standard);
    setSieveForm(formFromSieveStandard(standard));
    setSieveEditorOpen(true);
    setEditorOpen(false);
  };

  const handleSave = () => {
    const requiredStrength = Number(form.requiredStrength);
    if (
      !form.material.trim() ||
      !form.bsStandard.trim() ||
      !form.strengthUnit.trim() ||
      !Number.isFinite(requiredStrength) ||
      requiredStrength < 0 ||
      (form.testType === TestType.Blocks && (!form.blockType.trim() || !form.blockSize.trim()))
    ) {
      toast.error("Complete the strength standard fields before saving.");
      return;
    }
    const data = {
      testType: form.testType,
      material: form.material.trim(),
      blockType: form.testType === TestType.Blocks ? form.blockType.trim() : null,
      blockSize: form.testType === TestType.Blocks ? form.blockSize.trim() : null,
      bsStandard: form.bsStandard.trim(),
      requiredStrength,
      strengthUnit: form.strengthUnit.trim(),
    };
    const options = {
      onSuccess: () => {
        toast.success(editing ? "Strength standard updated." : "Strength standard added.");
        setEditorOpen(false);
        invalidateStandards();
      },
      onError: () => toast.error("Unable to save the strength standard."),
    };
    if (editing) updateStandard.mutate({ id: editing.id, data }, options);
    else createStandard.mutate({ data }, options);
  };

  const handleSaveSieve = () => {
    const minimum = sieveForm.minimum.trim() === "" ? null : Number(sieveForm.minimum);
    const maximum = sieveForm.maximum.trim() === "" ? null : Number(sieveForm.maximum);
    if (
      !sieveForm.materialReferenceItemId ||
      !sieveForm.sieveSizeReferenceItemId ||
      !sieveForm.standardReference.trim() ||
      (minimum === null && maximum === null) ||
      (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) ||
      (maximum !== null && (!Number.isFinite(maximum) || maximum < 0)) ||
      (minimum !== null && maximum !== null && minimum > maximum)
    ) {
      toast.error("Complete the sieve standard fields and use a valid limit range.");
      return;
    }
    const data = {
      testType: sieveForm.testType,
      materialReferenceItemId: Number(sieveForm.materialReferenceItemId),
      sieveSizeReferenceItemId: Number(sieveForm.sieveSizeReferenceItemId),
      standardReference: sieveForm.standardReference.trim(),
      measurementType: sieveForm.measurementType,
      minimum,
      maximum,
      unit: sieveForm.measurementType === "percentage" ? "%" : sieveForm.unit.trim() || "kg",
    };
    const options = {
      onSuccess: () => {
        toast.success(editingSieve ? "Sieve standard updated." : "Sieve standard added.");
        setSieveEditorOpen(false);
        invalidateStandards();
      },
      onError: () => toast.error("Unable to save the sieve standard."),
    };
    if (editingSieve) updateSieveStandard.mutate({ id: editingSieve.id, data }, options);
    else createSieveStandard.mutate({ data }, options);
  };

  const handleDelete = (standard: StrengthStandard) => {
    if (!confirm(`Delete the ${standard.testType} standard for ${standard.material}?`)) return;
    deleteStandard.mutate({ id: standard.id }, {
      onSuccess: () => {
        toast.success("Strength standard deleted.");
        invalidateStandards();
      },
      onError: () => toast.error("Unable to delete the strength standard."),
    });
  };

  const handleDeleteSieve = (standard: SieveStandard) => {
    if (!confirm(`Delete the ${standard.testType} standard for ${standard.material} at ${standard.sieveSize}?`)) return;
    deleteSieveStandard.mutate({ id: standard.id }, {
      onSuccess: () => {
        toast.success("Sieve standard deleted.");
        invalidateStandards();
      },
      onError: () => toast.error("Unable to delete the sieve standard."),
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/" className="rounded-md p-2 hover:bg-muted" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
              <FileCheck2 className="h-8 w-8 text-primary" /> Quality Standards
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure the acceptance rules used to evaluate QC records automatically.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editorOpen && !sieveEditorOpen && (
            <>
              <Button variant="outline" onClick={openSieveCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add Sieve Standard
              </Button>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add Strength Standard
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
        />
      )}
      {sieveEditorOpen && (
        <SieveEditor
          form={sieveForm}
          setForm={setSieveForm}
          editing={editingSieve}
          onCancel={() => setSieveEditorOpen(false)}
          onSave={handleSaveSieve}
          isSaving={createSieveStandard.isPending || updateSieveStandard.isPending}
          materialItems={materialItems}
          sieveItems={sieveItems}
        />
      )}

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary"><FileCheck2 className="h-5 w-5" /></div>
            <div>
              <CardTitle>Compressive-strength standards</CardTitle>
              <CardDescription>
                Ready Mix and Blocks require a matching configured minimum. Missing configuration produces Review.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {strengthLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading strength standards...</div>
          ) : strengthError ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-destructive">Strength standards could not be loaded.</p>
              <Button variant="outline" onClick={() => refetchStrength()}>Try Again</Button>
            </div>
          ) : strengthStandards?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr className="border-y">
                    <th className="px-4 py-3 font-semibold">Test Type</th>
                    <th className="px-4 py-3 font-semibold">Material / Mix</th>
                    <th className="px-4 py-3 font-semibold">Block Type</th>
                    <th className="px-4 py-3 font-semibold">Block Size</th>
                    <th className="px-4 py-3 font-semibold">BS Standard</th>
                    <th className="px-4 py-3 font-semibold">Minimum</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {strengthStandards.map((standard) => (
                    <tr key={standard.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{standard.testType}</td>
                      <td className="px-4 py-3">{standard.material}</td>
                      <td className="px-4 py-3 text-muted-foreground">{standard.blockType || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{standard.blockSize || "—"}</td>
                      <td className="px-4 py-3">{standard.bsStandard}</td>
                      <td className="px-4 py-3 font-semibold">{standard.requiredStrength} {standard.strengthUnit}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(standard)} aria-label={`Edit ${standard.bsStandard}`}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(standard)} aria-label={`Delete ${standard.bsStandard}`}>
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
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileCheck2 className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <h3 className="font-semibold">No strength standards configured</h3>
                <p className="mt-1 text-sm text-muted-foreground">Add the approved minimums for Ready Mix mixes and block products.</p>
              </div>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add First Strength Standard</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-t-4 border-t-amber-500">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-700"><FlaskConical className="h-5 w-5" /></div>
            <div>
              <CardTitle>Sieve acceptance standards</CardTitle>
              <CardDescription>
                Configure the allowed passing amount or percentage for each material and sieve/pore size. Materials and sizes come from Reference Data.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sieveLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading sieve standards...</div>
          ) : sieveError ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-destructive">Sieve standards could not be loaded.</p>
              <Button variant="outline" onClick={() => refetchSieve()}>Try Again</Button>
            </div>
          ) : sieveStandards?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr className="border-y">
                    <th className="px-4 py-3 font-semibold">Test Type</th>
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">Sieve / Pore Size</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Acceptance</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sieveStandards.map((standard) => (
                    <tr key={standard.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{standard.testType}</td>
                      <td className="px-4 py-3">{standard.material || "Missing reference value"}</td>
                      <td className="px-4 py-3">{standard.sieveSize || "Missing reference value"}</td>
                      <td className="px-4 py-3">{standard.standardReference}</td>
                      <td className="px-4 py-3 font-semibold">
                        {standard.minimum == null ? "—" : standard.minimum}
                        {" to "}
                        {standard.maximum == null ? "—" : standard.maximum} {standard.unit}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openSieveEdit(standard)} aria-label={`Edit ${standard.standardReference}`}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSieve(standard)} aria-label={`Delete ${standard.standardReference}`}>
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
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FlaskConical className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <h3 className="font-semibold">No sieve standards configured</h3>
                <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                  Add sieve sizes in Reference Data first, then configure the accepted passing range for each material.
                </p>
              </div>
              <Button onClick={openSieveCreate}><Plus className="mr-2 h-4 w-4" /> Add First Sieve Standard</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
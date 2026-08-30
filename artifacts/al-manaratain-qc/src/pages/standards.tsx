import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getListStrengthStandardsQueryKey,
  StrengthStandard,
  TestType,
  useCreateStrengthStandard,
  useDeleteStrengthStandard,
  useGetLookups,
  useListStrengthStandards,
  useUpdateStrengthStandard,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Edit2, FileCheck2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TypeaheadInput } from "@/components/ui/typeahead-input";

type AutomatedTestType = "Ready Mix" | "Blocks";

type StandardForm = {
  testType: AutomatedTestType;
  material: string;
  blockType: string;
  blockSize: string;
  bsStandard: string;
  requiredStrength: string;
  strengthUnit: string;
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
    () => Array.from(new Set([...(lookups?.materials ?? []), ...(form.testType === TestType.Ready_Mix ? lookups?.mixStrengths ?? [] : [])])),
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

export default function Standards() {
  const queryClient = useQueryClient();
  const { data: standards, isLoading, isError, refetch } = useListStrengthStandards();
  const { data: lookups } = useGetLookups();
  const createStandard = useCreateStrengthStandard();
  const updateStandard = useUpdateStrengthStandard();
  const deleteStandard = useDeleteStrengthStandard();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StrengthStandard | null>(null);
  const [form, setForm] = useState<StandardForm>(emptyForm);

  const invalidateStandards = () => {
    queryClient.invalidateQueries({ queryKey: getListStrengthStandardsQueryKey() });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (standard: StrengthStandard) => {
    setEditing(standard);
    setForm(formFromStandard(standard));
    setEditorOpen(true);
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
      toast.error("Complete the standard fields before saving.");
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

    if (editing) {
      updateStandard.mutate({ id: editing.id, data }, options);
    } else {
      createStandard.mutate({ data }, options);
    }
  };

  const handleDelete = (standard: StrengthStandard) => {
    if (!confirm(`Delete the ${standard.testType} standard for ${standard.material}?`)) return;
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/" className="rounded-md p-2 hover:bg-muted" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
              <FileCheck2 className="h-8 w-8 text-primary" /> Strength Standards
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Maintain the BS/project minimums used for automatic specimen evaluation.
            </p>
          </div>
        </div>
        {!editorOpen && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Standard
          </Button>
        )}
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

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle>Configured minimums</CardTitle>
          <CardDescription>
            A matching standard is required for an automated Passed or Failed result. Missing configuration produces Review.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading strength standards...</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-sm text-destructive">Strength standards could not be loaded.</p>
              <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
            </div>
          ) : standards?.length ? (
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
                  {standards.map((standard) => (
                    <tr key={standard.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{standard.testType}</td>
                      <td className="px-4 py-3">{standard.material}</td>
                      <td className="px-4 py-3 text-muted-foreground">{standard.blockType || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{standard.blockSize || "—"}</td>
                      <td className="px-4 py-3">{standard.bsStandard}</td>
                      <td className="px-4 py-3 font-semibold">
                        {standard.requiredStrength} {standard.strengthUnit}
                      </td>
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
                <p className="mt-1 text-sm text-muted-foreground">
                  Add the minimums approved for your Ready Mix mixes and block products.
                </p>
              </div>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add First Standard</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

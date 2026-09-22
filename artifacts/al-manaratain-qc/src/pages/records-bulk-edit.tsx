import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  TestType,
  createRecord,
  getListRecordsQueryKey,
  updateRecord,
  useListRecords,
  type QcRecord,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  TableProperties,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkDraftToCreate,
  bulkDraftToUpdate,
  createEmptyBulkDraft,
  detailText,
  recordToBulkDraft,
  updateDraftDetail,
  validateBulkDraft,
  type BulkRecordDraft,
} from "./records-bulk-utils";

const today = () => {
  const value = new Date();
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
};
const cloneDraft = (draft: BulkRecordDraft) => ({
  ...draft,
  details: structuredClone(draft.details),
});
const sameDraft = (left: BulkRecordDraft, right: BulkRecordDraft) =>
  JSON.stringify(left) === JSON.stringify(right);

type DraftKey = "sampleDate" | "location" | "material" | "testedBy" | "remarks";

function CellInput({
  value,
  onChange,
  label,
  type = "text",
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  type?: "text" | "date" | "number";
  placeholder?: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className="block px-2 text-center text-muted-foreground/50">—</span>;
  }
  return (
    <input
      aria-label={label}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 w-full min-w-[110px] rounded-sm border border-transparent bg-transparent px-2 text-sm outline-none transition-colors hover:border-border focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/30"
    />
  );
}

function DraftRow({
  draft,
  dirty,
  isNew,
  onChange,
  onDetailChange,
  onTestTypeChange,
}: {
  draft: BulkRecordDraft;
  dirty: boolean;
  isNew: boolean;
  onChange: (key: DraftKey, value: string) => void;
  onDetailChange: (key: string, value: string) => void;
  onTestTypeChange: (value: BulkRecordDraft["testType"]) => void;
}) {
  const readyMix = draft.testType === TestType.Ready_Mix;
  const blocks = draft.testType === TestType.Blocks;
  const sieve =
    draft.testType === TestType.Sand_Sieve ||
    draft.testType === TestType.Aggregate_Sieve;
  const water = draft.testType === TestType.Water;

  const detailInput = (
    key: string,
    label: string,
    applies: boolean,
    type: "text" | "date" | "number" = "text",
  ) => (
    <CellInput
      value={detailText(draft.details, key)}
      onChange={(value) => onDetailChange(key, value)}
      label={`${label} for ${draft.recordNo}`}
      type={type}
      disabled={!applies}
    />
  );

  return (
    <tr
      className={[
        "border-b transition-colors",
        dirty ? "bg-amber-50/70 dark:bg-amber-950/15" : "bg-card",
        isNew ? "border-l-4 border-l-primary" : "",
      ].join(" ")}
    >
      <td className="sticky left-0 z-10 border-r bg-inherit px-3 py-2 font-semibold text-primary">
        {isNew ? "New record" : draft.recordNo}
      </td>
      <td className="px-1 py-1">
        {isNew ? (
          <select
            aria-label="Test type for new record"
            value={draft.testType}
            onChange={(event) => onTestTypeChange(
              event.target.value as BulkRecordDraft["testType"],
            )}
            className="h-9 min-w-[150px] rounded-sm border border-transparent bg-transparent px-2 text-sm outline-none hover:border-border focus:border-primary focus:bg-background"
          >
            {Object.values(TestType).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        ) : (
          <span className="block min-w-[135px] px-2 text-xs font-semibold">{draft.testType}</span>
        )}
      </td>
      <td className="px-1 py-1">
        <CellInput
          value={draft.sampleDate}
          onChange={(value) => onChange("sampleDate", value)}
          label={`Sample date for ${draft.recordNo}`}
          type="date"
        />
      </td>
      <td className="px-1 py-1">
        <CellInput value={draft.location} onChange={(value) => onChange("location", value)} label={`Location or plant for ${draft.recordNo}`} />
      </td>
      <td className="px-1 py-1">
        <CellInput value={draft.material} onChange={(value) => onChange("material", value)} label={`Material or product for ${draft.recordNo}`} />
      </td>
      <td className="px-1 py-1">{detailInput("referenceNumber", "Reference number", readyMix)}</td>
      <td className="px-1 py-1">{detailInput("customerName", "Customer name", readyMix)}</td>
      <td className="px-1 py-1">{detailInput("customerLocation", "Customer location", readyMix)}</td>
      <td className="px-1 py-1">{detailInput("slump", "Slump", readyMix, "number")}</td>
      <td className="px-1 py-1">{detailInput("temperature", "Temperature", readyMix, "number")}</td>
      <td className="px-1 py-1">{detailInput("blockType", "Block type", blocks)}</td>
      <td className="px-1 py-1">{detailInput("blockSize", "Block size", blocks)}</td>
      <td className="px-1 py-1">{detailInput("machine", "Machine", blocks)}</td>
      <td className="px-1 py-1">{detailInput("blockAge", "Block age", blocks, "number")}</td>
      <td className="px-1 py-1">{detailInput("testingDate", "Testing date", blocks, "date")}</td>
      <td className="px-1 py-1">{detailInput("sampleType", "Sample type", blocks)}</td>
      <td className="px-1 py-1">{detailInput("conditioningMethod", "Conditioning method", blocks)}</td>
      <td className="px-1 py-1">{detailInput("preparationMethod", "Preparation method", blocks)}</td>
      <td className="px-1 py-1">{detailInput("shapeFactor", "Shape factor", blocks, "number")}</td>
      <td className="px-1 py-1">{detailInput("supplier", "Supplier", sieve)}</td>
      <td className="px-1 py-1">{detailInput("condition", "Condition", sieve)}</td>
      <td className="px-1 py-1">{detailInput("source", "Source", water)}</td>
      <td className="px-1 py-1">
        <CellInput value={draft.testedBy} onChange={(value) => onChange("testedBy", value)} label={`Tested by for ${draft.recordNo}`} />
      </td>
      <td className="px-1 py-1">
        <CellInput value={draft.remarks} onChange={(value) => onChange("remarks", value)} label={`Remarks for ${draft.recordNo}`} />
      </td>
    </tr>
  );
}

export default function RecordsBulkEdit() {
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const queryClient = useQueryClient();
  const [testTypeFilter, setTestTypeFilter] = useState<TestType | "All">("All");
  const { data: records = [], isLoading, isFetching, error } = useListRecords({
    limit: 1000,
    testType: testTypeFilter === "All" ? undefined : testTypeFilter,
  });
  const [drafts, setDrafts] = useState<BulkRecordDraft[]>([]);
  const [originals, setOriginals] = useState<BulkRecordDraft[]>([]);
  const [newDraft, setNewDraft] = useState<BulkRecordDraft | null>(null);
  const [loadedFilter, setLoadedFilter] = useState<TestType | "All" | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isFetching && loadedFilter !== testTypeFilter) {
      const nextDrafts = records.map(recordToBulkDraft);
      setDrafts(nextDrafts);
      setOriginals(nextDrafts.map(cloneDraft));
      setNewDraft(null);
      setLoadedFilter(testTypeFilter);
    }
  }, [isFetching, loadedFilter, records, testTypeFilter]);

  const originalById = useMemo(
    () => new Map(originals.map((draft) => [draft.id, draft])),
    [originals],
  );
  const dirtyDrafts = drafts.filter((draft) => {
    const original = originalById.get(draft.id);
    return !original || !sameDraft(draft, original);
  });
  const changeCount = dirtyDrafts.length + (newDraft ? 1 : 0);

  const changeTestTypeFilter = (value: TestType | "All") => {
    if (changeCount) {
      toast.error("Save or discard your unsaved changes before changing the test type filter.");
      return;
    }
    setTestTypeFilter(value);
  };

  const updateExisting = (
    id: number,
    updater: (draft: BulkRecordDraft) => BulkRecordDraft,
  ) => {
    setDrafts((current) => current.map((draft) => (
      draft.id === id ? updater(draft) : draft
    )));
  };

  const updateTopLevel = (
    draft: BulkRecordDraft,
    key: DraftKey,
    value: string,
  ) => ({ ...draft, [key]: value });

  const updateDetail = (
    draft: BulkRecordDraft,
    key: string,
    value: string,
  ) => updateDraftDetail(draft, key, value);

  const discardChanges = () => {
    setDrafts(originals.map(cloneDraft));
    setNewDraft(null);
  };

  const saveAll = async () => {
    const validationFailures = [
      ...dirtyDrafts.map((draft) => ({
        label: draft.recordNo,
        missing: validateBulkDraft(draft),
      })),
      ...(newDraft
        ? [{ label: "New record", missing: validateBulkDraft(newDraft) }]
        : []),
    ].filter((entry) => entry.missing.length);
    if (validationFailures.length) {
      const first = validationFailures[0];
      toast.error(`${first.label}: complete ${first.missing.join(", ")}.`);
      return;
    }

    setIsSaving(true);
    try {
      const updatedRecords = await Promise.all(
        dirtyDrafts.map((draft) => updateRecord(draft.id, bulkDraftToUpdate(draft))),
      );
      const createdRecord = newDraft
        ? await createRecord(bulkDraftToCreate(newDraft))
        : null;
      const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));
      const savedDrafts = drafts.map((draft) => (
        updatedById.has(draft.id)
          ? recordToBulkDraft(updatedById.get(draft.id) as QcRecord)
          : cloneDraft(draft)
      ));
      if (createdRecord) savedDrafts.unshift(recordToBulkDraft(createdRecord));
      setDrafts(savedDrafts);
      setOriginals(savedDrafts.map(cloneDraft));
      setNewDraft(null);
      await queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
      toast.success(
        `${updatedRecords.length} record${updatedRecords.length === 1 ? "" : "s"} updated` +
        `${createdRecord ? " and 1 new record added" : ""}.`,
      );
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save record changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEditQc) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <h1 className="text-xl font-semibold">Editing access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">You can view records, but your role cannot edit them.</p>
          <Button asChild className="mt-5"><Link href="/records">Back to QC Register</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="outline" size="icon" aria-label="Back to QC Register">
            <Link href="/records"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <TableProperties className="h-7 w-7 text-primary" />
              Edit All Records
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit main record information only. Test measurements and calculated results are preserved.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={testTypeFilter}
            onValueChange={(value) => changeTestTypeFilter(value as TestType | "All")}
          >
            <SelectTrigger className="w-[210px]" aria-label="Filter records by test type">
              <SelectValue placeholder="Filter by test type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All test types</SelectItem>
              {Object.values(TestType).map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setNewDraft((current) => current ?? createEmptyBulkDraft(today()))}
            disabled={Boolean(newDraft)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Record
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:hidden dark:bg-amber-950/20 dark:text-amber-100">
        This wide editor is easier to use on a desktop or tablet. Scroll horizontally to reach every field.
      </div>

      <Card className="overflow-hidden border-t-4 border-t-primary">
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-240px)] overflow-auto">
            <table className="min-w-[3200px] border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-muted shadow-sm">
                <tr className="border-b">
                  {[
                    "Record No.",
                    "Test Type",
                    "Sample Date",
                    "Location / Plant",
                    "Material / Product",
                    "Reference No.",
                    "Customer Name",
                    "Customer Location",
                    "Slump (mm)",
                    "Temperature (°C)",
                    "Block Type",
                    "Block Size",
                    "Machine",
                    "Block Age",
                    "Testing Date",
                    "Sample Type",
                    "Conditioning Method",
                    "Preparation Method",
                    "Shape Factor",
                    "Supplier",
                    "Condition",
                    "Water Source",
                    "Tested By",
                    "Remarks",
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      className={[
                        "whitespace-nowrap border-r px-3 py-3 text-left text-xs font-semibold",
                        index === 0 ? "sticky left-0 z-30 bg-muted" : "",
                      ].join(" ")}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={24} className="h-48 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading all records...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={24} className="h-48 text-center text-destructive">
                      Unable to load records.
                    </td>
                  </tr>
                ) : (
                  <>
                    {newDraft && (
                      <DraftRow
                        draft={newDraft}
                        dirty
                        isNew
                        onChange={(key, value) => setNewDraft((current) => (
                          current ? updateTopLevel(current, key, value) : current
                        ))}
                        onDetailChange={(key, value) => setNewDraft((current) => (
                          current ? updateDetail(current, key, value) : current
                        ))}
                        onTestTypeChange={(testType) => setNewDraft((current) => (
                          current ? { ...current, testType } : current
                        ))}
                      />
                    )}
                    {drafts.map((draft) => (
                      <DraftRow
                        key={draft.id}
                        draft={draft}
                        dirty={!sameDraft(draft, originalById.get(draft.id) ?? draft)}
                        isNew={false}
                        onChange={(key, value) => updateExisting(
                          draft.id,
                          (current) => updateTopLevel(current, key, value),
                        )}
                        onDetailChange={(key, value) => updateExisting(
                          draft.id,
                          (current) => updateDetail(current, key, value),
                        )}
                        onTestTypeChange={() => undefined}
                      />
                    ))}
                    {!drafts.length && !newDraft && (
                      <tr>
                        <td colSpan={24} className="h-48 text-center text-muted-foreground">
                          No records yet. Use Add New Record to create the first one.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {changeCount
              ? `${changeCount} unsaved record${changeCount === 1 ? "" : "s"}`
              : "All changes saved"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={discardChanges} disabled={!changeCount || isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Discard
            </Button>
            <Button type="button" onClick={saveAll} disabled={!changeCount || isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save All Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
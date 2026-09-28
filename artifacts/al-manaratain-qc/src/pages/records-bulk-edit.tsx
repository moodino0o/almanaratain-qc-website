import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  TestType,
  createRecord,
  getGetLookupsQueryKey,
  getGetReferenceDataQueryKey,
  getListRecordsQueryKey,
  updateRecord,
  useListRecords,
  useCreateReferenceItem,
  useGetLookups,
  useGetReferenceData,
  type QcRecord,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  TableProperties,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppBack } from "@/hooks/use-app-back";
import { Card, CardContent } from "@/components/ui/card";
import { TypeaheadInput } from "@/components/ui/typeahead-input";
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
import { EMPLOYEE_ADDABLE_REFERENCE_CATEGORIES } from "./reference-data-permissions";

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

type DraftKey = "sampleDate" | "location" | "material" | "testedBy" | "reviewedBy" | "remarks";

type ReferenceOptionProps = {
  onCreateOption?: (value: string) => Promise<string | void>;
  createOptionDestination?: string;
};

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
      className="h-8 w-full min-w-0 rounded-sm border border-transparent bg-transparent px-1 text-[10px] leading-tight outline-none transition-colors hover:border-border focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/30"
    />
  );
}

function LookupCell({
  value,
  onChange,
  label,
  options,
  placeholder = "Choose...",
  disabled = false,
  onCreateOption,
  createOptionDestination,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  onCreateOption?: (value: string) => Promise<string | void>;
  createOptionDestination?: string;
}) {
  if (disabled) {
    return <span className="block px-2 text-center text-muted-foreground/50">—</span>;
  }
  return (
    <TypeaheadInput
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className="min-w-0"
      onCreateOption={onCreateOption}
      createOptionDestination={createOptionDestination}
      compact
    />
  );
}

type BulkLookupOptions = {
  locations: string[];
  materials: string[];
  mixStrengths: string[];
  blockTypes: string[];
  blockSizes: string[];
  customers: string[];
  customerLocations: string[];
  employees: string[];
  suppliers: string[];
  sampleTypes: string[];
  conditioningMethods: string[];
  preparationMethods: string[];
};

const categoryValues = (
  categories: Array<{ key: string; items: Array<{ value: string }> }> | undefined,
  key: string,
) => categories?.find((category) => category.key === key)?.items.map((item) => item.value) ?? [];

const uniqueValues = (...groups: string[][]) =>
  Array.from(new Set(groups.flat().map((value) => value.trim()).filter(Boolean)));

function DraftRow({
  draft,
  dirty,
  isNew,
  newRecordNumber,
  onRemove,
  onChange,
  onDetailChange,
  onTestTypeChange,
  lookupOptions,
  canEditApprovedBy,
  referenceOptionProps,
}: {
  draft: BulkRecordDraft;
  dirty: boolean;
  isNew: boolean;
  newRecordNumber?: number;
  onRemove?: () => void;
  onChange: (key: DraftKey, value: string) => void;
  onDetailChange: (key: string, value: string) => void;
  onTestTypeChange: (value: BulkRecordDraft["testType"]) => void;
  lookupOptions: BulkLookupOptions;
  canEditApprovedBy: boolean;
  referenceOptionProps: (categoryKey?: string) => ReferenceOptionProps;
}) {
  const readyMix = draft.testType === TestType.Ready_Mix;
  const mixDesign =
    readyMix || draft.testType === TestType.RMX_Trial;
  const blocks = draft.testType === TestType.Blocks;
  const pavingBlocks = draft.testType === TestType.Paving_Blocks;
  const blockProduct = blocks || pavingBlocks;
  const sieve =
    draft.testType === TestType.Sand_Sieve ||
    draft.testType === TestType.Aggregate_Sieve;
  const water = draft.testType === TestType.Water;
  const materialOptions =
    mixDesign
      ? lookupOptions.mixStrengths
      : blockProduct
        ? uniqueValues(lookupOptions.blockTypes, lookupOptions.blockSizes)
        : lookupOptions.materials;

  const detailInput = (
    key: string,
    label: string,
    applies: boolean,
    type: "text" | "date" | "number" = "text",
    options: string[] = [],
    categoryKey?: string,
  ) => (
    (options.length > 0 || categoryKey !== undefined) && type === "text"
      ? <LookupCell
          value={detailText(draft.details, key)}
          onChange={(value) => onDetailChange(key, value)}
          label={`${label} for ${draft.recordNo}`}
          options={options}
          disabled={!applies}
          {...referenceOptionProps(categoryKey)}
        />
      : <CellInput
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
      <td data-label="Record No." className="sticky left-0 z-10 min-w-0 border-r bg-inherit px-1 py-2 font-semibold text-primary">
        {isNew ? (
          <div className="flex min-w-0 items-center justify-between gap-0.5">
            <span className="break-words">New {newRecordNumber ?? ""}</span>
            {onRemove && (
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove new record ${newRecordNumber ?? ""}`}
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : draft.recordNo}
      </td>
      <td data-label="Test Type" className="min-w-0 px-1 py-1">
        {isNew ? (
          <select
            aria-label="Test type for new record"
            value={draft.testType}
            onChange={(event) => onTestTypeChange(
              event.target.value as BulkRecordDraft["testType"],
            )}
            className="h-8 w-full min-w-0 rounded-sm border border-transparent bg-transparent px-1 text-[10px] outline-none hover:border-border focus:border-primary focus:bg-background"
          >
            {Object.values(TestType).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        ) : (
          <span className="block min-w-0 break-words px-1 text-[10px] font-semibold">{draft.testType}</span>
        )}
      </td>
      <td data-label="Sample Date" className="min-w-0 px-1 py-1">
        <CellInput
          value={draft.sampleDate}
          onChange={(value) => onChange("sampleDate", value)}
          label={`Sample date for ${draft.recordNo}`}
          type="date"
        />
      </td>
      <td data-label="Location / Plant" className="min-w-0 px-1 py-1">
        <LookupCell
          value={draft.location}
          onChange={(value) => onChange("location", value)}
          label={`Location or plant for ${draft.recordNo}`}
          options={lookupOptions.locations}
          {...referenceOptionProps("locations")}
        />
      </td>
      <td data-label="Material / Product" className="min-w-0 px-1 py-1">
        <LookupCell
          value={draft.material}
          onChange={(value) => onChange("material", value)}
          label={`Material or product for ${draft.recordNo}`}
          options={materialOptions}
          {...referenceOptionProps(
            mixDesign ? "mixStrengths" : blockProduct ? undefined : "materials",
          )}
        />
      </td>
      <td data-label="Reference No." className="min-w-0 px-1 py-1">{detailInput("referenceNumber", "Reference number", readyMix)}</td>
      <td data-label="Customer Name" className="min-w-0 px-1 py-1">{detailInput("customerName", "Customer name", readyMix, "text", lookupOptions.customers, "customers")}</td>
      <td data-label="Customer Location" className="min-w-0 px-1 py-1">{detailInput("customerLocation", "Customer location", readyMix, "text", lookupOptions.customerLocations, "customerLocations")}</td>
      <td data-label="Slump (mm)" className="min-w-0 px-1 py-1">{detailInput("slump", "Slump", readyMix, "number")}</td>
      <td data-label="Temperature (°C)" className="min-w-0 px-1 py-1">{detailInput("temperature", "Temperature", readyMix, "number")}</td>
      <td data-label="Block Type" className="min-w-0 px-1 py-1">{detailInput("blockType", "Block type", blocks, "text", lookupOptions.blockTypes, "blockTypes")}</td>
      <td data-label="Block Size" className="min-w-0 px-1 py-1">{detailInput("blockSize", "Block size", blocks, "text", lookupOptions.blockSizes, "blockSizes")}</td>
      <td data-label="Machine" className="min-w-0 px-1 py-1">{detailInput("machine", "Machine", blocks)}</td>
      <td data-label="Block Age" className="min-w-0 px-1 py-1">{detailInput("blockAge", "Block age", blocks, "number")}</td>
      <td data-label="Testing Date" className="min-w-0 px-1 py-1">{detailInput("testingDate", "Testing date", blocks, "date")}</td>
      <td data-label="Sample Type" className="min-w-0 px-1 py-1">{detailInput("sampleType", "Sample type", blocks, "text", lookupOptions.sampleTypes, "sampleTypes")}</td>
      <td data-label="Conditioning Method" className="min-w-0 px-1 py-1">{detailInput("conditioningMethod", "Conditioning method", blocks, "text", lookupOptions.conditioningMethods, "conditioningMethods")}</td>
      <td data-label="Preparation Method" className="min-w-0 px-1 py-1">{detailInput("preparationMethod", "Preparation method", blocks, "text", lookupOptions.preparationMethods, "preparationMethods")}</td>
      <td data-label="Shape Factor" className="min-w-0 px-1 py-1">{detailInput("shapeFactor", "Shape factor", blocks, "number")}</td>
      <td data-label="Supplier" className="min-w-0 px-1 py-1">{detailInput("supplier", "Supplier", sieve, "text", lookupOptions.suppliers, "suppliers")}</td>
      <td data-label="Condition" className="min-w-0 px-1 py-1">{detailInput("condition", "Condition", sieve)}</td>
      <td data-label="Water Source" className="min-w-0 px-1 py-1">{detailInput("source", "Source", water)}</td>
      <td data-label="Tested By" className="min-w-0 px-1 py-1">
        <LookupCell
          value={draft.testedBy}
          onChange={(value) => onChange("testedBy", value)}
          label={`Tested by for ${draft.recordNo}`}
          options={lookupOptions.employees}
          {...referenceOptionProps("employees")}
        />
      </td>
      {canEditApprovedBy && (
        <td data-label="Approved By" className="min-w-0 px-1 py-1">
          <LookupCell
            value={draft.reviewedBy}
            onChange={(value) => onChange("reviewedBy", value)}
            label={`Approved by for ${draft.recordNo}`}
            options={lookupOptions.employees}
            {...referenceOptionProps("employees")}
          />
        </td>
      )}
      <td data-label="Remarks" className="min-w-0 px-1 py-1">
        <CellInput value={draft.remarks} onChange={(value) => onChange("remarks", value)} label={`Remarks for ${draft.recordNo}`} />
      </td>
    </tr>
  );
}

export default function RecordsBulkEdit() {
  const goBack = useAppBack("/records");
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const canEditApprovedBy = role === "administrator";
  const queryClient = useQueryClient();
  const { data: lookups } = useGetLookups();
  const { data: referenceData } = useGetReferenceData();
  const createReferenceItem = useCreateReferenceItem();
  const [testTypeFilter, setTestTypeFilter] = useState<TestType | "All">("All");
  const { data: records = [], isLoading, isFetching, error } = useListRecords({
    limit: 1000,
    testType: testTypeFilter === "All" ? undefined : testTypeFilter,
  });
  const [drafts, setDrafts] = useState<BulkRecordDraft[]>([]);
  const [originals, setOriginals] = useState<BulkRecordDraft[]>([]);
  const [newDrafts, setNewDrafts] = useState<BulkRecordDraft[]>([]);
  const nextNewDraftId = useRef(-1);
  const [loadedFilter, setLoadedFilter] = useState<TestType | "All" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const referenceOptionProps = (categoryKey?: string): ReferenceOptionProps => {
    if (!categoryKey) return {};
    const category = referenceData?.categories.find(
      (item) => item.key === categoryKey,
    );
    const canAddCategory =
      role === "administrator" ||
      (Boolean(role) &&
        EMPLOYEE_ADDABLE_REFERENCE_CATEGORIES.has(categoryKey));
    if (!category || !canAddCategory) return {};

    return {
      createOptionDestination: `Settings → ${category.label}`,
      onCreateOption: async (value) => {
        try {
          const createdItem = await createReferenceItem.mutateAsync({
            categoryId: category.id,
            data: { value },
          });
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: getGetReferenceDataQueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getGetLookupsQueryKey(),
            }),
          ]);
          toast.success(`Added “${createdItem.value}” to ${category.label}.`);
          return createdItem.value;
        } catch {
          toast.error(`That value could not be added to ${category.label}.`);
          throw new Error(`Could not add this value to ${category.label}.`);
        }
      },
    };
  };
  const lookupOptions = useMemo<BulkLookupOptions>(() => ({
    locations: uniqueValues(
      lookups?.locations ?? [],
      lookups?.factories ?? [],
      lookups?.plants ?? [],
    ),
    materials: lookups?.materials ?? [],
    mixStrengths: lookups?.mixStrengths ?? [],
    blockTypes: lookups?.blockTypes ?? [],
    blockSizes: lookups?.blockSizes ?? [],
    customers: lookups?.customers ?? [],
    customerLocations: lookups?.customerLocations ?? [],
    employees: lookups?.employees ?? [],
    suppliers: lookups?.suppliers ?? [],
    sampleTypes: categoryValues(referenceData?.categories, "sampleTypes"),
    conditioningMethods: categoryValues(referenceData?.categories, "conditioningMethods"),
    preparationMethods: categoryValues(referenceData?.categories, "preparationMethods"),
  }), [lookups, referenceData]);

  useEffect(() => {
    if (!isFetching && loadedFilter !== testTypeFilter) {
      const nextDrafts = records.map(recordToBulkDraft);
      setDrafts(nextDrafts);
      setOriginals(nextDrafts.map(cloneDraft));
      setNewDrafts([]);
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
  const changeCount = dirtyDrafts.length + newDrafts.length;

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

  const addNewDraft = () => {
    const id = nextNewDraftId.current--;
    setNewDrafts((current) => [
      ...current,
      { ...createEmptyBulkDraft(today()), id },
    ]);
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
    setNewDrafts([]);
  };

  const saveAll = async () => {
    const validationFailures = [
      ...dirtyDrafts.map((draft) => ({
        label: draft.recordNo,
        missing: validateBulkDraft(draft),
      })),
      ...newDrafts.map((draft, index) => ({
        label: `New record ${index + 1}`,
        missing: validateBulkDraft(draft),
      })),
    ].filter((entry) => entry.missing.length);
    if (validationFailures.length) {
      const first = validationFailures[0];
      toast.error(`${first.label}: complete ${first.missing.join(", ")}.`);
      return;
    }

    setIsSaving(true);
    try {
      const [updateResults, createResults] = await Promise.all([
        Promise.allSettled(
          dirtyDrafts.map((draft) => updateRecord(
            draft.id,
            bulkDraftToUpdate(draft, canEditApprovedBy),
          )),
        ),
        Promise.allSettled(
          newDrafts.map((draft) => createRecord(
            bulkDraftToCreate(draft, canEditApprovedBy),
          )),
        ),
      ]);
      const updatedRecords = updateResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const createdRecords = createResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const savedNewDrafts = createdRecords.map(recordToBulkDraft);
      const failedUpdateCount = updateResults.filter(
        (result) => result.status === "rejected",
      ).length;
      const failedCreateCount = createResults.filter(
        (result) => result.status === "rejected",
      ).length;
      const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));
      const savedDrafts = [...savedNewDrafts, ...drafts.map((draft) => (
        updatedById.has(draft.id)
          ? recordToBulkDraft(updatedById.get(draft.id) as QcRecord)
          : cloneDraft(draft)
      ))];
      const savedOriginals = [
        ...savedNewDrafts.map(cloneDraft),
        ...originals.map((draft) => {
          const updated = updatedById.get(draft.id);
          return updated ? recordToBulkDraft(updated) : cloneDraft(draft);
        }),
      ];
      setDrafts(savedDrafts);
      setOriginals(savedOriginals);
      setNewDrafts((current) => current.filter((_, index) =>
        createResults[index]?.status === "rejected",
      ));
      if (updatedRecords.length || createdRecords.length) {
        await queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
      }
      const failureCount = failedUpdateCount + failedCreateCount;
      if (failureCount) {
        toast.error(
          `${failureCount} record${failureCount === 1 ? "" : "s"} could not be saved. Successful saves were kept; review and retry the remaining changes.`,
        );
      } else {
        const successParts = [];
        if (updatedRecords.length) {
          successParts.push(
            `${updatedRecords.length} record${updatedRecords.length === 1 ? "" : "s"} updated`,
          );
        }
        if (createdRecords.length) {
          successParts.push(
            `${createdRecords.length} new record${createdRecords.length === 1 ? "" : "s"} added`,
          );
        }
        toast.success(`${successParts.join(" and ")}.`);
      }
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
          <Button className="mt-5" onClick={goBack}>Back</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" aria-label="Go back" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <TableProperties className="h-7 w-7 text-primary" />
              Edit All Records
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add multiple records or edit saved records. Every column stays visible without horizontal scrolling.
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
            onClick={addNewDraft}
            disabled={isLoading || isSaving}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Record
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-t-4 border-t-primary">
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-hidden">
            <table className="bulk-record-table w-full table-fixed border-collapse text-[10px] leading-tight">
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
                     ...(canEditApprovedBy ? ["Approved By"] : []),
                    "Remarks",
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      className={[
                        "min-w-0 break-words border-r px-1 py-2 text-left text-[9px] font-semibold leading-tight",
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
                    <td colSpan={canEditApprovedBy ? 25 : 24} className="h-48 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading all records...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={canEditApprovedBy ? 25 : 24} className="h-48 text-center text-destructive">
                      Unable to load records.
                    </td>
                  </tr>
                ) : (
                  <>
                    {newDrafts.map((newDraft, index) => (
                      <DraftRow
                        key={newDraft.id}
                        draft={newDraft}
                        dirty
                        isNew
                        newRecordNumber={index + 1}
                        onRemove={() => setNewDrafts((current) => current.filter(
                          (draft) => draft.id !== newDraft.id,
                        ))}
                        onChange={(key, value) => setNewDrafts((current) => (
                          current.map((draft) => draft.id === newDraft.id
                            ? updateTopLevel(draft, key, value)
                            : draft)
                        ))}
                        onDetailChange={(key, value) => setNewDrafts((current) => (
                          current.map((draft) => draft.id === newDraft.id
                            ? updateDetail(draft, key, value)
                            : draft)
                        ))}
                        onTestTypeChange={(testType) => setNewDrafts((current) => (
                          current.map((draft) => draft.id === newDraft.id
                            ? { ...draft, testType }
                            : draft)
                        ))}
                        lookupOptions={lookupOptions}
                        canEditApprovedBy={canEditApprovedBy}
                        referenceOptionProps={referenceOptionProps}
                      />
                    ))}
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
                        lookupOptions={lookupOptions}
                        canEditApprovedBy={canEditApprovedBy}
                        referenceOptionProps={referenceOptionProps}
                      />
                    ))}
                    {!drafts.length && !newDrafts.length && (
                      <tr>
                        <td colSpan={canEditApprovedBy ? 25 : 24} className="h-48 text-center text-muted-foreground">
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
            <Button type="button" variant="outline" onClick={addNewDraft} disabled={isLoading || isSaving}>
              <Plus className="mr-2 h-4 w-4" />
              Add New
            </Button>
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
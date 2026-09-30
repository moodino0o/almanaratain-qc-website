import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  Copy,
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
  duplicateBulkDraft,
  recordToBulkDraft,
  updateDraftDetail,
  validateBulkDraft,
  type BulkRecordDraft,
} from "./records-bulk-utils";
import { getReadyMixReferenceNumberError } from "./record-form-utils";
import { EMPLOYEE_ADDABLE_REFERENCE_CATEGORIES } from "./reference-data-permissions";
import { registerSectionFromQuery } from "./register-sections";

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
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  type?: "text" | "date" | "number";
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
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
      className={[
        "h-8 w-full min-w-0 rounded-sm border bg-transparent px-1 text-[10px] leading-tight outline-none transition-colors focus:bg-background focus:ring-1",
        invalid
          ? "border-destructive bg-destructive/5 focus:border-destructive focus:ring-destructive/30"
          : "border-transparent hover:border-border focus:border-primary focus:ring-primary/30",
      ].join(" ")}
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
  machines: string[];
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
  onDuplicate,
  isSaving = false,
  onChange,
  onDetailChange,
  onTestTypeChange,
  availableTestTypes,
  lookupOptions,
  canEditApprovedBy,
  referenceOptionProps,
}: {
  draft: BulkRecordDraft;
  dirty: boolean;
  isNew: boolean;
  newRecordNumber?: number;
  onRemove?: () => void;
  onDuplicate?: () => void;
  isSaving?: boolean;
  onChange: (key: DraftKey, value: string) => void;
  onDetailChange: (key: string, value: string) => void;
  onTestTypeChange: (value: BulkRecordDraft["testType"]) => void;
  availableTestTypes: TestType[];
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

  const recordLabel = isNew
    ? `new record ${newRecordNumber ?? ""}`
    : draft.recordNo;
  const detailInput = (
    key: string,
    label: string,
    type: "text" | "date" | "number" = "text",
    options: string[] = [],
    categoryKey?: string,
  ) => {
    const value = detailText(draft.details, key);
    const referenceError =
      readyMix && key === "referenceNumber" && value.trim()
        ? getReadyMixReferenceNumberError(value)
        : null;
    const control = (options.length > 0 || categoryKey !== undefined) && type === "text"
      ? <LookupCell
          value={detailText(draft.details, key)}
          onChange={(value) => onDetailChange(key, value)}
          label={`${label} for ${recordLabel}`}
          options={options}
          {...referenceOptionProps(categoryKey)}
        />
      : <CellInput
          value={detailText(draft.details, key)}
          onChange={(value) => onDetailChange(key, value)}
          label={`${label} for ${recordLabel}`}
          type={type}
          invalid={Boolean(referenceError)}
        />
    return referenceError ? (
      <div className="space-y-1">
        {control}
        <p role="alert" className="text-[9px] font-medium leading-tight text-destructive">
          {referenceError}
        </p>
      </div>
    ) : control;
  };
  const field = (label: string, control: ReactNode, className = "") => (
    <div key={label} className={`min-w-0 ${className}`}>
      <div className="mb-1 text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
      </div>
      {control}
    </div>
  );
  const fields: ReactNode[] = [];
  if (isNew) {
    fields.push(field(
      "Test Type",
      <select
        aria-label="Test type for new record"
        value={draft.testType}
        onChange={(event) => onTestTypeChange(
          event.target.value as BulkRecordDraft["testType"],
        )}
        className="h-8 w-full min-w-0 rounded-sm border bg-background px-1 text-[10px] outline-none focus:border-primary"
      >
        {availableTestTypes.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>,
    ));
  }

  const precast = draft.testType === TestType.Precast;
  const kerbStone = draft.testType === TestType.Kerb_Stone;
  const sampleDateLabel =
    blocks || pavingBlocks || precast || kerbStone ? "Casting Date" : "Sample Date";
  fields.push(
    field(sampleDateLabel, (
      <CellInput
        value={draft.sampleDate}
        onChange={(value) => onChange("sampleDate", value)}
        label={`${sampleDateLabel} for ${recordLabel}`}
        type="date"
      />
    )),
    field(kerbStone ? "Factory" : "Location / Plant", (
      <LookupCell
        value={draft.location}
        onChange={(value) => onChange("location", value)}
        label={`${kerbStone ? "Factory" : "Location or plant"} for ${recordLabel}`}
        options={lookupOptions.locations}
        {...referenceOptionProps("locations")}
      />
    )),
    field(kerbStone ? "Kerb Type" : "Material / Product", (
      <LookupCell
        value={draft.material}
        onChange={(value) => onChange("material", value)}
        label={`${kerbStone ? "Kerb type" : "Material or product"} for ${recordLabel}`}
        options={materialOptions}
        {...referenceOptionProps(
          mixDesign ? "mixStrengths" : blockProduct ? undefined : "materials",
        )}
      />
    )),
  );

  if (readyMix) {
    fields.push(
      field("Reference No.", detailInput("referenceNumber", "Reference number")),
      field("Truck Number", detailInput("truckNumber", "Truck number")),
      field("Customer Name", detailInput(
        "customerName",
        "Customer name",
        "text",
        lookupOptions.customers,
        "customers",
      )),
      field("Customer Location", detailInput(
        "customerLocation",
        "Customer location",
        "text",
        lookupOptions.customerLocations,
        "customerLocations",
      )),
      field("Slump (mm)", detailInput("slump", "Slump", "number")),
      field("Temperature (°C)", detailInput(
        "temperature",
        "Temperature",
        "number",
      )),
    );
  }

  if (blocks) {
    fields.push(
      field("Block Type", detailInput(
        "blockType",
        "Block type",
        "text",
        lookupOptions.blockTypes,
        "blockTypes",
      )),
      field("Block Size", detailInput(
        "blockSize",
        "Block size",
        "text",
        lookupOptions.blockSizes,
        "blockSizes",
      )),
      field("Machine", detailInput(
        "machine",
        "Machine",
        "text",
        lookupOptions.machines,
        "machines",
      )),
      field("Block Age (days)", detailInput("blockAge", "Block age", "number")),
      field("Sample Type", detailInput(
        "sampleType",
        "Sample type",
        "text",
        lookupOptions.sampleTypes,
        "sampleTypes",
      )),
      field("Conditioning Method", detailInput(
        "conditioningMethod",
        "Conditioning method",
        "text",
        lookupOptions.conditioningMethods,
        "conditioningMethods",
      )),
      field("Preparation Method", detailInput(
        "preparationMethod",
        "Preparation method",
        "text",
        lookupOptions.preparationMethods,
        "preparationMethods",
      )),
      field("Shape Factor", detailInput(
        "shapeFactor",
        "Shape factor",
        "number",
      )),
    );
  }

  if (pavingBlocks) {
    fields.push(
      field("Machine Type", detailInput(
        "machine",
        "Machine type",
        "text",
        lookupOptions.machines,
        "machines",
      )),
      field("Age (days)", detailInput("blockAge", "Age", "number")),
      field("Sample Type", detailInput(
        "sampleType",
        "Sample type",
        "text",
        lookupOptions.sampleTypes,
        "sampleTypes",
      )),
      field("Paving Block Size", detailInput(
        "pavingBlockSize",
        "Paving block size",
        "text",
        lookupOptions.blockSizes,
        "blockSizes",
      )),
      field("Correction Factor", detailInput(
        "correctionFactor",
        "Correction factor",
      )),
    );
  }

  if (sieve) {
    fields.push(
      field("Age (days)", detailInput("sampleAge", "Age", "number")),
      field("Supplier", detailInput(
        "supplier",
        "Supplier",
        "text",
        lookupOptions.suppliers,
        "suppliers",
      )),
      field("Material Condition", (
        <Select
          value={
            detailText(draft.details, "materialCondition") ||
            detailText(draft.details, "condition")
          }
          onValueChange={(value) => onDetailChange("materialCondition", value)}
        >
          <SelectTrigger className="h-8 min-w-0 text-[10px]">
            <SelectValue placeholder="Choose condition..." />
          </SelectTrigger>
          <SelectContent>
            {["Single Washed", "Unwashed", "Double Washed"].map((condition) => (
              <SelectItem key={condition} value={condition}>{condition}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )),
    );
  }

  if (water) {
    fields.push(field(
      "Water Source",
      detailInput("source", "Water source"),
    ));
  }

  if (precast) {
    fields.push(
      field("Customer Name", detailInput(
        "customerName",
        "Customer name",
        "text",
        lookupOptions.customers,
        "customers",
      )),
      field("Avg. Strength (1 day)", detailInput("averageStrength1Day", "Average strength at 1 day", "number")),
      field("Avg. Strength (7 days)", detailInput("averageStrength7Days", "Average strength at 7 days", "number")),
      field("Avg. Strength (28 days)", detailInput("averageStrength28Days", "Average strength at 28 days", "number")),
    );
  }

  if (kerbStone) {
    fields.push(
      field("Testing Date", detailInput("testingDate", "Testing date", "date")),
      field("Age (days)", detailInput("age", "Age", "number")),
      field("Avg. Strength", detailInput("averageStrength", "Average strength", "number")),
      field("Min. Strength", detailInput("minimumStrength", "Minimum strength", "number")),
      field("Max. Strength", detailInput("maximumStrength", "Maximum strength", "number")),
    );
  }

  fields.push(
    field("Tested By", (
      <LookupCell
        value={draft.testedBy}
        onChange={(value) => onChange("testedBy", value)}
        label={`Tested by for ${recordLabel}`}
        options={lookupOptions.employees}
        {...referenceOptionProps("employees")}
      />
    )),
  );

  if (canEditApprovedBy) {
    fields.push(field("Approved By", (
      <LookupCell
        value={draft.reviewedBy}
        onChange={(value) => onChange("reviewedBy", value)}
        label={`Approved by for ${recordLabel}`}
        options={lookupOptions.employees}
        {...referenceOptionProps("employees")}
      />
    )));
  }

  fields.push(field(
    "Remarks",
    <CellInput
      value={draft.remarks}
      onChange={(value) => onChange("remarks", value)}
      label={`Remarks for ${recordLabel}`}
    />,
    "col-span-2 sm:col-span-2",
  ));

  return (
    <section
      className={[
        "overflow-hidden rounded-md border transition-colors",
        dirty
          ? "border-amber-400 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/15"
          : "border-border bg-card",
        isNew ? "border-l-4 border-l-primary" : "",
      ].join(" ")}
      aria-label={isNew ? `New record ${newRecordNumber ?? ""}` : `Record ${draft.recordNo}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-primary">
            {isNew ? `New ${newRecordNumber ?? ""}` : draft.recordNo}
          </span>
          <span className="truncate text-xs font-medium text-muted-foreground">
            {draft.testType}
          </span>
        </div>
        {isNew && (
          <div className="flex shrink-0 items-center gap-1">
            {onDuplicate && (
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                aria-label={`Duplicate new record ${newRecordNumber ?? ""}`}
                title="Duplicate record"
                onClick={onDuplicate}
                disabled={isSaving}
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove new record ${newRecordNumber ?? ""}`}
                onClick={onRemove}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 p-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-10">
        {fields}
      </div>
    </section>
  );
}

export default function RecordsBulkEdit() {
  const registerSection = registerSectionFromQuery();
  const goBack = useAppBack(registerSection?.href ?? "/records");
  const availableTestTypes = registerSection?.testTypes ?? Object.values(TestType);
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const canEditApprovedBy = role === "administrator";
  const queryClient = useQueryClient();
  const { data: lookups } = useGetLookups();
  const { data: referenceData } = useGetReferenceData();
  const createReferenceItem = useCreateReferenceItem();
  const [testTypeFilter, setTestTypeFilter] = useState<TestType | "All">("All");
  const queryTestType = testTypeFilter !== "All"
    ? testTypeFilter
    : availableTestTypes.length === 1
      ? availableTestTypes[0]
      : undefined;
  const { data: records = [], isLoading, isFetching, error } = useListRecords({
    limit: 1000,
    testType: queryTestType,
  });
  const visibleRecords = useMemo(
    () => records.filter((record) =>
      availableTestTypes.includes(record.testType) &&
      (testTypeFilter === "All" || record.testType === testTypeFilter),
    ),
    [availableTestTypes, records, testTypeFilter],
  );
  const [drafts, setDrafts] = useState<BulkRecordDraft[]>([]);
  const [originals, setOriginals] = useState<BulkRecordDraft[]>([]);
  const [newDrafts, setNewDrafts] = useState<BulkRecordDraft[]>([]);
  const nextNewDraftId = useRef(-1);
  const [loadedFilter, setLoadedFilter] = useState<string | null>(null);
  const draftFilterKey = `${registerSection?.id ?? "all"}:${testTypeFilter}`;
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
    machines: categoryValues(referenceData?.categories, "machines"),
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
    if (!isFetching && loadedFilter !== draftFilterKey) {
      const nextDrafts = visibleRecords.map(recordToBulkDraft);
      setDrafts(nextDrafts);
      setOriginals(nextDrafts.map(cloneDraft));
      setNewDrafts([]);
      setLoadedFilter(draftFilterKey);
    }
  }, [draftFilterKey, isFetching, loadedFilter, visibleRecords]);

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
    if (value !== "All" && !availableTestTypes.includes(value)) return;
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
    const emptyDraft = createEmptyBulkDraft(today());
    setNewDrafts((current) => [
      ...current,
      {
        ...emptyDraft,
        id,
        testType: testTypeFilter === "All"
          ? registerSection?.defaultTestType ?? emptyDraft.testType
          : testTypeFilter,
      },
    ]);
  };

  const duplicateNewDraft = (draft: BulkRecordDraft) => {
    const duplicate = duplicateBulkDraft(draft, nextNewDraftId.current--);
    setNewDrafts((current) => {
      const sourceIndex = current.findIndex((item) => item.id === draft.id);
      if (sourceIndex < 0) return [...current, duplicate];
      return [
        ...current.slice(0, sourceIndex + 1),
        duplicate,
        ...current.slice(sourceIndex + 1),
      ];
    });
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
              Edit All Records{registerSection && registerSection.id !== "all"
                ? ` — ${registerSection.label}`
                : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {registerSection && registerSection.id !== "all"
                ? `Add or edit ${registerSection.label} records only. Each record shows the fields for its test type.`
                : "Add or edit records. Each record shows only the fields for its test type, without horizontal scrolling."}
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
              <SelectItem value="All">
                {registerSection && registerSection.id !== "all"
                  ? `All ${registerSection.label} types`
                  : "All test types"}
              </SelectItem>
              {availableTestTypes.map((type) => (
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
          <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto overflow-x-hidden p-2">
            {isLoading ? (
              <div className="flex min-h-48 flex-col items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mb-2 h-6 w-6 animate-spin" />
                Loading all records...
              </div>
            ) : error ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-destructive">
                Unable to load records.
              </div>
            ) : (
              <>
                {newDrafts.map((newDraft, index) => (
                  <DraftRow
                    key={newDraft.id}
                    draft={newDraft}
                    dirty
                    isNew
                    newRecordNumber={index + 1}
                    isSaving={isSaving}
                    onDuplicate={() => duplicateNewDraft(newDraft)}
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
                        ? { ...draft, testType, material: "", details: {} }
                        : draft)
                    ))}
                    availableTestTypes={availableTestTypes}
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
                    availableTestTypes={availableTestTypes}
                    lookupOptions={lookupOptions}
                    canEditApprovedBy={canEditApprovedBy}
                    referenceOptionProps={referenceOptionProps}
                  />
                ))}
                {!drafts.length && !newDrafts.length && (
                  <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                    No records yet. Use Add New Record to create the first one.
                  </div>
                )}
              </>
            )}
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
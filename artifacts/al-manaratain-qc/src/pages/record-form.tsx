import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetLookups, useGetReferenceData, useGetRecord, useCreateRecord, useUpdateRecord, useListSieveStandards, useListStrengthStandards, TestType, RecordStatus, QcRecordInput, QcRecordUpdate } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { getListRecordsQueryKey, getGetDashboardQueryKey, getGetRecordQueryKey } from "@workspace/api-client-react";
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { TypeaheadInput } from "@/components/ui/typeahead-input";

type TestRow = {
  id: number;
  length: string;
  width: string;
  height: string;
  dryWeight: string;
  wetWeight: string;
  sampleAge: string;
  testAge: string;
  load: string;
  strength: string;
  waterAbsorption: string;
  sieveSize: string;
  sieveSizeReferenceItemId: number | null;
  amountReturned: string;
  passingAmount: string;
  passingPercentage: string;
};

const createEmptyRow = (id: number): TestRow => ({
  id,
  length: "",
  width: "",
  height: "",
  dryWeight: "",
  wetWeight: "",
  sampleAge: "",
  testAge: "",
  load: "",
  strength: "",
  waterAbsorption: "",
  sieveSize: "",
  sieveSizeReferenceItemId: null,
  amountReturned: "",
  passingAmount: "",
  passingPercentage: "",
});

const REFERENCE_NUMBER_MAX_LENGTH = 32;
const stringValue = (value: unknown) => (value == null ? "" : String(value));

const numericInputValue = (value: unknown) => {
  const match = stringValue(value).match(/[-+]?(?:\d+\.?\d*|\.\d+)/);
  return match?.[0] ?? "";
};

const calculateWaterAbsorption = (dryWeight: unknown, wetWeight: unknown) => {
  const dry = Number(numericInputValue(dryWeight));
  const wet = Number(numericInputValue(wetWeight));
  if (!numericInputValue(dryWeight) || !numericInputValue(wetWeight) || !Number.isFinite(dry) || !Number.isFinite(wet) || dry <= 0) {
    return "";
  }
  return (((wet - dry) / dry) * 100).toFixed(2);
};

const sieveSizeNumber = (value: string) => {
  const parsed = Number(numericInputValue(value));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const toFormRow = (row: unknown, id: number): TestRow => {
  const values = typeof row === "object" && row !== null ? row as Record<string, unknown> : {};
  return {
    id,
    length: numericInputValue(values.length),
    width: numericInputValue(values.width),
    height: numericInputValue(values.height),
    dryWeight: numericInputValue(values.dryWeight),
    wetWeight: numericInputValue(values.wetWeight),
    sampleAge: numericInputValue(values.sampleAge),
    testAge: numericInputValue(values.testAge),
    load: numericInputValue(values.load),
    strength: numericInputValue(values.strength ?? values.calculatedStrength ?? values.compressiveStrength),
    waterAbsorption: calculateWaterAbsorption(values.dryWeight, values.wetWeight),
    sieveSize: stringValue(values.sieveSize),
    sieveSizeReferenceItemId: numericInputValue(values.sieveSizeReferenceItemId)
      ? Number(numericInputValue(values.sieveSizeReferenceItemId))
      : null,
    amountReturned: numericInputValue(values.amountReturned),
    passingAmount: numericInputValue(values.passingAmount),
    passingPercentage: numericInputValue(values.passingPercentage),
  };
};

export default function RecordForm() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const recordId = id ? Number(id) : 0;
  const isEditing = Number.isInteger(recordId) && recordId > 0;
  const duplicateSourceId = Number(
    typeof window === "undefined"
      ? 0
      : new URLSearchParams(window.location.search).get("duplicateFrom"),
  );
  const isDuplicating = !isEditing && Number.isInteger(duplicateSourceId) && duplicateSourceId > 0;
  const sourceRecordId = isEditing ? recordId : isDuplicating ? duplicateSourceId : 0;
  const queryClient = useQueryClient();
  
  const { data: lookups, isLoading: lookupsLoading } = useGetLookups();
  const { data: referenceData } = useGetReferenceData();
  const {
    data: existingRecord,
    isLoading: recordLoading,
    isError: recordError,
  } = useGetRecord(sourceRecordId, {
    query: {
      queryKey: getGetRecordQueryKey(sourceRecordId),
      enabled: isEditing || isDuplicating,
    },
  });
  const { data: strengthStandards } = useListStrengthStandards();
  const { data: sieveStandards } = useListSieveStandards();
  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const initializedRecordId = useRef<number | null>(null);

  const [testType, setTestType] = useState<TestType>(TestType.Ready_Mix);
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationValue, setLocationValue] = useState("");
  const [material, setMaterial] = useState("");
  const [testedBy, setTestedBy] = useState("");
  const [machine, setMachine] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedStrengthStandardId, setSelectedStrengthStandardId] = useState("");
  
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [testRows, setTestRows] = useState<TestRow[]>([createEmptyRow(1)]);
  const nextRowId = useRef(2);
  const rowInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const sieveContextKeyRef = useRef("");

  useEffect(() => {
    if ((!isEditing && !isDuplicating) || !existingRecord || initializedRecordId.current === sourceRecordId) return;

    const savedDetails =
      typeof existingRecord.details === "object" && existingRecord.details !== null
        ? { ...existingRecord.details as Record<string, unknown> }
        : {};
    const savedRows = Array.isArray(savedDetails.sieveRows)
      ? savedDetails.sieveRows
      : Array.isArray(savedDetails.testRows)
        ? savedDetails.testRows
        : [];
    const numericDetailKeys = [
      "slump",
      "temperature",
      "weight",
      "sampleWeight",
      "dryWeight",
      "wetWeight",
      "length",
      "width",
      "height",
      "compressiveStrength",
      "passing10mm",
      "passing5mm",
      "finenessModulus",
      "moisture",
    ];
    for (const key of numericDetailKeys) {
      if (key in savedDetails) savedDetails[key] = numericInputValue(savedDetails[key]);
    }

    setTestType(existingRecord.testType);
    setSampleDate(existingRecord.sampleDate.slice(0, 10));
    setLocationValue(existingRecord.location);
    setMaterial(existingRecord.material);
    setTestedBy(existingRecord.testedBy);
    setRemarks(existingRecord.remarks ?? "");
    setReferenceNumber(stringValue(savedDetails.referenceNumber));
    setCustomerName(stringValue(savedDetails.customerName));
    setCustomerLocation(stringValue(savedDetails.customerLocation));
    setMachine(stringValue(savedDetails.machine));
    setSelectedStrengthStandardId(stringValue(savedDetails.strengthStandardId));
    setDetails(savedDetails);
    setTestRows(
      savedRows.length
        ? savedRows.map((row, index) => toFormRow(row, index + 1))
        : [createEmptyRow(1)],
    );
    sieveContextKeyRef.current = `${existingRecord.testType}|${String(savedDetails.materialReferenceItemId ?? existingRecord.material)}`;
    nextRowId.current = Math.max(savedRows.length + 1, 2);
    initializedRecordId.current = sourceRecordId;
  }, [existingRecord, isDuplicating, isEditing, sourceRecordId]);

  const handleDetailChange = (key: string, value: string) => {
    setDetails(prev => ({ ...prev, [key]: value }));
  };

  const usesTestRows = testType === TestType.Ready_Mix || testType === TestType.Blocks;
  const usesSieveRows = testType === TestType.Sand_Sieve || testType === TestType.Aggregate_Sieve;
  const sieveMassUnit = "g";

  const materialReferenceItems = useMemo(
    () => referenceData?.categories.find((category) => category.key === "materials")?.items ?? [],
    [referenceData],
  );
  const sieveSizeReferenceItems = useMemo(
    () => referenceData?.categories.find((category) => category.key === "sieveSizes")?.items ?? [],
    [referenceData],
  );

  const updateTestRow = (rowIndex: number, key: keyof Omit<TestRow, "id">, value: string) => {
    setTestRows(prev => prev.map((row, index) => (
      index === rowIndex
        ? {
            ...row,
            [key]: value,
            ...(testType === TestType.Ready_Mix && (key === "dryWeight" || key === "wetWeight")
              ? {
                  waterAbsorption: calculateWaterAbsorption(
                    key === "dryWeight" ? value : row.dryWeight,
                    key === "wetWeight" ? value : row.wetWeight,
                  ),
                }
              : {}),
          }
        : row
    )));
  };

  const insertTestRow = (rowIndex: number) => {
    const newRow = createEmptyRow(nextRowId.current++);
    setTestRows(prev => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, newRow);
      return next;
    });
    requestAnimationFrame(() => rowInputRefs.current[newRow.id]?.focus());
  };

  const removeTestRow = (rowIndex: number) => {
    setTestRows(prev => prev.length === 1 ? prev : prev.filter((_, index) => index !== rowIndex));
  };

  const handleTestRowKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    insertTestRow(rowIndex);
  };

  const getDynamicFields = () => {
    switch (testType) {
      case TestType.Ready_Mix:
        return [
          { key: "slump", label: "Slump (mm)", type: "number" },
          { key: "temperature", label: "Temperature (°C)", type: "number" }
        ];
      case TestType.Blocks:
        return [
          { key: "machine", label: "Machine", type: "text" }
        ];
      case TestType.Paving_Blocks:
        return [
          { key: "weight", label: "Weight (kg)", type: "number" },
          { key: "length", label: "Length (mm)", type: "number" },
          { key: "width", label: "Width (mm)", type: "number" },
          { key: "height", label: "Height (mm)", type: "number" },
          { key: "compressiveStrength", label: "Compressive Strength (N/mm²)", type: "number" }
        ];
      case TestType.Sand_Sieve:
      case TestType.Aggregate_Sieve:
        return [];
      default:
        return [
          { key: "observation1", label: "Observation 1", type: "text" },
          { key: "observation2", label: "Observation 2", type: "text" }
        ];
    }
  };

  const matchingStrengthStandards = useMemo(() => {
    if (testType !== TestType.Ready_Mix && testType !== TestType.Blocks) return [];
    const normalizedMaterial = material.trim().toLocaleLowerCase();
    return (strengthStandards ?? [])
      .filter((standard) => (
        standard.testType === testType &&
        standard.material.trim().toLocaleLowerCase() === normalizedMaterial &&
        (testType !== TestType.Blocks ||
          (standard.blockType?.trim().toLocaleLowerCase() === String(details.blockType ?? "").trim().toLocaleLowerCase() &&
            standard.blockSize?.trim().toLocaleLowerCase() === String(details.blockSize ?? "").trim().toLocaleLowerCase()))
      ))
      .sort((left, right) => left.id - right.id);
  }, [details.blockSize, details.blockType, material, strengthStandards, testType]);

  const applicableStandard =
    matchingStrengthStandards.find((standard) => String(standard.id) === selectedStrengthStandardId) ??
    matchingStrengthStandards[0];

  const applicableSieveStandards = useMemo(() => {
    if (!usesSieveRows) return [];
    const materialReferenceItemId = Number(details.materialReferenceItemId);
    const normalizedMaterial = material.trim().toLocaleLowerCase();
    return (sieveStandards ?? []).filter((standard) => (
      standard.testType === testType &&
      (
        Number.isInteger(materialReferenceItemId) &&
        materialReferenceItemId > 0
          ? standard.materialReferenceItemId === materialReferenceItemId
          : standard.material.trim().toLocaleLowerCase() === normalizedMaterial
      )
    ));
  }, [details.materialReferenceItemId, material, sieveStandards, testType, usesSieveRows]);

  const sieveEntryItems = useMemo(() => {
    const itemsById = new Map<number, { id: number; value: string }>();
    sieveSizeReferenceItems.forEach((item) => itemsById.set(item.id, item));
    applicableSieveStandards.forEach((standard) => {
      if (!itemsById.has(standard.sieveSizeReferenceItemId)) {
        itemsById.set(standard.sieveSizeReferenceItemId, {
          id: standard.sieveSizeReferenceItemId,
          value: standard.sieveSize,
        });
      }
    });
    return Array.from(itemsById.values()).sort(
      (a, b) => sieveSizeNumber(b.value) - sieveSizeNumber(a.value),
    );
  }, [applicableSieveStandards, sieveSizeReferenceItems]);

  const sieveContextKey = `${testType}|${String(details.materialReferenceItemId ?? material.trim())}`;

  useEffect(() => {
    if (
      !usesSieveRows ||
      !material.trim() ||
      (isEditing && initializedRecordId.current !== recordId)
    ) return;
    if (sieveContextKeyRef.current === sieveContextKey && sieveEntryItems.length === 0) return;
    const contextChanged = sieveContextKeyRef.current !== sieveContextKey;
    sieveContextKeyRef.current = sieveContextKey;
    setTestRows((previousRows) => {
      const rowsBySize = new Map(
        contextChanged
          ? []
          : previousRows.map((row) => [
              row.sieveSizeReferenceItemId ?? sieveSizeReferenceItems.find((item) => item.value === row.sieveSize)?.id ?? 0,
              row,
            ]),
      );
      const standardsBySize = new Map(
        applicableSieveStandards.map((standard) => [standard.sieveSizeReferenceItemId, standard]),
      );
      const nextRows: TestRow[] = sieveEntryItems.map((item) => {
        const savedRow = rowsBySize.get(item.id);
        return savedRow
          ? { ...savedRow, sieveSize: item.value, sieveSizeReferenceItemId: item.id }
          : {
              ...createEmptyRow(nextRowId.current++),
              sieveSize: item.value,
              sieveSizeReferenceItemId: item.id,
            };
      });
      if (!contextChanged) {
        const matchedStandardSizes = new Set(nextRows.map((row) => row.sieveSizeReferenceItemId));
        previousRows.forEach((row) => {
          const sizeId = row.sieveSizeReferenceItemId ??
            sieveSizeReferenceItems.find((item) => item.value === row.sieveSize)?.id ??
            null;
          const hasSavedValue = Boolean(
            row.sieveSize ||
            row.amountReturned ||
            row.passingAmount ||
            row.passingPercentage,
          );
          if (hasSavedValue && (!sizeId || !matchedStandardSizes.has(sizeId))) {
            nextRows.push(row);
          }
        });
      }
      return nextRows.length ? nextRows : [createEmptyRow(nextRowId.current++)];
    });
  }, [
    applicableSieveStandards,
    isEditing,
    material,
    recordId,
    sieveContextKey,
    sieveEntryItems,
    sieveSizeReferenceItems,
    testType,
    usesSieveRows,
  ]);

  const calculateStrength = (row: TestRow) => {
    const load = Number(row.load);
    const length = Number(row.length);
    const width = Number(row.width);
    if (![load, length, width].every(Number.isFinite) || load < 0 || length <= 0 || width <= 0) {
      return null;
    }
    return ((load * 1000) / (length * width)).toFixed(2);
  };

  const calculateSieveResult = (row: Pick<TestRow, "amountReturned">) => {
    const sampleWeight = Number(details.sampleWeight);
    const amountReturned = Number(row.amountReturned);
    if (
      !Number.isFinite(sampleWeight) ||
      sampleWeight <= 0 ||
      !Number.isFinite(amountReturned)
    ) {
      return { passingAmount: "", passingPercentage: "" };
    }
    const passingAmount = sampleWeight - amountReturned;
    return {
      passingAmount: passingAmount.toFixed(2),
      passingPercentage: ((passingAmount / sampleWeight) * 100).toFixed(2),
    };
  };

  const getMaterialSuggestions = () => {
    if (!lookups) return [];
    switch (testType) {
      case TestType.Ready_Mix:
      case TestType.RMX_Trial:
        return lookups.mixStrengths || [];
      case TestType.Blocks:
      case TestType.Paving_Blocks:
        return Array.from(new Set([...(lookups.blockTypes || []), ...(lookups.blockSizes || [])]));
      case TestType.Sand_Sieve:
        return lookups.materials.filter((value) => /sand|dust/i.test(value));
      case TestType.Aggregate_Sieve:
      case TestType["Flakiness_&_Elongation"]:
        return lookups.materials.filter((value) => /aggregate/i.test(value));
      case TestType.Water:
        return lookups.materials.filter((value) => /water/i.test(value));
      default:
        return lookups.materials || [];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationValue || !material || !testedBy) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (
      testType === TestType.Ready_Mix &&
      referenceNumber.length > REFERENCE_NUMBER_MAX_LENGTH
    ) {
      toast.error(`Reference Number must be ${REFERENCE_NUMBER_MAX_LENGTH} characters or fewer.`);
      return;
    }

    let payloadDetails: Record<string, unknown> = { ...details };

    if (usesSieveRows) {
      const materialReferenceItemId = materialReferenceItems.find(
        (item) => item.value.trim().toLocaleLowerCase() === material.trim().toLocaleLowerCase(),
      )?.id;
      if (materialReferenceItemId) {
        payloadDetails.materialReferenceItemId = materialReferenceItemId;
      }
      payloadDetails.sieveRows = testRows.map(({ id: _id, ...row }, index) => {
        const calculated = calculateSieveResult(row);
        return {
          rowNo: index + 1,
          sieveSize: row.sieveSize,
          sieveSizeReferenceItemId: row.sieveSizeReferenceItemId ??
            sieveSizeReferenceItems.find((item) => item.value === row.sieveSize)?.id ??
            null,
           ...(row.amountReturned.trim() ? { amountReturned: row.amountReturned } : {}),
          passingAmount: calculated.passingAmount || row.passingAmount,
          passingPercentage: calculated.passingPercentage || row.passingPercentage,
        };
      });
    }

    if (testType === TestType.Ready_Mix) {
      payloadDetails.customerName = customerName;
      payloadDetails.customerLocation = customerLocation;
      payloadDetails.referenceNumber = referenceNumber.trim();
    }
    if (testType === TestType.Ready_Mix || testType === TestType.Blocks) {
      if (applicableStandard) payloadDetails.strengthStandardId = applicableStandard.id;
      else delete payloadDetails.strengthStandardId;
    }
    if (testType === TestType.Blocks) {
      payloadDetails.machine = machine;
    }

    if (usesTestRows) {
      payloadDetails.testRows = testRows.map(({ id: _id, ...row }, index) => ({
        rowNo: index + 1,
        ...(testType === TestType.Ready_Mix
          ? { testAge: row.testAge }
          : { sampleAge: row.sampleAge }),
        length: row.length,
        width: row.width,
        height: row.height,
        dryWeight: row.dryWeight,
        wetWeight: row.wetWeight,
        ...(testType === TestType.Ready_Mix
          ? {
              load: row.load,
              waterAbsorption: calculateWaterAbsorption(row.dryWeight, row.wetWeight),
            }
          : { load: row.load }),
      }));
    }

    const payload: QcRecordInput = {
      testType,
      sampleDate: new Date(sampleDate).toISOString(),
      location: locationValue,
      material,
      status: RecordStatus.Review, 
      testedBy,
      remarks,
      details: payloadDetails
    };

    if (isEditing && recordId > 0) {
      const updatePayload: QcRecordUpdate = payload;
      updateRecord.mutate({ id: recordId, data: updatePayload }, {
        onSuccess: (updatedRecord) => {
          toast.success(`Record ${updatedRecord.recordNo} has been updated.`);
          queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(recordId) });
          setLocation(`/records/${updatedRecord.id}`);
        },
        onError: () => {
          toast.error("Failed to update record. Please try again.");
        },
      });
      return;
    }

    createRecord.mutate({ data: payload }, {
      onSuccess: (newRecord) => {
        toast.success(`Record ${newRecord.recordNo} has been saved.`);
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setLocation(`/records/${newRecord.id}`);
      },
      onError: () => {
        toast.error("Failed to create record. Please try again.");
      },
    });
  };

  if (lookupsLoading || ((isEditing || isDuplicating) && recordLoading)) {
    return <div className="p-8 text-center text-muted-foreground">Loading form data...</div>;
  }

  if ((isEditing || isDuplicating) && (recordError || !existingRecord)) {
    return <div className="p-8 text-center text-destructive">Failed to load the record for editing.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link href={isEditing ? `/records/${recordId}` : "/records"} className="p-2 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isEditing ? "Edit QC Record" : "New QC Record"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isEditing
              ? "Update the saved sample details and measurements."
              : "Enter test measurements and details for quality assurance."}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
          }
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="md:col-span-2 border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Basic details about the sample and test context.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Test Type <span className="text-destructive">*</span></Label>
                <Select value={testType} onValueChange={(val: TestType) => {
                  setTestType(val);
                  setDetails({});
                  setSelectedStrengthStandardId("");
                  setTestRows([createEmptyRow(1)]);
                  nextRowId.current = 2;
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Test Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TestType).map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sample Date <span className="text-destructive">*</span></Label>
                <Input 
                  type="date" 
                  value={sampleDate} 
                  onChange={e => setSampleDate(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Plant / Production Location <span className="text-destructive">*</span></Label>
                <TypeaheadInput
                  value={locationValue}
                  onChange={setLocationValue}
                  options={lookups?.locations || []}
                  placeholder="Select or type location..."
                />
              </div>

              <div className="space-y-2">
                <Label>Material / Product <span className="text-destructive">*</span></Label>
                <TypeaheadInput
                  value={material}
                  onChange={setMaterial}
                  options={getMaterialSuggestions()}
                  placeholder="Select or type material..."
                />
              </div>

              {(testType === TestType.Ready_Mix || testType === TestType.Blocks) && (
                <div className="space-y-2">
                  <Label>Evaluation / Report Standard</Label>
                  <select
                    value={selectedStrengthStandardId}
                    onChange={(event) => setSelectedStrengthStandardId(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    disabled={!matchingStrengthStandards.length}
                  >
                    <option value="">Automatic first matching standard</option>
                    {matchingStrengthStandards.map((standard) => (
                      <option key={standard.id} value={standard.id}>
                        {standard.bsStandard} — {standard.requiredStrength} {standard.strengthUnit}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {matchingStrengthStandards.length
                      ? "This standard will be saved with the record and used for evaluation and reporting."
                      : "No matching standard is configured for this material yet."}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Tested By (Technician) <span className="text-destructive">*</span></Label>
                <TypeaheadInput
                  value={testedBy}
                  onChange={setTestedBy}
                  options={lookups?.employees || []}
                  placeholder="Select or type technician..."
                />
              </div>

              {testType === TestType.Ready_Mix && (
                <>
                  <div className="space-y-2">
                    <Label>Reference Number</Label>
                    <Input
                      value={referenceNumber}
                      onChange={(event) => setReferenceNumber(event.target.value)}
                      maxLength={REFERENCE_NUMBER_MAX_LENGTH}
                      placeholder="e.g. PO-1042"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use a short identifier, such as PO-1042 or SITE-A7.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Ready Mix Customer Name</Label>
                    <TypeaheadInput
                      value={customerName}
                      onChange={setCustomerName}
                      options={lookups?.customers || []}
                      placeholder="Select or type customer..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Location</Label>
                    <TypeaheadInput
                      value={customerLocation}
                      onChange={setCustomerLocation}
                      options={lookups?.customerLocations || []}
                      placeholder="Select or type location..."
                    />
                  </div>
                </>
              )}

              {testType === TestType.Blocks && (
                <>
                  <div className="space-y-2">
                    <Label>Block Type <span className="text-destructive">*</span></Label>
                    <TypeaheadInput
                      value={String(details.blockType ?? "")}
                      onChange={(value) => handleDetailChange("blockType", value)}
                      options={lookups?.blockTypes || []}
                      placeholder="Select or type block type..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Block Size <span className="text-destructive">*</span></Label>
                    <TypeaheadInput
                      value={String(details.blockSize ?? "")}
                      onChange={(value) => handleDetailChange("blockSize", value)}
                      options={lookups?.blockSizes || []}
                      placeholder="Select or type block size..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Machine</Label>
                    <Input
                      value={machine}
                      onChange={(event) => setMachine(event.target.value)}
                      placeholder="Enter block machine"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Measurement Details: {testType}</CardTitle>
              <CardDescription>
                {usesTestRows || usesSieveRows
                  ? "Enter one specimen per row. Press Enter in a row to insert the next numbered entry."
                  : "Enter the specific readings obtained during the test."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {testType === TestType.Ready_Mix && (
                <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Slump (mm)</Label>
                    <Input
                      type="number"
                      value={String(details.slump ?? "")}
                      onChange={event => handleDetailChange("slump", event.target.value)}
                      placeholder="Enter slump"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperature (°C)</Label>
                    <Input
                      type="number"
                      value={String(details.temperature ?? "")}
                      onChange={event => handleDetailChange("temperature", event.target.value)}
                      placeholder="Enter temperature"
                    />
                  </div>
                </div>
              )}
              {!usesTestRows && (
                <div className="mb-6 rounded-md border border-sky-500/25 bg-sky-500/[0.04] p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-foreground">Sample Weights</h3>
                    <p className="text-xs text-muted-foreground">
                      Record the total sample weight and the measured dry and wet weights.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                           ["sampleWeight", `Sample Weight (${usesSieveRows ? sieveMassUnit : "kg"})`],
                           ["dryWeight", `Dry Weight (${usesSieveRows ? sieveMassUnit : "kg"})`],
                           ["wetWeight", `Wet Weight (${usesSieveRows ? sieveMassUnit : "kg"})`],
                    ].map(([key, label]) => (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={String(details[key] ?? "")}
                          onChange={(event) => handleDetailChange(key, event.target.value)}
                          placeholder="Enter weight"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {usesTestRows || usesSieveRows ? (
                <div className="space-y-3">
                  {(testType === TestType.Ready_Mix || testType === TestType.Blocks) && (
                    <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
                      {applicableStandard ? (
                        <span>
                           Automatic evaluation: 28-day cubes are compared with{" "}
                          <strong>{applicableStandard.requiredStrength} {applicableStandard.strengthUnit}</strong>{" "}
                          under <strong>{applicableStandard.bsStandard}</strong>.
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Automatic evaluation will remain in Review until a matching strength standard is configured.
                        </span>
                      )}
                    </div>
                  )}
                  {usesSieveRows && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.04] px-4 py-3 text-sm">
                       {applicableSieveStandards.length ? (
                        <span>
                          Standard <strong>{Array.from(new Set(applicableSieveStandards.map((standard) => standard.standardReference))).join(", ")}</strong>{" "}
                           provides <strong>{applicableSieveStandards.length} sieve criteria</strong> for {material}. All {sieveEntryItems.length} sieve sizes from Reference Data are available below.
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                           No sieve standard is configured for {material || "this material"}. You can still enter retained amounts for all {sieveEntryItems.length} sieve sizes from Reference Data; the record will remain in Review until a standard is configured.{" "}
                          <Link href="/standards" className="font-semibold text-foreground underline underline-offset-2">
                            Configure Standards
                          </Link>{" "}
                          and make sure the material is linked in Reference Data.
                        </span>
                      )}
                    </div>
                  )}
                   {usesSieveRows && !sieveEntryItems.length ? null : <div className="overflow-x-auto rounded-md border">
                    <table className={`w-full ${usesSieveRows ? "min-w-[760px]" : "min-w-[1080px]"} text-sm`}>
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="w-12 px-3 py-3 text-left font-semibold">No.</th>
                          {usesSieveRows ? (
                            <th className="px-3 py-3 text-left font-semibold">Sieve / Pore Size</th>
                          ) : testType === TestType.Ready_Mix ? (
                            <th className="px-3 py-3 text-left font-semibold">Test Age</th>
                          ) : (
                            <th className="px-3 py-3 text-left font-semibold">Sample Age</th>
                          )}
                          {usesSieveRows ? (
                            <>
                              <th className="px-3 py-3 text-left font-semibold">Standard</th>
                               <th className="px-3 py-3 text-left font-semibold">Amount Returned (g) <span className="font-normal text-muted-foreground">(optional)</span></th>
                               <th className="px-3 py-3 text-left font-semibold">Amount Passing (g)</th>
                              <th className="px-3 py-3 text-left font-semibold">% Passing</th>
                            </>
                          ) : (
                            <>
                              <th className="px-3 py-3 text-left font-semibold">Length (mm)</th>
                              <th className="px-3 py-3 text-left font-semibold">Width (mm)</th>
                              <th className="px-3 py-3 text-left font-semibold">Height (mm)</th>
                              <th className="px-3 py-3 text-left font-semibold">Dry Weight</th>
                              <th className="px-3 py-3 text-left font-semibold">Wet Weight</th>
                               {testType === TestType.Ready_Mix && (
                                 <th className="px-3 py-3 text-left font-semibold">Water Absorption</th>
                               )}
                            </>
                          )}
                           {(testType === TestType.Ready_Mix || testType === TestType.Blocks) && (
                             <>
                               <th className="px-3 py-3 text-left font-semibold">Load (kN)</th>
                               <th className="px-3 py-3 text-left font-semibold">Calculated Strength</th>
                             </>
                           )}
                          <th className="w-20 px-3 py-3 text-left font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testRows.map((row, rowIndex) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-semibold text-muted-foreground">{rowIndex + 1}</td>
                            {usesSieveRows ? (
                              <>
                                <td className="px-3 py-2 font-medium">
                                  {row.sieveSize || "Configured sieve size"}
                                </td>
                                <td className="px-2 py-2">
                                  {(() => {
                                    const standard = applicableSieveStandards.find(
                                      (candidate) => candidate.sieveSizeReferenceItemId === row.sieveSizeReferenceItemId,
                                    );
                                    return standard ? (
                                      <div className="space-y-1 text-xs">
                                        <div className="font-semibold">{standard.standardReference}</div>
                                        <div className="text-muted-foreground">
                                          {standard.minimum == null ? "—" : standard.minimum} to{" "}
                                          {standard.maximum == null ? "—" : standard.maximum} {standard.unit}
                                        </div>
                                      </div>
                                    ) : "—";
                                  })()}
                                </td>
                                <td className="px-2 py-2">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={row.amountReturned}
                                    onChange={event => {
                                      const nextRow = { ...row, amountReturned: event.target.value };
                                      const result = calculateSieveResult(nextRow);
                                      setTestRows((previous) => previous.map((candidate, index) => (
                                        index === rowIndex
                                          ? { ...nextRow, ...result }
                                          : candidate
                                      )));
                                    }}
                                     placeholder="Optional"
                                     aria-required="false"
                                    aria-label={`Amount returned for row ${rowIndex + 1}`}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground">
                                     {row.passingAmount ? `${row.passingAmount} g` : "—"}
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground">
                                    {row.passingPercentage ? `${row.passingPercentage}%` : "—"}
                                  </div>
                                </td>
                              </>
                            ) : (
                            <>
                            <td className="px-2 py-2">
                              <Input
                                ref={element => {
                                  rowInputRefs.current[row.id] = element;
                                }}
                                type="text"
                                inputMode="numeric"
                                value={testType === TestType.Ready_Mix ? row.testAge : row.sampleAge}
                                onChange={event => updateTestRow(rowIndex, testType === TestType.Ready_Mix ? "testAge" : "sampleAge", event.target.value)}
                                onKeyDown={event => handleTestRowKeyDown(event, rowIndex)}
                                placeholder="Days"
                                aria-label={`${testType === TestType.Ready_Mix ? "Test" : "Sample"} age for row ${rowIndex + 1}`}
                              />
                            </td>
                            {(["length", "width", "height", "dryWeight", "wetWeight"] as const).map(key => (
                              <td key={key} className="px-2 py-2">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row[key]}
                                  onChange={event => updateTestRow(rowIndex, key, event.target.value)}
                                  onKeyDown={event => handleTestRowKeyDown(event, rowIndex)}
                                  placeholder={key === "dryWeight" || key === "wetWeight" ? "kg" : "mm"}
                                  aria-label={`${key} for row ${rowIndex + 1}`}
                                />
                              </td>
                            ))}
                             {testType === TestType.Ready_Mix && (
                               <td className="px-2 py-2">
                                  <div
                                    className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground"
                                    aria-label={`Calculated water absorption for row ${rowIndex + 1}`}
                                  >
                                    {row.waterAbsorption ? `${row.waterAbsorption}%` : "—"}
                                  </div>
                               </td>
                             )}
                            </>
                            )}
                             {(testType === TestType.Ready_Mix || testType === TestType.Blocks) && (
                              <>
                                <td className="px-2 py-2">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={row.load}
                                    onChange={event => updateTestRow(rowIndex, "load", event.target.value)}
                                    onKeyDown={event => handleTestRowKeyDown(event, rowIndex)}
                                    placeholder="kN"
                                    aria-label={`Load for row ${rowIndex + 1}`}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                   <div
                                     className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground"
                                     aria-label={`Calculated strength for row ${rowIndex + 1}`}
                                   >
                                     {calculateStrength(row) ? `${calculateStrength(row)} N/mm²` : "Enter load and dimensions"}
                                   </div>
                                </td>
                              </>
                            )}
                            <td className="px-2 py-2">
                              {usesSieveRows ? (
                                <span className="text-xs text-muted-foreground">From standard</span>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTestRow(rowIndex)}
                                  disabled={testRows.length === 1}
                                >
                                  Remove
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
                  {!usesSieveRows && (
                    <>
                      <Button type="button" variant="outline" onClick={() => insertTestRow(testRows.length - 1)}>
                        + Add row
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Pressing Enter adds a new numbered row after the current row.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getDynamicFields().map(field => (
                    <div key={field.key} className="space-y-2">
                      <Label>{field.label}</Label>
                      <Input
                        type={field.type}
                        value={String(details[field.key] ?? "")}
                        onChange={e => handleDetailChange(field.key, e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label>Remarks / Observations</Label>
                <Textarea 
                  placeholder="Enter any abnormalities, weather conditions, or extra notes..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t px-6 py-4 flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {testType === TestType.Ready_Mix || testType === TestType.Blocks
                  ? "Ready Mix and Blocks statuses are calculated from the configured standard and specimen measurements."
                  : "New records are created in 'Review' status pending supervisor approval."}
              </p>
               <Button type="submit" disabled={createRecord.isPending || updateRecord.isPending} size="lg">
                 {createRecord.isPending || updateRecord.isPending
                   ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                   : <Save className="w-4 h-4 mr-2" />}
                 {isEditing ? "Update Record" : "Save Record"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { getGetDashboardQueryKey, getGetLookupsQueryKey, getGetRecordQueryKey, getGetReferenceDataQueryKey, getGetReportQueryKey, getListRecordsQueryKey, useCreateRecord, useCreateReferenceItem, useGetLookups, useGetReferenceData, useGetRecord, useListSieveStandards, useListShapeFactors, useListStrengthStandards, useUpdateRecord, TestType, RecordStatus, QcRecordInput, QcRecordUpdate } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Save, ArrowLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@workspace/replit-auth-web";
import { Link } from "wouter";
import { useAppBack } from "@/hooks/use-app-back";
import { TypeaheadInput } from "@/components/ui/typeahead-input";
import {
  AGGREGATE_CHEMISTRY_FIELDS,
  calculateWaterAbsorption,
  calculateBlockDensity,
  calculateBlockStrengths,
  calculatePavingStrengths,
  blockDimensionsFromSize,
  blockSizeMatches,
  blockTypeMatches,
  createEmptyRow,
  calculateSieveSampleWeight,
  calculateSieveResults,
  applySizeDimensionDefaults,
  BLOCK_RECORD_MATERIAL,
  prepareDetailsForForm,
  sieveSizeNumber,
  stringValue,
  toFormRow,
  numericInputValue,
  pavingCorrectionFactorFromSize,
  type TestRow,
} from "./record-form-utils";
import { EMPLOYEE_ADDABLE_REFERENCE_CATEGORIES } from "./reference-data-permissions";

const REFERENCE_NUMBER_MAX_LENGTH = 32;
const DEFAULT_APPROVED_BY = "ADEL ABBAS EBRAHIM";

export default function RecordForm() {
  const { id } = useParams();
  const recordId = id ? Number(id) : 0;
  const isEditing = Number.isInteger(recordId) && recordId > 0;
  const [, setLocation] = useLocation();
  const fallbackRoute = isEditing ? `/records/${recordId}` : "/records";
  const goBack = useAppBack(fallbackRoute);
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const canEditApprovedBy = role === "administrator";
  const canEditReferenceData = role === "administrator";
  const queryClient = useQueryClient();
  
  const { data: lookups, isLoading: lookupsLoading } = useGetLookups();
  const { data: referenceData } = useGetReferenceData();
  const createReferenceItem = useCreateReferenceItem();
  const {
    data: existingRecord,
    isLoading: recordLoading,
    isError: recordError,
  } = useGetRecord(recordId, {
    query: {
      queryKey: getGetRecordQueryKey(recordId),
      enabled: isEditing,
    },
  });
  const { data: strengthStandards } = useListStrengthStandards();
  const { data: shapeFactors } = useListShapeFactors();
  const { data: sieveStandards } = useListSieveStandards();
  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const initializedRecordId = useRef<number | null>(null);
  const submitAction = useRef<"save" | "duplicate">("save");
  const formRef = useRef<HTMLFormElement | null>(null);

  const [testType, setTestType] = useState<TestType>(TestType.Ready_Mix);
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationValue, setLocationValue] = useState("");
  const [material, setMaterial] = useState("");
  const [testedBy, setTestedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState(DEFAULT_APPROVED_BY);
  const [machine, setMachine] = useState("");
  const [blockAge, setBlockAge] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedStrengthStandardId, setSelectedStrengthStandardId] = useState("");
  const [strengthStandardMode, setStrengthStandardMode] = useState<"automatic" | "manual">("automatic");
  
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [testRows, setTestRows] = useState<TestRow[]>([createEmptyRow(1)]);
  const nextRowId = useRef(2);
  const rowInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const sieveContextKeyRef = useRef("");
  const previousBlockSizeRef = useRef("");
  const previousPavingSizeRef = useRef("");
  const previousShapeFactorRef = useRef("");
  const previousCorrectionFactorRef = useRef("");

  const addReferenceDataItem = async (categoryKey: string, value: string) => {
    const category = referenceData?.categories.find((item) => item.key === categoryKey);
    if (!category) {
      toast.error("This Reference Data category is not available.");
      throw new Error(`Reference Data category "${categoryKey}" is not available.`);
    }

    try {
      const createdItem = await createReferenceItem.mutateAsync({
        categoryId: category.id,
        data: { value },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetReferenceDataQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetLookupsQueryKey() }),
      ]);
      toast.success(`Added “${createdItem.value}” to Reference Data.`);
      return createdItem.value;
    } catch {
      toast.error("That value could not be added to Reference Data.");
      throw new Error("Reference Data value could not be added.");
    }
  };

  const createReferenceOption = (categoryKey?: string) => {
    const canAddCategory =
      canEditReferenceData ||
      (Boolean(role) &&
        categoryKey !== undefined &&
        EMPLOYEE_ADDABLE_REFERENCE_CATEGORIES.has(categoryKey));
    return canAddCategory && categoryKey
      ? (value: string) => addReferenceDataItem(categoryKey, value)
      : undefined;
  };

  useEffect(() => {
    if (!isEditing || !existingRecord || initializedRecordId.current === recordId) return;

    const { details: savedDetails, sourceRows: savedRows } = prepareDetailsForForm(existingRecord.details);

    setTestType(existingRecord.testType);
    setSampleDate(existingRecord.sampleDate.slice(0, 10));
    setLocationValue(existingRecord.location);
    setMaterial(existingRecord.material);
    setTestedBy(existingRecord.testedBy);
    setReviewedBy(existingRecord.reviewedBy || DEFAULT_APPROVED_BY);
    setRemarks(existingRecord.remarks ?? "");
    setReferenceNumber(stringValue(savedDetails.referenceNumber));
    setCustomerName(stringValue(savedDetails.customerName));
    setCustomerLocation(stringValue(savedDetails.customerLocation));
    setMachine(stringValue(savedDetails.machine));
    const legacyBlockAgeRow = savedRows.find(
      (row) => typeof row === "object" && row !== null && "sampleAge" in row,
    );
    const legacyBlockAge = legacyBlockAgeRow && typeof legacyBlockAgeRow === "object"
      ? (legacyBlockAgeRow as Record<string, unknown>).sampleAge
      : "";
    setBlockAge(numericInputValue(savedDetails.blockAge ?? legacyBlockAge));
    const savedStandardId = stringValue(savedDetails.strengthStandardId);
    const savedAssignmentMode = stringValue(savedDetails.strengthStandardAssignmentMode);
    setSelectedStrengthStandardId(savedStandardId);
    setStrengthStandardMode(
      savedAssignmentMode === "manual" || (!savedAssignmentMode && savedStandardId)
        ? "manual"
        : "automatic",
    );
    setDetails(savedDetails);
    const loadedSourceRows =
      savedRows.length
        ? savedRows
        : existingRecord.testType === TestType.Paving_Blocks
          ? [savedDetails]
          : [];
    const loadedRows = loadedSourceRows.length
      ? loadedSourceRows.map((row, index) => toFormRow(row, index + 1))
      : [createEmptyRow(1)];
    const calculatedRows = existingRecord.testType === TestType.Sand_Sieve ||
      existingRecord.testType === TestType.Aggregate_Sieve
      ? calculateSieveResults(loadedRows)
      : [];
    setTestRows(loadedRows.map((row, index) => ({
      ...row,
      ...(calculatedRows[index] ?? {}),
    })));
    sieveContextKeyRef.current = `${existingRecord.testType}|${String(savedDetails.materialReferenceItemId ?? existingRecord.material)}`;
    nextRowId.current = Math.max(loadedSourceRows.length + 1, 2);
    initializedRecordId.current = recordId;
  }, [existingRecord, isEditing, recordId]);

  const usesTestRows =
    testType === TestType.Ready_Mix ||
    testType === TestType.Blocks ||
    testType === TestType.Paving_Blocks;
  const usesSieveRows = testType === TestType.Sand_Sieve || testType === TestType.Aggregate_Sieve;

  const handleDetailChange = (key: string, value: string) => {
    setDetails(prev => ({ ...prev, [key]: value }));
  };

  const sieveMassUnit = "g";
  const blockDimensions = blockDimensionsFromSize(details.blockSize);
  const calculatedSieveSampleWeight = usesSieveRows
    ? calculateSieveSampleWeight(testRows)
    : null;

  useEffect(() => {
    if (testType !== TestType.Blocks) {
      previousBlockSizeRef.current = "";
      return;
    }

    const nextBlockSize = String(details.blockSize ?? "").trim();
    const nextDimensions = blockDimensionsFromSize(nextBlockSize);
    const previousDimensions = blockDimensionsFromSize(previousBlockSizeRef.current);
    previousBlockSizeRef.current = nextBlockSize;
    if (!nextDimensions) return;

    setTestRows((previousRows) =>
      previousRows.map((row) =>
        applySizeDimensionDefaults(
          row,
          nextDimensions,
          previousDimensions,
        ),
      ),
    );
  }, [details.blockSize, testType]);

  useEffect(() => {
    if (testType !== TestType.Paving_Blocks) {
      previousPavingSizeRef.current = "";
      return;
    }

    const nextSize = String(details.pavingBlockSize ?? "").trim();
    const nextDimensions = blockDimensionsFromSize(nextSize);
    const previousDimensions = blockDimensionsFromSize(previousPavingSizeRef.current);
    previousPavingSizeRef.current = nextSize;
    if (!nextDimensions) return;

    setTestRows((previousRows) =>
      previousRows.map((row) =>
        applySizeDimensionDefaults(
          row,
          nextDimensions,
          previousDimensions,
        ),
      ),
    );
  }, [details.pavingBlockSize, testType]);

  useEffect(() => {
    if (testType !== TestType.Blocks) {
      previousShapeFactorRef.current = "";
      return;
    }
    const blockSize = String(details.blockSize ?? "").trim();
    const configuredShapeFactor = shapeFactors?.find((shapeFactor) =>
      blockSizeMatches(shapeFactor.blockSize, blockSize),
    );
    const nextDefault =
      configuredShapeFactor?.shapeFactor == null
        ? ""
        : String(configuredShapeFactor.shapeFactor);
    const currentValue = String(details.shapeFactor ?? "").trim();
    const previousDefault = previousShapeFactorRef.current;
    if (!currentValue || currentValue === previousDefault) {
      setDetails((current) => {
        const next = { ...current };
        if (nextDefault) next.shapeFactor = nextDefault;
        else delete next.shapeFactor;
        return next;
      });
    }
    previousShapeFactorRef.current = nextDefault;
  }, [details.blockSize, shapeFactors, testType]);

  useEffect(() => {
    if (testType !== TestType.Paving_Blocks) {
      previousCorrectionFactorRef.current = "";
      return;
    }
    const blockSize = String(details.pavingBlockSize ?? "").trim();
    const configuredFactor = shapeFactors?.find(
      (factor) => factor.blockSize.trim().toLocaleLowerCase() === blockSize.toLocaleLowerCase(),
    )?.correctionFactor;
    const nextDefault =
      configuredFactor == null
        ? pavingCorrectionFactorFromSize(blockSize)
        : String(configuredFactor);
    const currentValue = String(details.correctionFactor ?? "").trim();
    const previousDefault = previousCorrectionFactorRef.current;
    if (!currentValue || currentValue === previousDefault) {
      setDetails((current) => {
        const next = { ...current };
        if (nextDefault) next.correctionFactor = nextDefault;
        else delete next.correctionFactor;
        return next;
      });
    }
    previousCorrectionFactorRef.current = nextDefault;
  }, [details.correctionFactor, details.pavingBlockSize, shapeFactors, testType]);

  const materialReferenceItems = useMemo(
    () => referenceData?.categories.find((category) => category.key === "materials")?.items ?? [],
    [referenceData],
  );
  const sieveSizeReferenceItems = useMemo(
    () => referenceData?.categories.find((category) => category.key === "sieveSizes")?.items ?? [],
    [referenceData],
  );
  const sampleTypeOptions = useMemo(
    () => referenceData?.categories.find((category) => category.key === "sampleTypes")?.items.map((item) => item.value) ?? [],
    [referenceData],
  );
  const conditioningMethodOptions = useMemo(
    () => referenceData?.categories.find((category) => category.key === "conditioningMethods")?.items.map((item) => item.value) ?? [],
    [referenceData],
  );
  const preparationMethodOptions = useMemo(
    () => referenceData?.categories.find((category) => category.key === "preparationMethods")?.items.map((item) => item.value) ?? [],
    [referenceData],
  );

  useEffect(() => {
    if (testType !== TestType.Blocks) return;
    const sampleType = sampleTypeOptions.includes("CUBER")
      ? "CUBER"
      : sampleTypeOptions[0] ?? "";
    const conditioningMethod = conditioningMethodOptions[0] ?? "";
    const preparationMethod = preparationMethodOptions[0] ?? "";
    if (!sampleType && !conditioningMethod && !preparationMethod) return;
    setDetails((current) => ({
      ...current,
      ...(String(current.sampleType ?? "").trim() || !sampleType
        ? {}
        : { sampleType }),
      ...(String(current.conditioningMethod ?? "").trim() || !conditioningMethod
        ? {}
        : { conditioningMethod }),
      ...(String(current.preparationMethod ?? "").trim() || !preparationMethod
        ? {}
        : { preparationMethod }),
    }));
  }, [
    conditioningMethodOptions,
    preparationMethodOptions,
    sampleTypeOptions,
    testType,
  ]);

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
    if (
      testType !== TestType.Ready_Mix &&
      testType !== TestType.Blocks &&
      testType !== TestType.Paving_Blocks
    ) return [];
    const normalizedMaterial = material.trim().toLocaleLowerCase();
    const selectedPavingSize = String(details.pavingBlockSize ?? "").trim();
    return (strengthStandards ?? [])
      .filter((standard) => {
        if (standard.testType !== testType) return false;
        if (testType === TestType.Blocks) {
          return blockTypeMatches(standard.blockType, details.blockType) &&
            blockSizeMatches(standard.blockSize, details.blockSize);
        }
        if (standard.material.trim().toLocaleLowerCase() !== normalizedMaterial) {
          return false;
        }
        return testType !== TestType.Paving_Blocks ||
          !standard.blockSize ||
          blockSizeMatches(standard.blockSize, selectedPavingSize);
      })
      .sort((left, right) => left.id - right.id);
  }, [
    details.blockSize,
    details.blockType,
    details.pavingBlockSize,
    material,
    strengthStandards,
    testType,
  ]);

  const applicableStandard =
    matchingStrengthStandards.find((standard) => String(standard.id) === selectedStrengthStandardId) ??
    matchingStrengthStandards[0];

  useEffect(() => {
    if (
      testType !== TestType.Ready_Mix &&
      testType !== TestType.Blocks &&
      testType !== TestType.Paving_Blocks
    ) return;
    const selectedStillMatches = matchingStrengthStandards.some(
      (standard) => String(standard.id) === selectedStrengthStandardId,
    );
    if (
      testType === TestType.Blocks &&
      strengthStandardMode === "manual" &&
      selectedStrengthStandardId &&
      !selectedStillMatches
    ) {
      setStrengthStandardMode("automatic");
    }
    const nextStandardId = selectedStillMatches
      ? selectedStrengthStandardId
      : matchingStrengthStandards[0]
        ? String(matchingStrengthStandards[0].id)
        : "";
    if (nextStandardId !== selectedStrengthStandardId) {
      setSelectedStrengthStandardId(nextStandardId);
    }
  }, [matchingStrengthStandards, selectedStrengthStandardId, strengthStandardMode, testType]);

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

  const calculateStrength = (row: Pick<TestRow, "length" | "width" | "load">) =>
    calculateBlockStrengths(row, details.shapeFactor, locationValue);
  const calculatePavingStrength = (
    row: Pick<
      TestRow,
      "length" | "height" | "load" | "compressiveStrength" | "tensileStrength"
    >,
  ) => calculatePavingStrengths(row, details.correctionFactor);

  const measurementKeys: Array<keyof Omit<TestRow, "id">> =
    testType === TestType.Ready_Mix
      ? ["length", "width", "height", "dryWeight", "wetWeight"]
      : testType === TestType.Blocks
        ? ["length", "width", "height"]
        : testType === TestType.Paving_Blocks
          ? ["length", "width", "height", "dryWeight", "wetWeight"]
          : ["length", "width", "height", "weight"];
  const isCompactBlockTable = testType === TestType.Blocks;
  const compactBlockCellClass = isCompactBlockTable
    ? "px-1 py-1.5 text-[11px] leading-tight"
    : "px-2 py-2";
  const compactBlockInputClass = isCompactBlockTable
    ? "h-8 min-w-0 px-1.5 text-[11px]"
    : undefined;

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

  const getMaterialReferenceCategory = () => {
    switch (testType) {
      case TestType.Ready_Mix:
      case TestType.RMX_Trial:
        return "mixStrengths";
      case TestType.Blocks:
      case TestType.Paving_Blocks:
        return undefined;
      default:
        return "materials";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const requestedAction = submitAction.current;
    submitAction.current = "save";
    if (!locationValue || (testType !== TestType.Blocks && !material) || !testedBy) {
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
    if (
      testType === TestType.Blocks &&
      (!stringValue(details.blockType).trim() ||
        !stringValue(details.blockSize).trim())
    ) {
      toast.error("Please select a Block Type and Block Size.");
      return;
    }
    if (
      testType === TestType.Blocks &&
      (!blockAge.trim() || !Number.isFinite(Number(blockAge)) || Number(blockAge) <= 0)
    ) {
      toast.error("Please enter a valid Block age in days.");
      return;
    }
    if (testType === TestType.Paving_Blocks && !String(details.pavingBlockSize ?? "").trim()) {
      toast.error("Please enter the paving block size.");
      return;
    }
    if (
      testType === TestType.Aggregate_Sieve &&
      !stringValue(details.materialCondition).trim()
    ) {
      toast.error("Please select the Aggregate material condition.");
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
      const calculatedRows = calculateSieveResults(testRows);
      payloadDetails.sampleWeight = calculatedSieveSampleWeight;
      payloadDetails.sieveRows = testRows.map(({ id: _id, ...row }, index) => {
        const calculated = calculatedRows[index];
        return {
          rowNo: index + 1,
          sieveSize: row.sieveSize,
          sieveSizeReferenceItemId: row.sieveSizeReferenceItemId ??
            sieveSizeReferenceItems.find((item) => item.value === row.sieveSize)?.id ??
            null,
           ...(row.amountReturned.trim() ? { amountReturned: row.amountReturned } : {}),
          ...(calculated.passingAmount ? { passingAmount: calculated.passingAmount } : {}),
          ...(calculated.passingPercentage ? { passingPercentage: calculated.passingPercentage } : {}),
        };
      });
    }

    if (testType === TestType.Ready_Mix) {
      delete payloadDetails.airContent;
      payloadDetails.customerName = customerName;
      payloadDetails.customerLocation = customerLocation;
      payloadDetails.referenceNumber = referenceNumber.trim();
    }
    if (
      testType === TestType.Ready_Mix ||
      testType === TestType.Paving_Blocks
    ) {
      if (applicableStandard) payloadDetails.strengthStandardId = applicableStandard.id;
      else delete payloadDetails.strengthStandardId;
      delete payloadDetails.strengthStandardAssignmentMode;
    }
    if (testType === TestType.Blocks) {
      if (strengthStandardMode === "manual" && applicableStandard) {
        payloadDetails.strengthStandardId = applicableStandard.id;
        payloadDetails.strengthStandardAssignmentMode = "manual";
      } else {
        delete payloadDetails.strengthStandardId;
        payloadDetails.strengthStandardAssignmentMode = "automatic";
      }
    }
    if (testType === TestType.Blocks) {
      payloadDetails.machine = machine;
      payloadDetails.blockAge = blockAge.trim();
    }

    if (usesTestRows) {
      payloadDetails.testRows = testRows.map(({ id: _id, ...row }, index) => ({
        rowNo: index + 1,
        ...(testType === TestType.Ready_Mix
          ? { testAge: row.testAge }
          : {}),
        length: row.length || (testType === TestType.Blocks ? blockDimensions?.length : ""),
        width: row.width || (testType === TestType.Blocks ? blockDimensions?.width : ""),
        height: row.height || (testType === TestType.Blocks ? blockDimensions?.height : ""),
        dryWeight: row.dryWeight,
        wetWeight: row.wetWeight,
        ...(testType === TestType.Ready_Mix
          ? {
              load: row.load,
              waterAbsorption: calculateWaterAbsorption(row.dryWeight, row.wetWeight),
            }
          : testType === TestType.Blocks
            ? {
              load: row.load,
              airDryStrength:
                calculateStrength(row).airDryStrength || row.airDryStrength,
              normalizedStrength:
                calculateStrength(row).normalizedStrength || row.normalizedStrength,
              density: calculateBlockDensity(row),
            }
            : {
              load: row.load,
              tensileStrength:
                calculatePavingStrength(row).tensileStrength ||
                row.tensileStrength ||
                row.correctedStrength,
              correctionFactor: details.correctionFactor,
              correctedStrength:
                calculatePavingStrength(row).correctedStrength || row.correctedStrength,
              density: calculateBlockDensity(row),
              waterAbsorption: calculateWaterAbsorption(
                row.dryWeight,
                row.wetWeight,
              ),
            }),
      }));
    }

    const payload: QcRecordInput = {
      testType,
      sampleDate: new Date(sampleDate).toISOString(),
      location: locationValue,
      material: testType === TestType.Blocks
        ? material.trim() || BLOCK_RECORD_MATERIAL
        : material.trim(),
      status: RecordStatus.Review, 
      testedBy,
      ...(canEditApprovedBy ? { reviewedBy: reviewedBy.trim() } : {}),
      remarks,
      details: payloadDetails
    };

    const shouldDuplicateAfterSave = isEditing && requestedAction === "duplicate";

    if (isEditing && recordId > 0) {
      const updatePayload: QcRecordUpdate = payload;
      updateRecord.mutate({ id: recordId, data: updatePayload }, {
        onSuccess: (updatedRecord) => {
          queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(recordId) });
          queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(recordId) });
          queryClient.invalidateQueries({ queryKey: ["/api/daily-ready-mix-results"] });

          if (shouldDuplicateAfterSave) {
            toast.success(`Record ${updatedRecord.recordNo} has been saved. Creating a copy...`);
            createRecord.mutate({ data: payload }, {
              onSuccess: (newRecord) => {
                toast.success(`Created copy ${newRecord.recordNo}.`);
                queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
                queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
                queryClient.invalidateQueries({ queryKey: ["/api/daily-ready-mix-results"] });
                setLocation(`/records/${newRecord.id}/edit`);
              },
              onError: () => {
                toast.error("The record was saved, but its copy could not be created.");
                setLocation(`/records/${updatedRecord.id}`);
              },
            });
            return;
          }

          toast.success(`Record ${updatedRecord.recordNo} has been updated.`);
          setLocation(`/records/${updatedRecord.id}`);
        },
        onError: () => {
          toast.error(
            shouldDuplicateAfterSave
              ? "The record could not be saved, so no copy was created."
              : "Failed to update record. Please try again.",
          );
        },
      });
      return;
    }

    createRecord.mutate({ data: payload }, {
      onSuccess: (newRecord) => {
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/daily-ready-mix-results"] });

        if (!isEditing && requestedAction === "duplicate") {
          toast.success(`Record ${newRecord.recordNo} has been saved. The form is ready for the next record.`);
          return;
        }

        toast.success(`Record ${newRecord.recordNo} has been saved.`);
        setLocation(`/records/${newRecord.id}`);
      },
      onError: () => {
        toast.error("Failed to create record. Please try again.");
      },
    });
  };

  if (lookupsLoading || (isEditing && recordLoading)) {
    return <div className="p-8 text-center text-muted-foreground">Loading form data...</div>;
  }
  if (!canEditQc) {
    return (
      <Card className="mx-auto mt-12 max-w-lg text-center">
        <CardContent className="space-y-3 p-10">
          <h1 className="text-lg font-semibold">View-only access</h1>
          <p className="text-sm text-muted-foreground">
            Your access role can view QC records but cannot add or change them.
          </p>
          <Button variant="outline" onClick={goBack}>
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isEditing && (recordError || !existingRecord)) {
    return <div className="p-8 text-center text-destructive">Failed to load the record for editing.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={goBack} aria-label="Go back" className="p-2 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
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
        <Button
          type="button"
          variant="outline"
          className="shrink-0 self-start"
          onClick={() => {
            submitAction.current = "duplicate";
            formRef.current?.requestSubmit();
          }}
          disabled={createRecord.isPending || updateRecord.isPending}
        >
          <Copy className="mr-2 h-4 w-4" />
          Save & Duplicate
        </Button>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            event.nativeEvent.isComposing ||
            !(event.target instanceof HTMLInputElement)
          ) return;

          event.preventDefault();
          const fields = Array.from(
            formRef.current?.querySelectorAll<HTMLElement>(
              'input:not([type="hidden"]):not(:disabled):not([readonly]), textarea:not(:disabled):not([readonly]), button[role="combobox"]:not(:disabled):not([aria-disabled="true"]), button[type="submit"]:not(:disabled)',
            ) ?? [],
          );
          const currentIndex = fields.indexOf(event.target);
          if (currentIndex === -1) return;

          const nextField = fields
            .slice(currentIndex + 1)
            .find((field) => field.dataset.enterSkip !== "true");
          if (!nextField) return;
          nextField.scrollIntoView({ block: "nearest", inline: "nearest" });
          nextField.focus({ preventScroll: true });
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
                  if (val === TestType.Blocks || testType === TestType.Blocks) setMaterial("");
                  setDetails({});
                  setSelectedStrengthStandardId("");
                  setStrengthStandardMode("automatic");
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
                <Label>
                  {testType === TestType.Blocks || testType === TestType.Paving_Blocks
                    ? "Casting Date"
                    : "Sample Date"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
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
                  onCreateOption={createReferenceOption("locations")}
                />
              </div>

              {testType !== TestType.Blocks && (
                <div className="space-y-2">
                  <Label>Material / Product <span className="text-destructive">*</span></Label>
                  <TypeaheadInput
                    value={material}
                    onChange={setMaterial}
                    options={getMaterialSuggestions()}
                    placeholder="Select or type material..."
                    onCreateOption={createReferenceOption(getMaterialReferenceCategory())}
                  />
                </div>
              )}

      {testType === TestType.Blocks ? (
        <div className="space-y-3 md:col-span-2">
          <Label>Block standard assignment</Label>
          <div
            role="radiogroup"
            aria-label="Block standard assignment mode"
            className="grid gap-2 sm:grid-cols-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={strengthStandardMode === "automatic"}
              onClick={() => setStrengthStandardMode("automatic")}
              className={`rounded-lg border p-3 text-left transition-colors ${
                strengthStandardMode === "automatic"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <span className="block text-sm font-semibold">Automatic match</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Use the standard linked to this Block Type and Block Size.
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={strengthStandardMode === "manual"}
              onClick={() => {
                setStrengthStandardMode("manual");
                if (!selectedStrengthStandardId && matchingStrengthStandards[0]) {
                  setSelectedStrengthStandardId(String(matchingStrengthStandards[0].id));
                }
              }}
              className={`rounded-lg border p-3 text-left transition-colors ${
                strengthStandardMode === "manual"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <span className="block text-sm font-semibold">Choose manually</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Select a different standard linked to this Block Type and Size.
              </span>
            </button>
          </div>

          <div className="grid items-center gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div>
              <span className="block text-muted-foreground">1 · Block Type + Size</span>
              <strong className="mt-1 block text-foreground">
                {stringValue(details.blockType) || "Choose Block Type"} ·{" "}
                {stringValue(details.blockSize) || "Choose Block Size"}
              </strong>
            </div>
            <span className="hidden text-muted-foreground sm:block" aria-hidden="true">→</span>
            <div>
              <span className="block text-muted-foreground">2 · Match method</span>
              <strong className="mt-1 block text-foreground">
                {strengthStandardMode === "automatic" ? "Automatic" : "Manual"}
              </strong>
            </div>
            <span className="hidden text-muted-foreground sm:block" aria-hidden="true">→</span>
            <div>
              <span className="block text-muted-foreground">3 · Evaluation</span>
              <strong className="mt-1 block text-foreground">Standard saved with record</strong>
            </div>
          </div>

          {strengthStandardMode === "manual" ? (
            <div className="space-y-2">
              <Label htmlFor="block-standard-selection">Evaluation / Report Standard</Label>
              <select
                id="block-standard-selection"
                value={selectedStrengthStandardId}
                onChange={(event) => setSelectedStrengthStandardId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                disabled={!matchingStrengthStandards.length}
              >
                {matchingStrengthStandards.map((standard) => (
                  <option key={standard.id} value={standard.id}>
                    {standard.bsStandard} — {standard.requiredStrength} {standard.strengthUnit}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {matchingStrengthStandards.length
                  ? "The selected standard will be saved with this record."
                  : "No standard is linked to this Block Type and Size yet. Ask an administrator to set it up in Quality Standards."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border bg-background p-3 text-sm" aria-live="polite">
              <span className="text-muted-foreground">Automatically matched standard: </span>
              {matchingStrengthStandards[0] ? (
                <strong>
                  {matchingStrengthStandards[0].bsStandard} —{" "}
                  {matchingStrengthStandards[0].requiredStrength}{" "}
                  {matchingStrengthStandards[0].strengthUnit}
                </strong>
              ) : (
                <span className="text-muted-foreground">
                  None linked yet. Ask an administrator to configure a Block standard.
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        (testType === TestType.Ready_Mix || testType === TestType.Paving_Blocks) && (
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
        )
      )}

              <div className="space-y-2">
                <Label>Tested By (Technician) <span className="text-destructive">*</span></Label>
                <TypeaheadInput
                  value={testedBy}
                  onChange={setTestedBy}
                  options={lookups?.employees || []}
                  placeholder="Select or type technician..."
                  onCreateOption={createReferenceOption("employees")}
                />
              </div>

              {canEditApprovedBy && (
                <div className="space-y-2">
                  <Label>Approved By</Label>
                  <Input
                    value={reviewedBy}
                    onChange={(event) => setReviewedBy(event.target.value)}
                    placeholder="Enter approving person"
                  />
                  <p className="text-xs text-muted-foreground">
                    This approval name is shown on the report.
                  </p>
                </div>
              )}

              {testType === TestType.Aggregate_Sieve && (
                <div className="space-y-2">
                  <Label>
                    Material Condition <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={String(details.materialCondition ?? "")}
                    onValueChange={(value) =>
                      handleDetailChange("materialCondition", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["Single Washed", "Unwashed", "Double Washed"].map((condition) => (
                        <SelectItem key={condition} value={condition}>
                          {condition}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                      onCreateOption={createReferenceOption("customers")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Location</Label>
                    <TypeaheadInput
                      value={customerLocation}
                      onChange={setCustomerLocation}
                      options={lookups?.customerLocations || []}
                      placeholder="Select or type location..."
                      onCreateOption={createReferenceOption("customerLocations")}
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
                      onCreateOption={createReferenceOption("blockTypes")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Block Size <span className="text-destructive">*</span></Label>
                    <TypeaheadInput
                      value={String(details.blockSize ?? "")}
                      onChange={(value) => handleDetailChange("blockSize", value)}
                      options={lookups?.blockSizes || []}
                      placeholder="Select or type block size..."
                      onCreateOption={createReferenceOption("blockSizes")}
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
                  <div className="space-y-2">
                    <Label>Block Age (days) <span className="text-destructive">*</span></Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={blockAge}
                      onChange={(event) => setBlockAge(event.target.value)}
                      placeholder="e.g. 28"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Testing Date</Label>
                    <Input
                      type="date"
                      value={String(details.testingDate ?? "")}
                      onChange={(event) => handleDetailChange("testingDate", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sample Type</Label>
                    <TypeaheadInput
                      value={String(details.sampleType ?? "")}
                      onChange={(value) => handleDetailChange("sampleType", value)}
                      options={sampleTypeOptions}
                      placeholder="Select sample type..."
                      onCreateOption={createReferenceOption("sampleTypes")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Method of Conditioning</Label>
                    <TypeaheadInput
                      value={String(details.conditioningMethod ?? "")}
                      onChange={(value) => handleDetailChange("conditioningMethod", value)}
                      options={conditioningMethodOptions}
                      placeholder="Select conditioning method..."
                      onCreateOption={createReferenceOption("conditioningMethods")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Method of Preparation</Label>
                    <TypeaheadInput
                      value={String(details.preparationMethod ?? "")}
                      onChange={(value) => handleDetailChange("preparationMethod", value)}
                      options={preparationMethodOptions}
                      placeholder="Select preparation method..."
                      onCreateOption={createReferenceOption("preparationMethods")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Shape Factor
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (default from Standards by block size)
                      </span>
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={String(details.shapeFactor ?? "")}
                      onChange={(event) => handleDetailChange("shapeFactor", event.target.value)}
                      placeholder="Enter shape factor"
                    />
                  </div>
                </>
              )}
      {testType === TestType.Paving_Blocks && (
        <>
          <div className="space-y-2">
            <Label>Machine Type</Label>
            <Input
              value={String(details.machine ?? "")}
              onChange={(event) =>
                handleDetailChange("machine", event.target.value)
              }
              placeholder="Enter machine type"
            />
          </div>
          <div className="space-y-2">
            <Label>Sample Type</Label>
            <TypeaheadInput
              value={String(details.sampleType ?? "")}
              onChange={(value) => handleDetailChange("sampleType", value)}
              options={sampleTypeOptions}
              placeholder="Select sample type..."
              onCreateOption={createReferenceOption("sampleTypes")}
            />
          </div>
          <div className="space-y-2">
            <Label>Testing Date</Label>
            <Input
              type="date"
              value={String(details.testingDate ?? "")}
              onChange={(event) =>
                handleDetailChange("testingDate", event.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Paving Block Size <span className="text-destructive">*</span></Label>
            <TypeaheadInput
              value={String(details.pavingBlockSize ?? "")}
              onChange={(value) => handleDetailChange("pavingBlockSize", value)}
              options={lookups?.blockSizes || []}
              placeholder="e.g. 200*200*60"
              onCreateOption={createReferenceOption("blockSizes")}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Correction Factor
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (default from Standards by size)
              </span>
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={String(details.correctionFactor ?? "")}
              onChange={(event) => handleDetailChange("correctionFactor", event.target.value)}
              placeholder="0.87 for 60 mm, 1.00 for 80 mm"
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
                      {testType === TestType.Aggregate_Sieve
                        ? "Sample weight is calculated from the retained amounts. Dry and wet sample weights are used to calculate moisture content."
                        : usesSieveRows
                          ? "Sample weight is calculated from the retained amounts entered below."
                        : "Record the total sample weight and the measured dry and wet weights."}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {usesSieveRows && (
                      <div className="space-y-2">
                        <Label>Calculated Sample Weight (g)</Label>
                        <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground">
                          {(calculatedSieveSampleWeight ?? 0).toFixed(2)}
                        </div>
                      </div>
                    )}
                    {!usesSieveRows && (
                      <div className="space-y-2">
                        <Label>Sample Weight (kg)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={String(details.sampleWeight ?? "")}
                          onChange={(event) => handleDetailChange("sampleWeight", event.target.value)}
                          placeholder="Enter weight"
                        />
                      </div>
                    )}
                    {[
                      [
                        "dryWeight",
                        testType === TestType.Aggregate_Sieve
                          ? `Dry Sample Weight (${sieveMassUnit})`
                          : `Dry Weight (${usesSieveRows ? sieveMassUnit : "kg"})`,
                      ],
                      [
                        "wetWeight",
                        testType === TestType.Aggregate_Sieve
                          ? `Wet Sample Weight (${sieveMassUnit})`
                          : `Wet Weight (${usesSieveRows ? sieveMassUnit : "kg"})`,
                      ],
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
              {testType === TestType.Aggregate_Sieve && (
                <section className="mb-6 rounded-md border border-amber-500/25 bg-amber-500/[0.035] p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-foreground">
                      Chloride and Sulphate Content
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Enter the laboratory readings used to calculate chloride and sulphate content.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {AGGREGATE_CHEMISTRY_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`aggregate-${key}`}>{label}</Label>
                        <Input
                          id={`aggregate-${key}`}
                          type="text"
                          inputMode="decimal"
                          value={String(details[key] ?? "")}
                          onChange={(event) =>
                            handleDetailChange(key, event.target.value)
                          }
                          placeholder="Enter value"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {usesTestRows || usesSieveRows ? (
                <div className="space-y-3">
                  {(testType === TestType.Ready_Mix || testType === TestType.Blocks) && (
                    <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
                      {applicableStandard ? (
                        <span>
                          Automatic evaluation: {testType === TestType.Blocks
                            ? "the average Block sample strength is compared with"
                            : "28-day cubes are compared with"}{" "}
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
                  {testType === TestType.Paving_Blocks && (
                    <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
                      {applicableStandard ? (
                        <span>
                          Average tensile strength is compared with{" "}
                          <strong>
                            {applicableStandard.requiredStrength}{" "}
                            {applicableStandard.strengthUnit}
                          </strong>{" "}
                          under <strong>{applicableStandard.bsStandard}</strong>.
                          Tensile strength is calculated from load, length,
                          specimen height, and the correction factor.
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          A matching strength standard and a correction factor
                          are required for automatic Pass/Fail evaluation.
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
                   {usesSieveRows && !sieveEntryItems.length ? null : <div className={`${isCompactBlockTable ? "overflow-hidden" : "overflow-x-auto"} rounded-md border`}>
                      <table className={`w-full ${usesSieveRows ? "min-w-[760px] text-sm" : isCompactBlockTable ? "table-fixed text-[11px]" : testType === TestType.Paving_Blocks ? "min-w-[1440px] text-sm" : "min-w-[1080px] text-sm"}`}>
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                           <th className={`${isCompactBlockTable ? "w-[4%] px-1 py-2 text-[10px]" : "w-12 px-3 py-3"} text-left font-semibold`}>No.</th>
                          {usesSieveRows ? (
                            <th className="px-3 py-3 text-left font-semibold">Sieve / Pore Size</th>
                          ) : testType === TestType.Ready_Mix ? (
                            <th className="px-3 py-3 text-left font-semibold">Test Age</th>
                          ) : null}
                          {usesSieveRows ? (
                            <>
                              <th className="px-3 py-3 text-left font-semibold">Standard</th>
                               <th className="px-3 py-3 text-left font-semibold">Amount Returned (g) <span className="font-normal text-muted-foreground">(optional)</span></th>
                               <th className="px-3 py-3 text-left font-semibold">Amount Passing (g)</th>
                              <th className="px-3 py-3 text-left font-semibold">% Passing</th>
                            </>
                          ) : (
                            <>
                               <th className={`${isCompactBlockTable ? "w-[12%] px-1 py-2 text-[10px]" : "px-3 py-3"} text-left font-semibold`}>Length (mm)</th>
                               <th className={`${isCompactBlockTable ? "w-[12%] px-1 py-2 text-[10px]" : "px-3 py-3"} text-left font-semibold`}>Width (mm)</th>
                               <th className={`${isCompactBlockTable ? "w-[12%] px-1 py-2 text-[10px]" : "px-3 py-3"} text-left font-semibold`}>Height (mm)</th>
                              {testType === TestType.Ready_Mix && (
                                <th className="px-3 py-3 text-left font-semibold">Dry Weight</th>
                              )}
                              {testType !== TestType.Blocks && <th className="px-3 py-3 text-left font-semibold">
                                {testType === TestType.Paving_Blocks
                                  ? "Dry Weight (kg)"
                                  : "Wet Weight"}
                              </th>}
                              {testType === TestType.Paving_Blocks && (
                                <th className="px-3 py-3 text-left font-semibold">
                                  Wet Weight (kg)
                                </th>
                              )}
                               {testType === TestType.Ready_Mix && (
                                 <th className="px-3 py-3 text-left font-semibold">Water Absorption</th>
                               )}
                            </>
                          )}
                            {(testType === TestType.Ready_Mix ||
                              testType === TestType.Blocks ||
                              testType === TestType.Paving_Blocks) && (
                             <>
                               <th className={`${isCompactBlockTable ? "w-[10%] px-1 py-2 text-[10px]" : "px-3 py-3"} text-left font-semibold`}>Load (kN)</th>
                               {testType === TestType.Blocks ? (
                                 <th className="w-[12%] px-1 py-2 text-left text-[10px] font-semibold">Wet Weight (kg)</th>
                               ) : (
                                  <th className="px-3 py-3 text-left font-semibold">
                                    {testType === TestType.Paving_Blocks
                                      ? "Tensile Strength (N/mm²)"
                                      : "Calculated Strength"}
                                  </th>
                               )}
                                {testType === TestType.Paving_Blocks && (
                                  <>
                                    <th className="px-3 py-3 text-left font-semibold">
                                      Density (kg/m³)
                                    </th>
                                    <th className="px-3 py-3 text-left font-semibold">
                                      Water Absorption (%)
                                    </th>
                                  </>
                                )}
                               {testType === TestType.Blocks && (
                                 <>
                                    <th className="w-[16%] px-1 py-2 text-left text-[10px] font-semibold">Air Dry Strength (N/mm²)</th>
                                    <th className="w-[14%] px-1 py-2 text-left text-[10px] font-semibold">Density (kg/m³)</th>
                                 </>
                               )}
                             </>
                           )}
                          <th className={`${isCompactBlockTable ? "w-[8%] px-1 py-2 text-[10px]" : "w-20 px-3 py-3"} text-left font-semibold`}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testRows.map((row, rowIndex) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                            <td className={isCompactBlockTable ? "px-1 py-1.5 text-center text-[10px] font-semibold text-muted-foreground" : "px-3 py-2 font-semibold text-muted-foreground"}>{rowIndex + 1}</td>
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
                                      setTestRows((previous) => {
                                        const nextRows = previous.map((candidate, index) => (
                                          index === rowIndex ? nextRow : candidate
                                        ));
                                        const calculatedRows = calculateSieveResults(
                                          nextRows,
                                        );
                                        return nextRows.map((candidate, index) => ({
                                          ...candidate,
                                          ...calculatedRows[index],
                                        }));
                                      });
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
                            {testType === TestType.Ready_Mix && (
                              <td className="px-2 py-2">
                              <Input
                                ref={element => {
                                  rowInputRefs.current[row.id] = element;
                                }}
                                type="text"
                                inputMode="numeric"
                                value={testType === TestType.Ready_Mix ? row.testAge : row.sampleAge}
                                onChange={event => updateTestRow(rowIndex, testType === TestType.Ready_Mix ? "testAge" : "sampleAge", event.target.value)}
                                placeholder="Days"
                                aria-label={`${testType === TestType.Ready_Mix ? "Test" : "Sample"} age for row ${rowIndex + 1}`}
                              />
                            </td>
                            )}
                            {measurementKeys.map(key => (
                              <td key={key} className={compactBlockCellClass}>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row[key] ?? ""}
                                  className={compactBlockInputClass}
                                  data-enter-skip={["length", "width", "height"].includes(key) ? "true" : undefined}
                                  onChange={event => updateTestRow(rowIndex, key, event.target.value)}
                                   placeholder={
                                      (testType === TestType.Blocks || testType === TestType.Paving_Blocks) &&
                                        ["length", "width", "height"].includes(key)
                                       ? "Auto from size"
                                        : key === "dryWeight" || key === "wetWeight" || key === "weight"
                                         ? "kg"
                                         : "mm"
                                   }
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
                              {(testType === TestType.Ready_Mix ||
                                testType === TestType.Blocks ||
                                testType === TestType.Paving_Blocks) && (
                              <>
                                <td className={compactBlockCellClass}>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={row.load}
                                    onChange={event => updateTestRow(rowIndex, "load", event.target.value)}
                                    placeholder="kN"
                                    aria-label={`Load for row ${rowIndex + 1}`}
                                    className={compactBlockInputClass}
                                  />
                                </td>
                                {testType === TestType.Blocks && (
                                  <td className={compactBlockCellClass}>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.wetWeight ?? ""}
                                      onChange={event => updateTestRow(rowIndex, "wetWeight", event.target.value)}
                                      placeholder="kg"
                                      aria-label={`Wet weight for row ${rowIndex + 1}`}
                                      className={compactBlockInputClass}
                                    />
                                  </td>
                                )}
                                {testType !== TestType.Blocks && (
                                 <td className="px-2 py-2">
                                   <div
                                     className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground"
                                     aria-label={`Calculated strength for row ${rowIndex + 1}`}
                                   >
                                     {testType === TestType.Paving_Blocks
                                        ? calculatePavingStrength(row).tensileStrength
                                          ? `${calculatePavingStrength(row).tensileStrength} N/mm²`
                                          : "Enter load, dimensions, and correction factor"
                                       : calculateStrength(row).waterStrength
                                         ? `${calculateStrength(row).waterStrength} N/mm²`
                                         : "Enter load and dimensions"}
                                   </div>
                                </td>
                                )}
                                 {testType === TestType.Paving_Blocks && (
                                   <>
                                     <td className="px-2 py-2">
                                        {calculateBlockDensity(row) ||
                                          "Enter wet weight and dimensions"}
                                     </td>
                                     <td className="px-2 py-2">
                                        {calculateWaterAbsorption(
                                          row.dryWeight,
                                          row.wetWeight,
                                        ) || "Enter dry and wet weights"}
                                     </td>
                                   </>
                                 )}
                                {testType === TestType.Blocks && (
                                  <>
                                 <td className={compactBlockCellClass}>
                                    <div
                                      className="flex h-8 items-center rounded-md border bg-muted/40 px-1.5 text-[11px] font-semibold leading-tight text-foreground"
                                        aria-label={`Calculated air dry strength for row ${rowIndex + 1}`}
                                      >
                                        {calculateStrength(row).airDryStrength
                                          ? `${calculateStrength(row).airDryStrength} N/mm²`
                                          : row.airDryStrength
                                            ? `${row.airDryStrength} N/mm²`
                                            : "Enter load and dimensions"}
                                    </div>
                                 </td>
                                 <td className={compactBlockCellClass}>
                                      <div
                                     className="flex h-8 items-center rounded-md border bg-muted/40 px-1.5 text-[11px] font-semibold leading-tight text-foreground"
                                        aria-label={`Calculated density for row ${rowIndex + 1}`}
                                      >
                                        {calculateBlockDensity(row) || "Enter wet weight and dimensions"}
                                      </div>
                                    </td>
                                  </>
                                )}
                              </>
                            )}
                            <td className={isCompactBlockTable ? "px-1 py-1.5 text-center" : "px-2 py-2"}>
                              {usesSieveRows ? (
                                <span className="text-xs text-muted-foreground">From standard</span>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTestRow(rowIndex)}
                                  disabled={testRows.length === 1}
                                  className={isCompactBlockTable ? "h-7 px-1.5 text-[10px]" : undefined}
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
                        Use + Add row to add another numbered entry.
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

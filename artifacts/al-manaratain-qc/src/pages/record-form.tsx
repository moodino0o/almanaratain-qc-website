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
  AGGREGATE_CHLORIDE_LIMIT_PERCENT,
  AGGREGATE_SULPHATE_LIMIT_PERCENT,
  calculateChlorideContent,
  calculateMoistureContent,
  calculateRetainedPercentage,
  calculateSiltContent,
  calculateWaterAbsorption,
  calculateCubeCompressiveStrength,
  calculateSulphateContent,
  calculateBlockDensity,
  calculateCubeDensity,
  integerIdentifierValue,
  cubeWeightInGrams,
  calculateBlockStrengths,
  calculatePavingStrengths,
  blockDimensionsFromSize,
  blockSizeMatches,
  blockTypeMatches,
  createEmptyRow,
  createDefaultTestRows,
  DEFAULT_PRECAST_COMPACTION,
  DEFAULT_PRECAST_CUBE_SIZE,
  PRECAST_CUBE_AGES,
  PRECAST_AGE_STRENGTH_CRITERIA,
  precastAgeStrengthSummary,
  precastStrengthOutcome,
  evaluateContentAgainstLimit,
  evaluateSieveValue,
  evaluateSiltContent,
  filterSieveSizeItems,
  calculateSieveSampleWeight,
  calculateSieveResults,
  applySizeDimensionDefaults,
  isSievePoreSizeAllowed,
  BLOCK_RECORD_MATERIAL,
  prepareDetailsForForm,
  getReadyMixReferenceNumberError,
  sieveSizeNumber,
  stringValue,
  toFormRow,
  numericInputValue,
  pavingCorrectionFactorFromSize,
  SIEVE_SILT_LIMIT_PERCENT,
  type TestRow,
} from "./record-form-utils";
import { EMPLOYEE_ADDABLE_REFERENCE_CATEGORIES } from "./reference-data-permissions";
import { registerSectionFromQuery } from "./register-sections";

const REFERENCE_NUMBER_MAX_LENGTH = 32;
const DEFAULT_APPROVED_BY = "ADEL ABBAS EBRAHIM";
const MATERIAL_CONDITIONS = ["Single Washed", "Unwashed", "Double Washed"] as const;

function ageFromDates(sampleDate: string, testingDate: unknown) {
  const sampleDay = String(sampleDate).slice(0, 10);
  const testingDay = String(testingDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sampleDay) || !/^\d{4}-\d{2}-\d{2}$/.test(testingDay)) {
    return "";
  }
  const sampleTime = Date.parse(`${sampleDay}T00:00:00.000Z`);
  const testingTime = Date.parse(`${testingDay}T00:00:00.000Z`);
  if (
    !Number.isFinite(sampleTime) ||
    !Number.isFinite(testingTime) ||
    new Date(sampleTime).toISOString().slice(0, 10) !== sampleDay ||
    new Date(testingTime).toISOString().slice(0, 10) !== testingDay ||
    testingTime < sampleTime
  ) {
    return "";
  }
  const age = (testingTime - sampleTime) / 86_400_000;
  return Number.isSafeInteger(age) ? String(age) : "";
}

function isValidAge(value: string) {
  const age = Number(value.trim());
  return value.trim() !== "" && Number.isSafeInteger(age) && age >= 0;
}

export default function RecordForm() {
  const { id } = useParams();
  const recordId = id ? Number(id) : 0;
  const isEditing = Number.isInteger(recordId) && recordId > 0;
  const registerSection = registerSectionFromQuery();
  const [, setLocation] = useLocation();
  const fallbackRoute = isEditing ? `/records/${recordId}` : registerSection?.href ?? "/records";
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

  const [testType, setTestType] = useState<TestType>(
    registerSection?.defaultTestType ?? TestType.Ready_Mix,
  );
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationValue, setLocationValue] = useState("");
  const [material, setMaterial] = useState("");
  const [testedBy, setTestedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState(DEFAULT_APPROVED_BY);
  const [machine, setMachine] = useState("");
  const [blockAge, setBlockAge] = useState("");
  const [sampleAge, setSampleAge] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [referenceNumberTouched, setReferenceNumberTouched] = useState(false);
  const [truckNumber, setTruckNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedStrengthStandardId, setSelectedStrengthStandardId] = useState("");
  const [strengthStandardMode, setStrengthStandardMode] = useState<"automatic" | "manual">("automatic");
  
  const [details, setDetails] = useState<Record<string, unknown>>(() =>
    testType === TestType.Precast
      ? {
          cubeSize: DEFAULT_PRECAST_CUBE_SIZE,
          compactionType: DEFAULT_PRECAST_COMPACTION,
        }
      : {},
  );
  const [testRows, setTestRows] = useState<TestRow[]>(() =>
    createDefaultTestRows(testType),
  );
  const nextRowId = useRef(testRows.length + 1);
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
    const isSieveRecord =
      existingRecord.testType === TestType.Sand_Sieve ||
      existingRecord.testType === TestType.Aggregate_Sieve;
    if (isSieveRecord) {
      if (
        !stringValue(savedDetails.materialCondition).trim() &&
        stringValue(savedDetails.condition).trim()
      ) {
        savedDetails.materialCondition = savedDetails.condition;
      }
      if (
        !stringValue(savedDetails.condition).trim() &&
        stringValue(savedDetails.materialCondition).trim()
      ) {
        savedDetails.condition = savedDetails.materialCondition;
      }
      if (
        !stringValue(savedDetails.dryWeight).trim() &&
        stringValue(savedDetails.drySample).trim()
      ) {
        savedDetails.dryWeight = savedDetails.drySample;
      }
      if (
        !stringValue(savedDetails.wetWeight).trim() &&
        stringValue(savedDetails.wetSample).trim()
      ) {
        savedDetails.wetWeight = savedDetails.wetSample;
      }
    }

    setTestType(existingRecord.testType);
    setSampleDate(existingRecord.sampleDate.slice(0, 10));
    setLocationValue(existingRecord.location);
    setMaterial(existingRecord.material);
    setTestedBy(existingRecord.testedBy);
    setReviewedBy(existingRecord.reviewedBy || DEFAULT_APPROVED_BY);
    setRemarks(existingRecord.remarks ?? "");
    setReferenceNumber(stringValue(savedDetails.referenceNumber));
    setTruckNumber(stringValue(savedDetails.truckNumber));
    setCustomerName(stringValue(savedDetails.customerName));
    setCustomerLocation(stringValue(savedDetails.customerLocation));
    setMachine(stringValue(savedDetails.machine));
    const legacyBlockAgeRow = savedRows.find(
      (row) => typeof row === "object" && row !== null && "sampleAge" in row,
    );
    const legacyBlockAge = legacyBlockAgeRow && typeof legacyBlockAgeRow === "object"
      ? (legacyBlockAgeRow as Record<string, unknown>).sampleAge
      : "";
    const savedBlockAge = [savedDetails.blockAge, legacyBlockAge]
      .find((value) => stringValue(value).trim()) ??
      ageFromDates(existingRecord.sampleDate, savedDetails.testingDate);
    setBlockAge(numericInputValue(savedBlockAge));
    const legacySampleAgeRow = savedRows.find(
      (row) => typeof row === "object" && row !== null && "sampleAge" in row,
    );
    const legacySampleAge = legacySampleAgeRow && typeof legacySampleAgeRow === "object"
      ? (legacySampleAgeRow as Record<string, unknown>).sampleAge
      : "";
    const savedSampleAge = [savedDetails.sampleAge, legacySampleAge]
      .find((value) => stringValue(value).trim()) ??
      ageFromDates(existingRecord.sampleDate, savedDetails.testingDate);
    setSampleAge(numericInputValue(savedSampleAge));
    const savedStandardId = stringValue(savedDetails.strengthStandardId);
    const savedAssignmentMode = stringValue(savedDetails.strengthStandardAssignmentMode);
    setSelectedStrengthStandardId(savedStandardId);
    setStrengthStandardMode(
      savedAssignmentMode === "manual" || (!savedAssignmentMode && savedStandardId)
        ? "manual"
        : "automatic",
    );
    setDetails(
      existingRecord.testType === TestType.Precast
        ? {
            cubeSize: DEFAULT_PRECAST_CUBE_SIZE,
            compactionType: DEFAULT_PRECAST_COMPACTION,
            ...savedDetails,
          }
        : savedDetails,
    );
    const loadedSourceRows =
      savedRows.length
        ? savedRows
        : existingRecord.testType === TestType.Paving_Blocks
          ? [savedDetails]
          : [];
    const loadedRows = loadedSourceRows.length
      ? loadedSourceRows.map((row, index) => {
          const formRow = toFormRow(row, index + 1);
          return existingRecord.testType === TestType.Precast
            ? {
                ...formRow,
                testAge:
                  formRow.testAge ||
                  formRow.sampleAge ||
                  PRECAST_CUBE_AGES[index] ||
                  "",
              }
            : formRow;
        })
      : createDefaultTestRows(existingRecord.testType);
    const calculatedRows = existingRecord.testType === TestType.Sand_Sieve ||
      existingRecord.testType === TestType.Aggregate_Sieve
      ? calculateSieveResults(loadedRows)
      : [];
    setTestRows(loadedRows.map((row, index) => ({
      ...row,
      ...(calculatedRows[index] ?? {}),
    })));
    sieveContextKeyRef.current = `${existingRecord.testType}|${String(savedDetails.materialReferenceItemId ?? existingRecord.material)}`;
    nextRowId.current = Math.max(loadedRows.length + 1, 2);
    initializedRecordId.current = recordId;
  }, [existingRecord, isEditing, recordId]);

  const usesTestRows =
    testType === TestType.Ready_Mix ||
    testType === TestType.Blocks ||
    testType === TestType.Paving_Blocks ||
    testType === TestType.Precast;
  const usesSieveRows = testType === TestType.Sand_Sieve || testType === TestType.Aggregate_Sieve;

  const handleDetailChange = (key: string, value: string) => {
    setDetails(prev => ({ ...prev, [key]: value }));
  };

  const sieveMassUnit = "g";
  const blockDimensions = blockDimensionsFromSize(details.blockSize);
  const calculatedMoistureContent = calculateMoistureContent(
    details.dryWeight || details.drySample,
    details.wetWeight || details.wetSample,
  );
  const calculatedSiltContent = calculateSiltContent(
    details.siltBefore,
    details.siltAfter,
  );
  const siltContentStatus = evaluateSiltContent(calculatedSiltContent);
  const calculatedChlorideContent = calculateChlorideContent(
    details.silverNitrateContent,
    details.firstChlorideTitrationPoint,
    details.secondChlorideTitrationPoint,
  );
  const calculatedSulphateContent = calculateSulphateContent(
    details.crucibleWeight,
    details.crucibleAshWeight,
  );

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
  const machineOptions = useMemo(
    () => referenceData?.categories.find((category) => category.key === "machines")?.items.map((item) => item.value) ?? [],
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
      case TestType.Precast:
        return [];
      case TestType.Kerb_Stone:
        return [
          { key: "testingDate", label: "Testing Date", type: "date" },
          { key: "age", label: "Age (days)", type: "number" },
          { key: "kerbType", label: "Kerb Type", type: "text" },
          { key: "averageStrength", label: "Avg. Strength", type: "number" },
          { key: "minimumStrength", label: "Min. Strength", type: "number" },
          { key: "maximumStrength", label: "Max. Strength", type: "number" }
        ];
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

  const matchingSieveEntryStandards = useMemo(
    () => applicableSieveStandards.filter((standard) =>
      isSievePoreSizeAllowed(testType, material, standard.sieveSize),
    ),
    [applicableSieveStandards, material, testType],
  );

  const sieveEntryItems = useMemo(() => {
    const itemsById = new Map<number, { id: number; value: string }>();
    sieveSizeReferenceItems.forEach((item) => itemsById.set(item.id, item));
    matchingSieveEntryStandards.forEach((standard) => {
      if (!itemsById.has(standard.sieveSizeReferenceItemId)) {
        itemsById.set(standard.sieveSizeReferenceItemId, {
          id: standard.sieveSizeReferenceItemId,
          value: standard.sieveSize,
        });
      }
    });
    return filterSieveSizeItems(
      Array.from(itemsById.values()).sort(
        (a, b) => sieveSizeNumber(b.value) - sieveSizeNumber(a.value),
      ),
      testType,
      material,
    );
  }, [material, matchingSieveEntryStandards, sieveSizeReferenceItems, testType]);

  const visibleSieveRowEntries = useMemo(
    () => usesSieveRows
      ? testRows
          .map((row, rowIndex) => ({ row, rowIndex }))
          .filter(({ row }) =>
            isSievePoreSizeAllowed(testType, material, row.sieveSize),
          )
      : [],
    [material, testRows, testType, usesSieveRows],
  );
  const visibleSieveRows = visibleSieveRowEntries.map(({ row }) => row);
  const calculatedSieveSampleWeight = usesSieveRows
    ? calculateSieveSampleWeight(visibleSieveRows)
    : null;
  const displayedTestRows = usesSieveRows
    ? visibleSieveRowEntries
    : testRows.map((row, rowIndex) => ({ row, rowIndex }));
  const referenceNumberError =
    referenceNumberTouched || referenceNumber.trim()
      ? getReadyMixReferenceNumberError(referenceNumber)
      : null;

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
        matchingSieveEntryStandards.map((standard) => [standard.sieveSizeReferenceItemId, standard]),
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
    matchingSieveEntryStandards,
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
  const calculatePrecastStrength = (row: Pick<TestRow, "load">) => {
    const dimensions = blockDimensionsFromSize(details.cubeSize);
    return dimensions
      ? calculateCubeCompressiveStrength({ ...dimensions, load: row.load })
      : "";
  };
  const calculatePavingStrength = (
    row: Pick<
      TestRow,
      "length" | "height" | "load" | "compressiveStrength" | "tensileStrength"
    >,
  ) => calculatePavingStrengths(row, details.correctionFactor);

  const measurementKeys: Array<keyof Omit<TestRow, "id">> =
    testType === TestType.Ready_Mix
      ? ["length", "width", "height", "dryWeight", "wetWeight"]
      : testType === TestType.Precast
        ? []
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
    if (testType === TestType.Ready_Mix) {
      const referenceError = getReadyMixReferenceNumberError(referenceNumber);
      if (referenceError) {
        setReferenceNumberTouched(true);
        toast.error(referenceError);
        return;
      }
    }
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
      !isValidAge(blockAge)
    ) {
      toast.error("Please enter a valid Block age in days.");
      return;
    }
    if (
      testType === TestType.Paving_Blocks &&
      !isValidAge(blockAge)
    ) {
      toast.error("Please enter a valid Age in days.");
      return;
    }
    if (usesSieveRows && !isValidAge(sampleAge)) {
      toast.error("Please enter a valid Age in days.");
      return;
    }
    if (testType === TestType.Paving_Blocks && !String(details.pavingBlockSize ?? "").trim()) {
      toast.error("Please enter the paving block size.");
      return;
    }
    if (
      testType === TestType.Aggregate_Sieve &&
      !stringValue(details.materialCondition || details.condition).trim()
    ) {
      toast.error("Please select the Aggregate material condition.");
      return;
    }

    let payloadDetails: Record<string, unknown> = { ...details };
    if (usesSieveRows) {
      const selectedCondition = stringValue(
        details.materialCondition || details.condition,
      ).trim();
      payloadDetails.materialCondition = selectedCondition;
      delete payloadDetails.condition;
      payloadDetails.sampleAge = sampleAge.trim();
    }

    if (usesSieveRows) {
      const materialReferenceItemId = materialReferenceItems.find(
        (item) => item.value.trim().toLocaleLowerCase() === material.trim().toLocaleLowerCase(),
      )?.id;
      if (materialReferenceItemId) {
        payloadDetails.materialReferenceItemId = materialReferenceItemId;
      }
      const visibleCalculatedRows = calculateSieveResults(visibleSieveRows);
      const calculatedRowsById = new Map(
        visibleSieveRows.map((row, index) => [row.id, visibleCalculatedRows[index]] as const),
      );
      payloadDetails.sampleWeight = calculatedSieveSampleWeight;
      payloadDetails.sieveRows = testRows.map(({ id, ...row }, index) => {
        const calculated = calculatedRowsById.get(id);
        const passingAmount = calculated
          ? calculated.passingAmount
          : row.passingAmount;
        const passingPercentage = calculated
          ? calculated.passingPercentage
          : row.passingPercentage;
        return {
          rowNo: index + 1,
          sieveSize: row.sieveSize,
          sieveSizeReferenceItemId: row.sieveSizeReferenceItemId ??
            sieveSizeReferenceItems.find((item) => item.value === row.sieveSize)?.id ??
            null,
          ...(row.amountReturned.trim() ? { amountReturned: row.amountReturned } : {}),
          ...(passingAmount.trim() ? { passingAmount } : {}),
          ...(passingPercentage.trim() ? { passingPercentage } : {}),
        };
      });
    }

    if (testType === TestType.Ready_Mix) {
      delete payloadDetails.airContent;
      payloadDetails.customerName = customerName;
      payloadDetails.customerLocation = customerLocation;
      payloadDetails.referenceNumber = referenceNumber.trim();
      payloadDetails.truckNumber = truckNumber.trim();
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
    if (testType === TestType.Blocks || testType === TestType.Paving_Blocks) {
      payloadDetails.blockAge = blockAge.trim();
    }
    if (testType === TestType.Blocks) {
      payloadDetails.machine = machine;
    }
    if (testType === TestType.Precast) {
      payloadDetails.cubeSize = String(
        details.cubeSize || DEFAULT_PRECAST_CUBE_SIZE,
      ).trim();
      payloadDetails.compactionType = String(
        details.compactionType || DEFAULT_PRECAST_COMPACTION,
      ).trim();
      payloadDetails.cubeWeightUnit = "g";
      payloadDetails.sampleNo = integerIdentifierValue(details.sampleNo);
      payloadDetails.precastMouldNo = integerIdentifierValue(details.precastMouldNo);
      payloadDetails.jobNo = String(details.jobNo ?? "").trim();
      payloadDetails.customerName = String(details.customerName ?? "").trim();
    }

    if (usesTestRows) {
      payloadDetails.testRows = testRows.map(({ id: _id, ...row }, index) => ({
        rowNo: index + 1,
        ...(testType === TestType.Ready_Mix || testType === TestType.Precast
          ? { testAge: row.testAge }
          : {}),
        length: row.length ||
          (testType === TestType.Blocks ? blockDimensions?.length :
            testType === TestType.Precast ? blockDimensionsFromSize(payloadDetails.cubeSize)?.length : ""),
        width: row.width ||
          (testType === TestType.Blocks ? blockDimensions?.width :
            testType === TestType.Precast ? blockDimensionsFromSize(payloadDetails.cubeSize)?.width : ""),
        height: row.height ||
          (testType === TestType.Blocks ? blockDimensions?.height :
            testType === TestType.Precast ? blockDimensionsFromSize(payloadDetails.cubeSize)?.height : ""),
        dryWeight: row.dryWeight,
        wetWeight: row.wetWeight,
        ...(testType === TestType.Precast
          ? {
              weight: row.weight,
              density: calculateCubeDensity(payloadDetails.cubeSize, row.weight),
            }
          : {}),
        ...(testType === TestType.Ready_Mix
          ? {
              load: row.load,
              waterAbsorption: calculateWaterAbsorption(row.dryWeight, row.wetWeight),
            }
          : testType === TestType.Precast
            ? {
                load: row.load,
                calculatedStrength: calculatePrecastStrength(row) || row.strength,
                strength: calculatePrecastStrength(row) || row.strength,
                compressiveStrength: calculatePrecastStrength(row) || row.compressiveStrength,
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
                  if (
                    val === TestType.Blocks ||
                    testType === TestType.Blocks ||
                    val === TestType.Precast ||
                    testType === TestType.Precast
                  ) {
                    setMaterial("");
                  }
                  setReferenceNumberTouched(false);
                  setDetails(
                    val === TestType.Precast
                      ? {
                          cubeSize: DEFAULT_PRECAST_CUBE_SIZE,
                          compactionType: DEFAULT_PRECAST_COMPACTION,
                        }
                      : {},
                  );
                  setSelectedStrengthStandardId("");
                  setStrengthStandardMode("automatic");
                  const defaultRows = createDefaultTestRows(val);
                  setTestRows(defaultRows);
                  nextRowId.current = defaultRows.length + 1;
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Test Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(isEditing || !registerSection || registerSection.id === "all"
                      ? Object.values(TestType)
                      : registerSection.testTypes
                    ).map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {usesSieveRows
                    ? "Sampling Date"
                    : testType === TestType.Precast || testType === TestType.Blocks || testType === TestType.Paving_Blocks
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
                <Label>
                    {testType === TestType.Precast
                      ? "Testing Location"
                      : usesSieveRows || testType === TestType.Kerb_Stone
                      ? "Factory"
                      : "Plant / Production Location"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
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
                  <Label>
                    {usesSieveRows
                      ? "Material Type"
                      : testType === TestType.Precast
                        ? "Product Type"
                      : testType === TestType.Kerb_Stone
                        ? "Kerb Type"
                        : "Material / Product"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  {testType === TestType.Precast ? (
                    <Select value={material} onValueChange={setMaterial}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {["150 mm slab", "200", "250", "260"].map((productType) => (
                          <SelectItem key={productType} value={productType}>
                            {productType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <TypeaheadInput
                      value={material}
                      onChange={setMaterial}
                      options={getMaterialSuggestions()}
                      placeholder="Select or type material..."
                      onCreateOption={createReferenceOption(getMaterialReferenceCategory())}
                    />
                  )}
                </div>
              )}

              {usesSieveRows && (
                <>
                  <div className="space-y-2">
                    <Label>Age (days) <span className="text-destructive">*</span></Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={sampleAge}
                      onChange={(event) => setSampleAge(event.target.value)}
                      placeholder="e.g. 28"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Input
                      value={stringValue(details.supplier)}
                      onChange={(event) =>
                        handleDetailChange("supplier", event.target.value)
                      }
                      placeholder="Enter supplier"
                    />
                  </div>
                </>
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
                <Label>
                  {usesSieveRows ? "Sampled-Tested By" : "Tested By (Technician)"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
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

              {usesSieveRows && (
                <div className="space-y-2">
                  <Label>
                    Material Condition
                    {testType === TestType.Aggregate_Sieve && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Select
                    value={String(
                      details.materialCondition || details.condition || "",
                    )}
                    onValueChange={(value) =>
                      handleDetailChange("materialCondition", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_CONDITIONS.map((condition) => (
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
                    <Label>
                      Reference Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={referenceNumber}
                      onChange={(event) => setReferenceNumber(event.target.value)}
                      onBlur={() => setReferenceNumberTouched(true)}
                      maxLength={REFERENCE_NUMBER_MAX_LENGTH}
                      placeholder="e.g. S.1042 or H.2042"
                      aria-invalid={Boolean(referenceNumberError)}
                      aria-describedby={
                        referenceNumberError ? "ready-mix-reference-error" : undefined
                      }
                      className={
                        referenceNumberError
                          ? "border-destructive focus-visible:ring-destructive"
                          : undefined
                      }
                    />
                    {referenceNumberError ? (
                      <p
                        id="ready-mix-reference-error"
                        role="alert"
                        className="text-xs font-medium text-destructive"
                      >
                        {referenceNumberError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Enter a reference starting with S. or H., followed by a number.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Truck Number</Label>
                    <Input
                      value={truckNumber}
                      onChange={(event) => setTruckNumber(event.target.value)}
                      placeholder="Enter truck number"
                    />
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

              {testType === TestType.Precast && (
                <>
                  {[
                    ["sampleNo", "Sample No."],
                    ["precastMouldNo", "Precast Mould No."],
                    ["jobNo", "Job No."],
                  ].map(([key, label]) => {
                    const isIntegerIdentifier =
                      key === "sampleNo" || key === "precastMouldNo";
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                      <Input
                        type="text"
                        inputMode={isIntegerIdentifier ? "numeric" : undefined}
                        pattern={isIntegerIdentifier ? "[0-9]*" : undefined}
                        value={String(details[key] ?? "")}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (isIntegerIdentifier && !/^\d*$/.test(value)) return;
                          handleDetailChange(key, value);
                        }}
                        placeholder={`Enter ${label.toLowerCase()}`}
                      />
                      </div>
                    );
                  })}
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <TypeaheadInput
                      value={String(details.customerName ?? "")}
                      onChange={(value) => handleDetailChange("customerName", value)}
                      options={lookups?.customers || []}
                      placeholder="Select or type customer..."
                      onCreateOption={createReferenceOption("customers")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cube Size</Label>
                    <Input
                      value={String(details.cubeSize ?? DEFAULT_PRECAST_CUBE_SIZE)}
                      onChange={(event) => handleDetailChange("cubeSize", event.target.value)}
                      placeholder="100*100*100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compaction</Label>
                    <Input
                      value={String(details.compactionType ?? DEFAULT_PRECAST_COMPACTION)}
                      onChange={(event) => handleDetailChange("compactionType", event.target.value)}
                      placeholder={DEFAULT_PRECAST_COMPACTION}
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
                    <TypeaheadInput
                      value={machine}
                      onChange={setMachine}
                      options={machineOptions}
                      placeholder="Select or type machine..."
                      onCreateOption={createReferenceOption("machines")}
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
            <TypeaheadInput
              value={String(details.machine ?? "")}
              onChange={(value) => handleDetailChange("machine", value)}
              options={machineOptions}
              placeholder="Select or type machine..."
              onCreateOption={createReferenceOption("machines")}
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
            <Label>Age (days) <span className="text-destructive">*</span></Label>
            <Input
              type="text"
              inputMode="numeric"
              value={blockAge}
              onChange={(event) => setBlockAge(event.target.value)}
              placeholder="e.g. 28"
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
                          ? `Dry Weight (${sieveMassUnit})`
                          : `Dry Weight (${usesSieveRows ? sieveMassUnit : "kg"})`,
                      ],
                      [
                        "wetWeight",
                        testType === TestType.Aggregate_Sieve
                          ? `Wet Weight (${sieveMassUnit})`
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
              {usesSieveRows && (
                <section className="mb-6 rounded-md border border-amber-500/25 bg-amber-500/[0.035] p-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-foreground">
                      Sieve and Chemical Test Results
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Sieve analysis: BS812:PART103:1985. Chemical testing: BS812:Part 117 and 118:1988.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Retained (%) = retained mass ÷ total retained mass × 100;
                      passing mass = sample mass − cumulative retained mass;
                      passing (%) = passing mass ÷ sample mass × 100. Moisture
                      (%) = (wet − dry) ÷ dry × 100. Silt (%) = (silt before −
                      silt after) ÷ silt before × 100. Chloride (%) = 0.07092 ×
                      (silver nitrate content − (10 × 0.1 × (second titration
                      point − first titration point))). Sulfate (%) = ((crucible
                      + ash − crucible) × 34.3) ÷ 3.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { key: "siltBefore", label: "Silt Before" },
                      { key: "siltAfter", label: "Silt After" },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`sieve-${key}`}>{label}</Label>
                        <Input
                          id={`sieve-${key}`}
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
                    {AGGREGATE_CHEMISTRY_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`sieve-chemistry-${key}`}>{label}</Label>
                        <Input
                          id={`sieve-chemistry-${key}`}
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
                    <div className="space-y-2">
                      <Label htmlFor="sieve-chemical-tested-by">Chemical Tested By</Label>
                      <Input
                        id="sieve-chemical-tested-by"
                        value={String(details.chemicalTestedBy ?? "")}
                        onChange={(event) =>
                          handleDetailChange("chemicalTestedBy", event.target.value)
                        }
                        placeholder="Enter chemical tester"
                      />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      {
                        label: "Moisture Content",
                        value: calculatedMoistureContent
                          ? `${calculatedMoistureContent}%`
                          : "—",
                      },
                      {
                        label: `Silt Content (Limit < ${SIEVE_SILT_LIMIT_PERCENT}%)`,
                        value: calculatedSiltContent === null
                          ? "—"
                          : `${calculatedSiltContent.toFixed(2)}% · ${siltContentStatus}`,
                      },
                      {
                        label: `Chloride Content (Limit ${AGGREGATE_CHLORIDE_LIMIT_PERCENT}%)`,
                        value: calculatedChlorideContent === null
                          ? "—"
                          : `${calculatedChlorideContent.toFixed(2)}% · ${evaluateContentAgainstLimit(
                              calculatedChlorideContent,
                              AGGREGATE_CHLORIDE_LIMIT_PERCENT,
                            )}`,
                      },
                      {
                        label: `Sulfate Content (Limit ${AGGREGATE_SULPHATE_LIMIT_PERCENT}%)`,
                        value: calculatedSulphateContent === null
                          ? "—"
                          : `${calculatedSulphateContent.toFixed(2)}% · ${evaluateContentAgainstLimit(
                              calculatedSulphateContent,
                              AGGREGATE_SULPHATE_LIMIT_PERCENT,
                            )}`,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-2">
                        <Label>{label}</Label>
                        <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground">
                          {value}
                        </div>
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
                      {matchingSieveEntryStandards.length ? (
                        <span>
                          Standard <strong>{Array.from(new Set(matchingSieveEntryStandards.map((standard) => standard.standardReference))).join(", ")}</strong>{" "}
                          provides <strong>{matchingSieveEntryStandards.length} sieve criteria</strong> for {material}. The applicable sieve sizes are listed below.
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          No matching sieve standard is configured for {material || "this material"}. You can still enter retained amounts for the {sieveEntryItems.length} available sieve sizes below; the record will remain in Review until matching standards are configured.{" "}
                          <Link href="/standards" className="font-semibold text-foreground underline underline-offset-2">
                            Configure Standards
                          </Link>{" "}
                          and make sure the material is linked in Reference Data.
                        </span>
                      )}
                    </div>
                  )}
                  {testType === TestType.Precast && (
                    <>
                      <section className="space-y-3 rounded-md border border-primary/20 bg-primary/[0.02] p-4">
                        <div>
                          <h3 className="font-semibold">Precast Strength Criteria</h3>
                          <p className="text-sm text-muted-foreground">
                            Decisions use the average strength of all entered specimens at each age.
                          </p>
                        </div>
                        <div className="overflow-x-auto rounded-md border bg-background">
                          <table className="w-full min-w-[620px] text-sm">
                            <thead className="bg-muted/50">
                              <tr className="border-b text-left">
                                <th className="px-3 py-2 font-semibold">Cube Age</th>
                                <th className="px-3 py-2 font-semibold">Minimum Average</th>
                                <th className="px-3 py-2 font-semibold">Current Average</th>
                                <th className="px-3 py-2 font-semibold">Result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {PRECAST_AGE_STRENGTH_CRITERIA.map((criterion) => {
                                const summary = precastAgeStrengthSummary(
                                  testRows.map((row) => ({
                                    ...row,
                                    calculatedStrength: calculatePrecastStrength(row),
                                  })),
                                  criterion.age,
                                );
                                const outcome = precastStrengthOutcome(
                                  criterion.age,
                                  summary.averageStrength,
                                  summary.complete,
                                );
                                return (
                                  <tr key={criterion.age} className="border-b last:border-b-0">
                                    <td className="px-3 py-2">{criterion.age} day{criterion.age === 1 ? "" : "s"}</td>
                                    <td className="px-3 py-2">≥ {criterion.minimumStrength} N/mm²</td>
                                    <td className="px-3 py-2">
                                      {summary.averageStrength === null
                                        ? "—"
                                        : `${summary.averageStrength.toFixed(2)} N/mm²`}
                                    </td>
                                    <td className={`px-3 py-2 font-semibold ${
                                      outcome === "Pass" || outcome === "Approved for demolding"
                                        ? "text-emerald-700"
                                        : outcome === "Pending"
                                          ? "text-muted-foreground"
                                          : "text-destructive"
                                    }`}>
                                      {outcome}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>

                    </>
                  )}
                   {usesSieveRows && !sieveEntryItems.length ? null : <div className={`${isCompactBlockTable ? "overflow-hidden" : "overflow-x-auto"} rounded-md border`}>
                        <table className={`w-full ${usesSieveRows ? "min-w-[1240px] text-sm" : isCompactBlockTable ? "table-fixed text-[11px]" : testType === TestType.Paving_Blocks ? "min-w-[1440px] text-sm" : testType === TestType.Precast ? "min-w-[980px] text-sm" : "min-w-[1080px] text-sm"}`}>
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                            {testType !== TestType.Precast && (
                              <th className={`${isCompactBlockTable ? "w-[4%] px-1 py-2 text-[10px]" : "w-12 px-3 py-3"} text-left font-semibold`}>No.</th>
                            )}
                          {usesSieveRows ? (
                            <th className="px-3 py-3 text-left font-semibold">Sieve / Pore Size</th>
                          ) : testType === TestType.Ready_Mix || testType === TestType.Precast ? (
                            <th className="px-3 py-3 text-left font-semibold">
                              {testType === TestType.Precast ? "Cube Age (days)" : "Test Age"}
                            </th>
                          ) : null}
                          {usesSieveRows ? (
                            <>
                              <th className="px-3 py-3 text-left font-semibold">Standard</th>
                              <th className="px-3 py-3 text-left font-semibold">Mass Retained (g)</th>
                              <th className="px-3 py-3 text-left font-semibold">Retained (%)</th>
                              <th className="px-3 py-3 text-left font-semibold">Amount Passing (g)</th>
                              <th className="px-3 py-3 text-left font-semibold">Passing (%)</th>
                              <th className="px-3 py-3 text-left font-semibold">Lower Limit</th>
                              <th className="px-3 py-3 text-left font-semibold">Upper Limit</th>
                              <th className="px-3 py-3 text-left font-semibold">Remarks</th>
                            </>
                          ) : testType === TestType.Precast ? (
                            <>
                              <th className="px-3 py-3 text-left font-semibold">Cube Size (mm)</th>
                              <th className="px-3 py-3 text-left font-semibold">Weight (g)</th>
                              <th className="px-3 py-3 text-left font-semibold">Density (kg/m³)</th>
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
                              testType === TestType.Paving_Blocks ||
                              testType === TestType.Precast) && (
                             <>
                               <th className={`${isCompactBlockTable ? "w-[10%] px-1 py-2 text-[10px]" : "px-3 py-3"} text-left font-semibold`}>Load (kN)</th>
                               {testType === TestType.Blocks ? (
                                 <th className="w-[12%] px-1 py-2 text-left text-[10px] font-semibold">Wet Weight (kg)</th>
                               ) : (
                                  <th className="px-3 py-3 text-left font-semibold">
                                     {testType === TestType.Paving_Blocks
                                      ? "Tensile Strength (N/mm²)"
                                       : testType === TestType.Precast
                                         ? "Compressive Strength (N/mm²)"
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
                        {displayedTestRows.map(({ row, rowIndex }, displayIndex) => (
                          <tr key={row.id} className="border-b last:border-b-0">
                             {testType !== TestType.Precast && (
                               <td className={isCompactBlockTable ? "px-1 py-1.5 text-center text-[10px] font-semibold text-muted-foreground" : "px-3 py-2 font-semibold text-muted-foreground"}>{usesSieveRows ? displayIndex + 1 : rowIndex + 1}</td>
                             )}
                            {usesSieveRows ? (
                              <>
                                <td className="px-3 py-2 font-medium">
                                  {row.sieveSize || "Configured sieve size"}
                                </td>
                                <td className="px-2 py-2">
                                  {(() => {
                                    const standard = matchingSieveEntryStandards.find(
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
                                        const visibleRows = nextRows.filter((candidate) =>
                                          isSievePoreSizeAllowed(
                                            testType,
                                            material,
                                            candidate.sieveSize,
                                          ),
                                        );
                                        const calculatedRows = calculateSieveResults(visibleRows);
                                        let visibleIndex = 0;
                                        return nextRows.map((candidate) => {
                                          if (!isSievePoreSizeAllowed(
                                            testType,
                                            material,
                                            candidate.sieveSize,
                                          )) {
                                            return candidate;
                                          }
                                          return {
                                            ...candidate,
                                            ...calculatedRows[visibleIndex++],
                                          };
                                        });
                                      });
                                    }}
                                     placeholder="Optional"
                                     aria-required="false"
                                    aria-label={`Amount returned for row ${displayIndex + 1}`}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 font-semibold text-foreground">
                                    {calculateRetainedPercentage(
                                      row.amountReturned,
                                      calculatedSieveSampleWeight,
                                    )
                                      ? `${calculateRetainedPercentage(
                                          row.amountReturned,
                                          calculatedSieveSampleWeight,
                                        )}%`
                                      : "—"}
                                  </div>
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
                                <td className="px-2 py-2">
                                  {(() => {
                                    const standard = matchingSieveEntryStandards.find(
                                      (candidate) =>
                                        candidate.sieveSizeReferenceItemId ===
                                        row.sieveSizeReferenceItemId,
                                    );
                                    return standard?.minimum == null
                                      ? "—"
                                      : `${standard.minimum}${standard.unit ? ` ${standard.unit}` : ""}`;
                                  })()}
                                </td>
                                <td className="px-2 py-2">
                                  {(() => {
                                    const standard = matchingSieveEntryStandards.find(
                                      (candidate) =>
                                        candidate.sieveSizeReferenceItemId ===
                                        row.sieveSizeReferenceItemId,
                                    );
                                    return standard?.maximum == null
                                      ? "—"
                                      : `${standard.maximum}${standard.unit ? ` ${standard.unit}` : ""}`;
                                  })()}
                                </td>
                                <td className="px-2 py-2">
                                  {(() => {
                                    const standard = matchingSieveEntryStandards.find(
                                      (candidate) =>
                                        candidate.sieveSizeReferenceItemId ===
                                        row.sieveSizeReferenceItemId,
                                    );
                                    if (!standard) return "Pending";
                                    const measuredValue =
                                      standard.measurementType === "amount"
                                        ? row.passingAmount
                                        : row.passingPercentage;
                                    const result = evaluateSieveValue(
                                      measuredValue,
                                      standard.minimum,
                                      standard.maximum,
                                    );
                                    return (
                                      <span
                                        className={
                                          result === "Pass"
                                            ? "font-semibold text-green-700"
                                            : result === "Fail"
                                              ? "font-semibold text-red-700"
                                              : "text-muted-foreground"
                                        }
                                      >
                                        {result}
                                      </span>
                                    );
                                  })()}
                                </td>
                              </>
                            ) : (
                            <>
                            {(testType === TestType.Ready_Mix || testType === TestType.Precast) && (
                              <td className="px-2 py-2">
                              <Input
                                ref={element => {
                                  rowInputRefs.current[row.id] = element;
                                }}
                                type="text"
                                inputMode="numeric"
                                value={row.testAge}
                                onChange={event => updateTestRow(rowIndex, "testAge", event.target.value)}
                                placeholder="Days"
                                aria-label={`${testType === TestType.Precast ? "Cube" : "Test"} age for row ${rowIndex + 1}`}
                              />
                            </td>
                            )}
                            {testType === TestType.Precast && (
                              <td className="px-2 py-2 font-medium tabular-nums">
                                {String(details.cubeSize ?? DEFAULT_PRECAST_CUBE_SIZE).replace(/\*/g, " × ")}
                              </td>
                            )}
                            {testType === TestType.Precast && (
                              <>
                                <td className="px-2 py-2">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={row.weight}
                                    onChange={(event) =>
                                      updateTestRow(rowIndex, "weight", event.target.value)
                                    }
                                    placeholder="g"
                                    aria-label={`Cube weight in grams for specimen ${rowIndex + 1}`}
                                  />
                                </td>
                                <td className="px-3 py-2 font-semibold">
                                  {calculateCubeDensity(
                                    details.cubeSize || DEFAULT_PRECAST_CUBE_SIZE,
                                    row.weight,
                                  )
                                    ? `${calculateCubeDensity(
                                        details.cubeSize || DEFAULT_PRECAST_CUBE_SIZE,
                                        row.weight,
                                      )} kg/m³`
                                    : "Enter weight and a valid cube size"}
                                </td>
                              </>
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
                                testType === TestType.Paving_Blocks ||
                                testType === TestType.Precast) && (
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
                                      {testType === TestType.Precast
                                        ? calculatePrecastStrength(row)
                                          ? `${calculatePrecastStrength(row)} N/mm²`
                                          : "Enter a valid cube size and load"
                                        : testType === TestType.Paving_Blocks
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

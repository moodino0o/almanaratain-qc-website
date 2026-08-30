import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetLookups, useGetRecord, useCreateRecord, useUpdateRecord, useListStrengthStandards, TestType, RecordStatus, QcRecordInput, QcRecordUpdate } from "@workspace/api-client-react";
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
});

const REFERENCE_NUMBER_MAX_LENGTH = 32;
const stringValue = (value: unknown) => (value == null ? "" : String(value));

const numericInputValue = (value: unknown) => {
  const match = stringValue(value).match(/[-+]?(?:\d+\.?\d*|\.\d+)/);
  return match?.[0] ?? "";
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
    strength: "",
    waterAbsorption: numericInputValue(values.waterAbsorption),
  };
};

export default function RecordForm() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const recordId = id ? Number(id) : 0;
  const isEditing = Number.isInteger(recordId) && recordId > 0;
  const queryClient = useQueryClient();
  
  const { data: lookups, isLoading: lookupsLoading } = useGetLookups();
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
  
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [testRows, setTestRows] = useState<TestRow[]>([createEmptyRow(1)]);
  const nextRowId = useRef(2);
  const rowInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!isEditing || !existingRecord || initializedRecordId.current === recordId) return;

    const savedDetails =
      typeof existingRecord.details === "object" && existingRecord.details !== null
        ? { ...existingRecord.details as Record<string, unknown> }
        : {};
    const savedRows = Array.isArray(savedDetails.testRows) ? savedDetails.testRows : [];
    const numericDetailKeys = [
      "slump",
      "temperature",
      "airContent",
      "weight",
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
    setDetails(savedDetails);
    setTestRows(
      savedRows.length
        ? savedRows.map((row, index) => toFormRow(row, index + 1))
        : [createEmptyRow(1)],
    );
    nextRowId.current = Math.max(savedRows.length + 1, 2);
    initializedRecordId.current = recordId;
  }, [existingRecord, isEditing, recordId]);

  const handleDetailChange = (key: string, value: string) => {
    setDetails(prev => ({ ...prev, [key]: value }));
  };

  const usesTestRows = testType === TestType.Ready_Mix || testType === TestType.Blocks;

  const updateTestRow = (rowIndex: number, key: keyof Omit<TestRow, "id">, value: string) => {
    setTestRows(prev => prev.map((row, index) => (
      index === rowIndex ? { ...row, [key]: value } : row
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
          { key: "temperature", label: "Temperature (°C)", type: "number" },
          { key: "airContent", label: "Air Content (%)", type: "number" }
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
        return [
          { key: "passing10mm", label: "Passing 10mm (%)", type: "number" },
          { key: "passing5mm", label: "Passing 5mm (%)", type: "number" },
          { key: "finenessModulus", label: "Fineness Modulus", type: "number" },
          { key: "moisture", label: "Moisture Content (%)", type: "number" }
        ];
      default:
        return [
          { key: "observation1", label: "Observation 1", type: "text" },
          { key: "observation2", label: "Observation 2", type: "text" }
        ];
    }
  };

  const applicableStandard = useMemo(() => {
    if (testType !== TestType.Ready_Mix && testType !== TestType.Blocks) return undefined;
    return strengthStandards?.find((standard) => (
      standard.testType === testType &&
      standard.material === material &&
      (testType !== TestType.Blocks ||
        (standard.blockType === String(details.blockType ?? "") &&
          standard.blockSize === String(details.blockSize ?? "")))
    ));
  }, [details.blockSize, details.blockType, material, strengthStandards, testType]);

  const calculateStrength = (row: TestRow) => {
    const load = Number(row.load);
    const length = Number(row.length);
    const width = Number(row.width);
    if (![load, length, width].every(Number.isFinite) || load < 0 || length <= 0 || width <= 0) {
      return null;
    }
    return ((load * 1000) / (length * width)).toFixed(2);
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

    if (testType === TestType.Ready_Mix) {
      payloadDetails.customerName = customerName;
      payloadDetails.customerLocation = customerLocation;
      payloadDetails.referenceNumber = referenceNumber.trim();
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
              waterAbsorption: row.waterAbsorption,
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

  if (lookupsLoading || (isEditing && recordLoading)) {
    return <div className="p-8 text-center text-muted-foreground">Loading form data...</div>;
  }

  if (isEditing && (recordError || !existingRecord)) {
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

      <form onSubmit={handleSubmit}>
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
                {usesTestRows
                  ? "Enter one specimen per row. Press Enter in a row to insert the next numbered entry."
                  : "Enter the specific readings obtained during the test."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {testType === TestType.Ready_Mix && (
                <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
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
              {usesTestRows ? (
                <div className="space-y-3">
                  {(testType === TestType.Ready_Mix || testType === TestType.Blocks) && (
                    <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
                      {applicableStandard ? (
                        <span>
                          Automatic evaluation: specimens are compared with{" "}
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
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[1080px] text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="w-12 px-3 py-3 text-left font-semibold">No.</th>
                          {testType === TestType.Ready_Mix ? (
                            <th className="px-3 py-3 text-left font-semibold">Test Age</th>
                          ) : (
                            <th className="px-3 py-3 text-left font-semibold">Sample Age</th>
                          )}
                          <th className="px-3 py-3 text-left font-semibold">Length (mm)</th>
                          <th className="px-3 py-3 text-left font-semibold">Width (mm)</th>
                          <th className="px-3 py-3 text-left font-semibold">Height (mm)</th>
                          <th className="px-3 py-3 text-left font-semibold">Dry Weight</th>
                          <th className="px-3 py-3 text-left font-semibold">Wet Weight</th>
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
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTestRow(rowIndex)}
                                disabled={testRows.length === 1}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button type="button" variant="outline" onClick={() => insertTestRow(testRows.length - 1)}>
                    + Add row
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Pressing Enter adds a new numbered row after the current row.
                  </p>
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

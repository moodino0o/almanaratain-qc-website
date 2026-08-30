import { useState } from "react";
import { useLocation } from "wouter";
import { useGetLookups, useCreateRecord, TestType, RecordStatus, QcRecordInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { getListRecordsQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function RecordForm() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: lookups, isLoading: lookupsLoading } = useGetLookups();
  const createRecord = useCreateRecord();

  const [testType, setTestType] = useState<TestType>(TestType.Ready_Mix);
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 16));
  const [locationValue, setLocationValue] = useState("");
  const [material, setMaterial] = useState("");
  const [testedBy, setTestedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  
  const [details, setDetails] = useState<Record<string, string>>({});

  const handleDetailChange = (key: string, value: string) => {
    setDetails(prev => ({ ...prev, [key]: value }));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationValue || !material || !testedBy) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const payload: QcRecordInput = {
      testType,
      sampleDate: new Date(sampleDate).toISOString(),
      location: locationValue,
      material,
      status: RecordStatus.Review, 
      testedBy,
      remarks,
      details
    };

    createRecord.mutate({ data: payload }, {
      onSuccess: (newRecord) => {
        toast.success(`Record ${newRecord.recordNo} has been saved.`);
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setLocation(`/records/${newRecord.id}`);
      },
      onError: () => {
        toast.error("Failed to create record. Please try again.");
      }
    });
  };

  if (lookupsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading form data...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link href="/records" className="p-2 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New QC Record</h1>
          <p className="text-muted-foreground text-sm">Enter test measurements and details for quality assurance.</p>
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
                <Select value={testType} onValueChange={(val: TestType) => { setTestType(val); setDetails({}); }}>
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
                <Label>Sample Date & Time <span className="text-destructive">*</span></Label>
                <Input 
                  type="datetime-local" 
                  value={sampleDate} 
                  onChange={e => setSampleDate(e.target.value)} 
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Location / Plant <span className="text-destructive">*</span></Label>
                <Select value={locationValue} onValueChange={setLocationValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {lookups?.locations.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Material / Product <span className="text-destructive">*</span></Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {lookups?.materials.map(mat => (
                      <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                    ))}
                    {lookups?.blockTypes.map(mat => (
                      <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tested By (Technician) <span className="text-destructive">*</span></Label>
                <Select value={testedBy} onValueChange={setTestedBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {lookups?.employees.map(emp => (
                      <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Measurement Details: {testType}</CardTitle>
              <CardDescription>Enter the specific readings obtained during the test.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
              {getDynamicFields().map(field => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input 
                    type={field.type} 
                    value={details[field.key] || ""} 
                    onChange={e => handleDetailChange(field.key, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                </div>
              ))}
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
              <p className="text-sm text-muted-foreground">New records are created in 'Review' status pending supervisor approval.</p>
              <Button type="submit" disabled={createRecord.isPending} size="lg">
                {createRecord.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Record
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Check, FileImage, Loader2, Plus, Upload, X } from "lucide-react";
import { useCreateComplaint, useCreateReferenceItem, useGetComplaint, useGetReferenceData, useRequestUploadUrl, useUpdateComplaint, type ComplaintInput, type ComplaintPicture } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetComplaintQueryKey, getGetReferenceDataQueryKey, getListComplaintsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@workspace/replit-auth-web";

const maxPictureSize = 10 * 1024 * 1024;

function dateOnly(value: string) {
  return value ? value.slice(0, 10) : "";
}

function uploadFile(url: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage upload failed (${request.status})`));
      }
    };
    request.onerror = () => reject(new Error("Storage upload failed. Check the connection and try again."));
    request.onabort = () => reject(new Error("Storage upload was cancelled."));
    request.send(file);
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Storage upload failed.";
}

export default function ComplaintForm() {
  const { role } = useAuth();
  const canEditComplaints = role === "managerial" || role === "administrator";
  const canEditReferenceData = role === "administrator";
  const { id } = useParams();
  const isNew = !id || id === "new";
  const complaintId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const detailQuery = useGetComplaint(complaintId, { query: { enabled: !isNew && Number.isFinite(complaintId), queryKey: getGetComplaintQueryKey(complaintId) } });
  const referenceQuery = useGetReferenceData();
  const createComplaint = useCreateComplaint();
  const updateComplaint = useUpdateComplaint();
  const requestUrl = useRequestUploadUrl();
  const createReferenceItem = useCreateReferenceItem();
  const fileRef = useRef<HTMLInputElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [complaintType, setComplaintType] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [details, setDetails] = useState("");
  const [solution, setSolution] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [pictures, setPictures] = useState<ComplaintPicture[]>([]);
  const [customType, setCustomType] = useState("");
  const [customMaterial, setCustomMaterial] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const initializedId = useRef<number | null>(null);

  const categories = referenceQuery.data?.categories ?? [];
  const typeCategory = categories.find((category) => category.key === "complaintTypes");
  const materialCategory = categories.find((category) => category.key === "complaintMaterials");
  const typeOptions = useMemo(() => {
    const values = typeCategory?.items.map((item) => item.value) ?? [];
    return !isNew && detailQuery.data?.complaintType && !values.includes(detailQuery.data.complaintType)
      ? [detailQuery.data.complaintType, ...values]
      : values;
  }, [detailQuery.data?.complaintType, isNew, typeCategory]);
  const materialOptions = useMemo(() => {
    const values = materialCategory?.items.map((item) => item.value) ?? [];
    return !isNew && detailQuery.data?.materialType && !values.includes(detailQuery.data.materialType)
      ? [detailQuery.data.materialType, ...values]
      : values;
  }, [detailQuery.data?.materialType, isNew, materialCategory]);

  useEffect(() => {
    if (!isNew && detailQuery.data && initializedId.current !== complaintId) {
      initializedId.current = complaintId;
      const complaint = detailQuery.data;
      setCustomerName(complaint.customerName);
      setDeliveryDate(dateOnly(complaint.deliveryDate));
      setComplaintType(complaint.complaintType);
      setMaterialType(complaint.materialType);
      setDetails(complaint.details);
      setSolution(complaint.solution);
      setRecommendation(complaint.recommendation);
      setPictures(complaint.picturePaths);
    }
  }, [complaintId, detailQuery.data, isNew]);

  const selectedType = complaintType === "__custom__" ? customType.trim() : complaintType;
  const selectedMaterial = materialType === "__custom__" ? customMaterial.trim() : materialType;

  async function addReference(categoryId: number | undefined, value: string) {
    if (!categoryId || !value.trim()) return;
    try {
      await createReferenceItem.mutateAsync({ categoryId, data: { value: value.trim() } });
      await queryClient.invalidateQueries({ queryKey: getGetReferenceDataQueryKey() });
      toast.success("Added to reference data");
    } catch {
      toast.error("Could not add this value to reference data");
    }
  }

  async function addPictures(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const failed: string[] = [];
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/") || file.size > maxPictureSize) {
          failed.push(`${file.name}: choose an image smaller than 10 MB.`);
          continue;
        }
        try {
          const signed = await requestUrl.mutateAsync({
            data: {
              name: file.name,
              size: file.size,
              contentType: file.type || "application/octet-stream",
              purpose: "complaint",
            },
          });
          await uploadFile(signed.uploadURL, file);
          setPictures((current) => [
            ...current,
            {
              objectPath: signed.objectPath,
              originalName: file.name,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
            },
          ]);
          uploadedCount += 1;
        } catch (error) {
          failed.push(`${file.name}: ${errorMessage(error)}`);
        }
      }
      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} picture${uploadedCount === 1 ? "" : "s"} attached.`);
      }
      if (failed.length > 0) {
        toast.error(failed.length === 1 ? failed[0] : `${failed.length} pictures could not be attached.`);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerName.trim() || !deliveryDate || !selectedType || !selectedMaterial || !details.trim()) {
      toast.error("Complete the required complaint fields before saving.");
      return;
    }
    const data: ComplaintInput = { customerName: customerName.trim(), deliveryDate, complaintType: selectedType, materialType: selectedMaterial, details: details.trim(), solution: solution.trim(), recommendation: recommendation.trim(), picturePaths: pictures };
    setSaving(true);
    try {
      if (isNew) {
        const created = await createComplaint.mutateAsync({ data });
        await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        toast.success("Complaint recorded");
        setLocation(`/complaints/${created.id}`);
      } else {
        await updateComplaint.mutateAsync({ id: complaintId, data });
        await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetComplaintQueryKey(complaintId) });
        toast.success("Complaint updated");
        setLocation(`/complaints/${complaintId}`);
      }
    } catch {
      toast.error(isNew ? "Complaint could not be recorded." : "Complaint could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && detailQuery.isLoading) return <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  if (!isNew && (detailQuery.isError || !detailQuery.data)) return <Card className="mx-auto mt-10 max-w-lg text-center"><CardContent className="space-y-4 p-10"><h1 className="text-lg font-semibold">Complaint could not be loaded</h1><Button asChild variant="outline"><Link href="/complaints">Back to complaints</Link></Button></CardContent></Card>;
  if (!canEditComplaints) return <Card className="mx-auto mt-12 max-w-lg text-center"><CardContent className="space-y-3 p-10"><h1 className="text-lg font-semibold">View-only access</h1><p className="text-sm text-muted-foreground">Your access role can view complaints but cannot add or change them.</p><Button asChild variant="outline"><Link href={isNew ? "/complaints" : `/complaints/${complaintId}`}>Back to Complaints</Link></Button></CardContent></Card>;

  return (
    <div className="complaint-page mx-auto max-w-4xl space-y-6 pb-12">
       <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
         <img src="/al-manaratain-logo.webp" alt="Al Manaratain" className="h-14 w-auto object-contain" />
         <div>
           <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">AL MANARATAIN</p>
           <p className="mt-1 text-sm text-muted-foreground">Al Manaratain Company &amp; Ali Shaab Group W.L.L</p>
         </div>
       </div>
      <div className="flex items-start gap-3"><Link href={isNew ? "/complaints" : `/complaints/${complaintId}`} className="mt-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link><div><p className="complaint-kicker">{isNew ? "New record" : "Amend controlled record"}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{isNew ? "Record a complaint" : "Edit complaint"}</h1><p className="mt-2 text-sm text-muted-foreground">Capture the customer concern, delivery context, response, and evidence in one official record.</p></div></div>
      <form onSubmit={submit} className="space-y-5">
        <Card><CardHeader className="border-b bg-muted/20"><CardTitle className="text-base">Complaint identity</CardTitle></CardHeader><CardContent className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="customer">Customer name <span className="text-destructive">*</span></Label><Input id="customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required placeholder="Customer or account name" /></div>
          <div className="space-y-2"><Label htmlFor="delivery">Delivery date <span className="text-destructive">*</span></Label><Input id="delivery" type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="complaintType">Complaint type <span className="text-destructive">*</span></Label><select id="complaintType" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={complaintType} onChange={(event) => setComplaintType(event.target.value)} required><option value="">Choose complaint type</option>{typeOptions.map((item) => <option key={item}>{item}</option>)}<option value="__custom__">Custom value</option></select>{complaintType === "__custom__" && <div className="flex gap-2"><Input value={customType} onChange={(event) => setCustomType(event.target.value)} placeholder="Type a complaint type" required />{canEditReferenceData && <Button type="button" variant="outline" size="icon" title="Add to reference data" onClick={() => void addReference(typeCategory?.id, customType)} disabled={!customType.trim() || createReferenceItem.isPending}><Plus className="h-4 w-4" /></Button>}</div>}</div>
          <div className="space-y-2"><Label htmlFor="materialType">Material type <span className="text-destructive">*</span></Label><select id="materialType" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={materialType} onChange={(event) => setMaterialType(event.target.value)} required><option value="">Choose material type</option>{materialOptions.map((item) => <option key={item}>{item}</option>)}<option value="__custom__">Custom value</option></select>{materialType === "__custom__" && <div className="flex gap-2"><Input value={customMaterial} onChange={(event) => setCustomMaterial(event.target.value)} placeholder="Type a material type" required />{canEditReferenceData && <Button type="button" variant="outline" size="icon" title="Add to reference data" onClick={() => void addReference(materialCategory?.id, customMaterial)} disabled={!customMaterial.trim() || createReferenceItem.isPending}><Plus className="h-4 w-4" /></Button>}</div>}</div>
        </CardContent></Card>
        <Card><CardHeader className="border-b bg-muted/20"><CardTitle className="text-base">Complaint review</CardTitle></CardHeader><CardContent className="space-y-5 p-5">
          <div className="space-y-2"><Label htmlFor="details">Complaint details <span className="text-destructive">*</span></Label><Textarea id="details" value={details} onChange={(event) => setDetails(event.target.value)} required rows={6} placeholder="Describe what was reported, observed, and when it was raised." /></div>
          <div className="grid gap-5 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="solution">Solution / action taken</Label><Textarea id="solution" value={solution} onChange={(event) => setSolution(event.target.value)} rows={5} placeholder="Record the response, replacement, investigation, or corrective action." /></div><div className="space-y-2"><Label htmlFor="recommendation">Recommendation</Label><Textarea id="recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value)} rows={5} placeholder="Note prevention steps or follow-up recommended by QC." /></div></div>
        </CardContent></Card>
        <Card><CardHeader className="border-b bg-muted/20"><CardTitle className="text-base">Picture evidence</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><div className="flex flex-col justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-4 sm:flex-row sm:items-center"><div><p className="font-medium">Attach delivery or product pictures</p><p className="mt-1 text-xs text-muted-foreground">Images only, up to 10 MB each. Files are stored securely; only their paths are saved in this record.</p></div><Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading</> : <><Upload className="mr-2 h-4 w-4" />Choose pictures</>}<input ref={fileRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => void addPictures(event.target.files)} /></Button></div>{pictures.length > 0 && <div className="space-y-2">{pictures.map((picture) => <div key={picture.objectPath} className="flex items-center gap-3 rounded-md border p-2"><img src={`/api/storage${picture.objectPath}`} alt="" className="h-12 w-16 rounded object-cover" /><FileImage className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm">{picture.originalName}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${picture.originalName}`} onClick={() => setPictures((current) => current.filter((item) => item.objectPath !== picture.objectPath))}><X className="h-4 w-4" /></Button></div>)}</div>}</CardContent></Card>
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="outline" asChild><Link href={isNew ? "/complaints" : `/complaints/${complaintId}`}>Cancel</Link></Button><Button type="submit" disabled={saving || uploading || requestUrl.isPending}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving</> : <><Check className="mr-2 h-4 w-4" />{isNew ? "Record complaint" : "Save changes"}</>}</Button></div>
      </form>
    </div>
  );
}
import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Folder, Upload, Download, Eye, Search } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  listArchive,
  useCreateArchiveDocument,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const accepted = ".pdf,.doc,.docx,.xls,.xlsx";
const maxSize = 25 * 1024 * 1024;

function uploadFile(url: string, file: File, setProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) =>
      event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error("Storage upload failed"));
    request.onerror = () => reject(new Error("Storage upload failed"));
    request.send(file);
  });
}

export default function Archive() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const archive = useQuery({
    queryKey: ["archive"],
    queryFn: () => listArchive(),
    enabled: isAuthenticated,
  });
  const requestUrl = useRequestUploadUrl();
  const createDocument = useCreateArchiveDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState(0);

  const documents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (archive.data?.documents ?? []).filter((doc) =>
      !term || `${doc.originalName} ${doc.category} ${doc.subcategory} ${doc.description}`
        .toLowerCase().includes(term),
    );
  }, [archive.data, search]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !category.trim() || !subcategory.trim()) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "doc", "docx", "xls", "xlsx"].includes(extension) || file.size > maxSize) {
      toast.error("Choose a PDF, Word, or Excel file up to 25 MB.");
      return;
    }
    try {
      setProgress(1);
      const signed = await requestUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" },
      });
      await uploadFile(signed.uploadURL, file, setProgress);
      await createDocument.mutateAsync({
        data: {
          originalName: file.name,
          objectPath: signed.objectPath,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          category: category.trim(),
          subcategory: subcategory.trim(),
          description: description.trim(),
        },
      });
      toast.success("Document added to the archive.");
      setFile(null); setDescription(""); setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
      await archive.refetch();
    } catch {
      toast.error("The document could not be uploaded. You can try again.");
      setProgress(0);
    }
  }

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Checking archive access…</div>;
  if (!isAuthenticated) return (
    <Card className="mx-auto mt-16 max-w-lg text-center">
      <CardHeader><CardTitle>Private document archive</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Sign in to upload, review, and download controlled documents.</p>
        <Button onClick={login}>Sign in with Replit</Button>
      </CardContent>
    </Card>
  );

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Document Archive</h1><p className="text-muted-foreground">Controlled PDF, Word, and Excel documents.</p></div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload document</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label>File</Label><Input ref={fileRef} type="file" accept={accepted} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-2"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Procedures" /></div>
          <div className="space-y-2"><Label>Subcategory</Label><Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g. Ready Mix" /></div>
          <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {progress > 0 && <div className="md:col-span-2"><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{progress}% uploaded</p></div>}
          <Button type="submit" disabled={!file || !category.trim() || !subcategory.trim() || requestUrl.isPending || createDocument.isPending}>Upload to archive</Button>
        </form>
      </CardContent>
    </Card>
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card><CardHeader><CardTitle>Folders</CardTitle></CardHeader><CardContent className="space-y-3">
        {archive.data?.categories.length ? archive.data.categories.map((folder) => <div key={folder.name}><div className="flex items-center gap-2 font-medium"><Folder className="h-4 w-4 text-primary" />{folder.name} <span className="text-xs text-muted-foreground">({folder.count})</span></div><div className="ml-6 mt-1 space-y-1 text-sm text-muted-foreground">{folder.subcategories.map((sub) => <div key={sub.name}>{sub.name} ({sub.count})</div>)}</div></div>) : <p className="text-sm text-muted-foreground">No folders yet.</p>}
      </CardContent></Card>
      <Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>Documents</CardTitle><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search archive" /></div></div></CardHeader>
        <CardContent className="space-y-2">{archive.isLoading ? <p>Loading…</p> : documents.length ? documents.map((doc) => <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="rounded bg-primary/10 p-2 text-primary">{doc.mimeType.includes("spreadsheet") || doc.originalName.endsWith("xlsx") ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.originalName}</p><p className="text-xs text-muted-foreground">{doc.category} / {doc.subcategory} · {(doc.size / 1024).toFixed(1)} KB</p></div>{doc.mimeType === "application/pdf" || doc.originalName.toLowerCase().endsWith(".pdf") ? <Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/content`} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Review</a></Button> : null}<Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/download`}><Download className="mr-2 h-4 w-4" />Download</a></Button></div>) : <p className="py-10 text-center text-sm text-muted-foreground">No matching documents.</p>}</CardContent>
      </Card>
    </div>
  </div>;
}
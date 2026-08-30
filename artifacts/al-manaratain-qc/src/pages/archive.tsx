import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Folder, Upload, Download, Eye, Search, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { listArchive, useCreateArchiveDocument, useRequestUploadUrl, useRetireArchiveDocument } from "@workspace/api-client-react";
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
    request.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Storage upload failed"));
    request.onerror = () => reject(new Error("Storage upload failed"));
    request.send(file);
  });
}

export default function Archive() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const archive = useQuery({ queryKey: ["archive"], queryFn: () => listArchive(), enabled: isAuthenticated });
  const requestUrl = useRequestUploadUrl();
  const createDocument = useCreateArchiveDocument();
  const retireDocument = useRetireArchiveDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ category: string; subcategory?: string } | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState(0);

  const visibleDocuments = useMemo(() => {
    const folderDocs = selectedFolder
      ? (archive.data?.documents ?? []).filter((doc) => doc.category === selectedFolder.category && (!selectedFolder.subcategory || doc.subcategory === selectedFolder.subcategory))
      : [];
    const term = search.trim().toLowerCase();
    return folderDocs.filter((doc) => !term || `${doc.originalName} ${doc.description} ${doc.documentDate}`.toLowerCase().includes(term));
  }, [archive.data, selectedFolder, search]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !category.trim() || !subcategory.trim() || !documentDate) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "doc", "docx", "xls", "xlsx"].includes(extension) || file.size > maxSize) {
      toast.error("Choose a PDF, Word, or Excel file up to 25 MB.");
      return;
    }
    try {
      setProgress(1);
      const signed = await requestUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" } });
      await uploadFile(signed.uploadURL, file, setProgress);
      await createDocument.mutateAsync({ data: { originalName: file.name, objectPath: signed.objectPath, mimeType: file.type || "application/octet-stream", size: file.size, category: category.trim(), subcategory: subcategory.trim(), documentDate, description: description.trim() } });
      toast.success("Document added to the archive.");
      setFile(null); setDescription(""); setProgress(0); setShowEntry(false);
      if (fileRef.current) fileRef.current.value = "";
      await archive.refetch();
    } catch {
      toast.error("The document could not be uploaded. You can try again.");
      setProgress(0);
    }
  }

  async function retire(documentId: number, originalName: string) {
    if (!archive.data?.canRetire) return;
    if (!window.confirm(`Retire "${originalName}"? The stored file and archive metadata will be permanently removed.`)) return;

    try {
      await retireDocument.mutateAsync({ id: documentId });
      toast.success("Document retired from the archive.");
      await archive.refetch();
    } catch {
      toast.error("The document could not be retired. Please try again.");
    }
  }

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Checking archive access…</div>;
  if (!isAuthenticated) return <Card className="mx-auto mt-16 max-w-lg text-center"><CardHeader><CardTitle>Private document archive</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Sign in to upload, review, and download controlled documents.</p><Button onClick={login}>Sign in with Replit</Button></CardContent></Card>;

  const selectedTitle = selectedFolder ? `${selectedFolder.category}${selectedFolder.subcategory ? ` / ${selectedFolder.subcategory}` : ""}` : "Document categories";
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Document Archive</h1><p className="text-muted-foreground">Browse controlled documents by category.</p></div>
      <Button onClick={() => setShowEntry((value) => !value)}><Plus className="mr-2 h-4 w-4" />Add document</Button>
    </div>
    {showEntry && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Document data entry</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2"><Label>File</Label><Input ref={fileRef} type="file" accept={accepted} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      <div className="space-y-2"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Procedures" /></div>
      <div className="space-y-2"><Label>Subcategory</Label><Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g. Ready Mix" /></div>
      <div className="space-y-2"><Label>Document date</Label><Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} /></div>
      <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      {progress > 0 && <div className="md:col-span-2"><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{progress}% uploaded</p></div>}
      <Button type="submit" disabled={!file || !category.trim() || !subcategory.trim() || requestUrl.isPending || createDocument.isPending}>Save document</Button>
    </form></CardContent></Card>}
    {!selectedFolder ? <Card><CardHeader><CardTitle>Categories</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{archive.data?.categories.length ? archive.data.categories.map((folder) => <button key={folder.name} onClick={() => setSelectedFolder({ category: folder.name })} className="flex items-center gap-3 rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"><Folder className="h-7 w-7 text-primary" /><span><span className="block font-medium">{folder.name}</span><span className="text-xs text-muted-foreground">{folder.count} document{folder.count === 1 ? "" : "s"}</span></span></button>) : <p className="text-sm text-muted-foreground">No categories yet. Use Add document to create one.</p>}</CardContent></Card> : <div className="space-y-4">
      <Button variant="ghost" onClick={() => { setSelectedFolder(null); setSearch(""); }}><ArrowLeft className="mr-2 h-4 w-4" />All categories</Button>
      {!selectedFolder.subcategory && <Card><CardHeader><CardTitle>{selectedTitle} subcategories</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(archive.data?.categories.find((folder) => folder.name === selectedFolder.category)?.subcategories ?? []).map((sub) => <button key={sub.name} onClick={() => setSelectedFolder({ category: selectedFolder.category, subcategory: sub.name })} className="flex items-center gap-3 rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"><Folder className="h-6 w-6 text-primary" /><span><span className="block font-medium">{sub.name}</span><span className="text-xs text-muted-foreground">{sub.count} document{sub.count === 1 ? "" : "s"}</span></span></button>)}</CardContent></Card>}
       {selectedFolder.subcategory && <Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>{selectedTitle}</CardTitle><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this folder" /></div></div></CardHeader><CardContent className="space-y-2">{visibleDocuments.length ? visibleDocuments.map((doc) => <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="rounded bg-primary/10 p-2 text-primary">{doc.mimeType.includes("spreadsheet") || doc.originalName.endsWith("xlsx") ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.originalName}</p><p className="text-xs text-muted-foreground">{doc.documentDate} · {(doc.size / 1024).toFixed(1)} KB</p></div>{doc.originalName.toLowerCase().endsWith(".pdf") && <Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/content`} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Review</a></Button>}<Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/download`}><Download className="mr-2 h-4 w-4" />Download</a></Button>{archive.data?.canRetire ? <Button type="button" variant="outline" size="sm" disabled={retireDocument.isPending} onClick={() => retire(doc.id, doc.originalName)}><Trash2 className="mr-2 h-4 w-4" />Retire</Button> : null}</div>) : <p className="py-10 text-center text-sm text-muted-foreground">No documents in this folder.</p>}</CardContent></Card>}
    </div>}
  </div>;
}
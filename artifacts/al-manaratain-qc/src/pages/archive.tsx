import { useMemo, useRef, useState } from "react";
import { Folder, Upload, Download, Eye, Search, ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { listArchive, useCreateArchiveDocument, useRequestUploadUrl, useRetireArchiveDocument, useUpdateArchiveDocument } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const accepted = ".pdf,.doc,.docx,.xls,.xlsx";
const maxSize = 25 * 1024 * 1024;

function dateOnly(value: string): string {
  return value.split("T")[0];
}

function expiryStatus(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = dateOnly(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryUtc = Date.UTC(year, month - 1, day);
  const daysRemaining = Math.ceil((expiryUtc - todayUtc) / 86_400_000);

  if (daysRemaining < 0) {
    return {
      label: "Expired",
      className: "bg-destructive/10 text-destructive",
      dotClassName: "bg-destructive",
    };
  }
  if (daysRemaining <= 30) {
    return {
      label: daysRemaining === 0 ? "Expires today" : `Expires in ${daysRemaining}d`,
      className: "bg-warning/15 text-warning-foreground",
      dotClassName: "bg-warning",
    };
  }
  return null;
}

function ExpiryInfo({ expiryDate }: { expiryDate?: string | null }) {
  const status = expiryStatus(expiryDate);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Expiry: {expiryDate ? dateOnly(expiryDate) : "No expiry date"}</span>
      {status && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${status.className}`}
          title={status.label}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} aria-hidden="true" />
          <span>{status.label}</span>
        </span>
      )}
    </div>
  );
}

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
  const { isAuthenticated, isLoading, login, role } = useAuth();
  const canManageArchive = role === "administrator";
  const archive = useQuery({ queryKey: ["archive"], queryFn: () => listArchive(), enabled: isAuthenticated });
  const requestUrl = useRequestUploadUrl();
  const createDocument = useCreateArchiveDocument();
  const retireDocument = useRetireArchiveDocument();
  const updateDocument = useUpdateArchiveDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ category: string; subcategory?: string } | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState(0);
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editDocumentDate, setEditDocumentDate] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const visibleDocuments = useMemo(() => {
    const folderDocs = selectedFolder
      ? (archive.data?.documents ?? []).filter((doc) => doc.category === selectedFolder.category && (!selectedFolder.subcategory || doc.subcategory === selectedFolder.subcategory))
      : [];
    const term = search.trim().toLowerCase();
    return folderDocs.filter((doc) => !term || `${doc.originalName} ${doc.description} ${doc.documentDate}`.toLowerCase().includes(term));
  }, [archive.data, selectedFolder, search]);

  const globalDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return (archive.data?.documents ?? []).filter((doc) =>
      `${doc.originalName} ${doc.category} ${doc.subcategory} ${doc.description} ${doc.documentDate}`
        .toLowerCase()
        .includes(term),
    );
  }, [archive.data, search]);

  const selectedCategory = archive.data?.categories.find((folder) => folder.name === category);
  const subcategoryOptions = selectedCategory?.subcategories ?? [];
  const enteredCategory = category === "__new__" ? newCategory.trim() : category.trim();
  const enteredSubcategory = subcategory === "__new__" ? newSubcategory.trim() : subcategory.trim();
  const editSubcategoryOptions = archive.data?.categories.find((folder) => folder.name === editCategory)?.subcategories ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !enteredCategory || !enteredSubcategory || !documentDate) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "doc", "docx", "xls", "xlsx"].includes(extension) || file.size > maxSize) {
      toast.error("Choose a PDF, Word, or Excel file up to 25 MB.");
      return;
    }
    try {
      setProgress(1);
      const signed = await requestUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream", purpose: "archive" } });
      await uploadFile(signed.uploadURL, file, setProgress);
       await createDocument.mutateAsync({ data: { originalName: documentName.trim() || file.name, objectPath: signed.objectPath, mimeType: file.type || "application/octet-stream", size: file.size, category: enteredCategory, subcategory: enteredSubcategory, documentDate, expiryDate: expiryDate || null, description: description.trim() } });
      toast.success("Document added to the archive.");
        setFile(null); setDocumentName(""); setCategory(""); setNewCategory(""); setSubcategory(""); setNewSubcategory(""); setDocumentDate(new Date().toISOString().slice(0, 10)); setExpiryDate(""); setDescription(""); setProgress(0); setShowEntry(false);
      if (fileRef.current) fileRef.current.value = "";
      await archive.refetch();
    } catch {
      toast.error("The document could not be uploaded. You can try again.");
      setProgress(0);
    }
  }

  function beginEdit(documentId: number) {
    const document = archive.data?.documents.find((item) => item.id === documentId);
    if (!document) return;
    setEditingDocumentId(document.id);
    setEditName(document.originalName);
    setEditCategory(document.category);
    setEditSubcategory(document.subcategory);
    setEditDocumentDate(document.documentDate);
    setEditExpiryDate(document.expiryDate ?? "");
    setEditDescription(document.description);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (editingDocumentId === null || !editName.trim() || !editCategory || !editSubcategory || !editDocumentDate) return;
    try {
      await updateDocument.mutateAsync({
        id: editingDocumentId,
        data: {
          originalName: editName.trim(),
          category: editCategory,
          subcategory: editSubcategory,
          documentDate: editDocumentDate,
          expiryDate: editExpiryDate || null,
          description: editDescription.trim(),
        },
      });
      toast.success("Archive document updated.");
      setEditingDocumentId(null);
      await archive.refetch();
    } catch {
      toast.error("The document could not be updated. Please try again.");
    }
  }

  async function retire(documentId: number, originalName: string) {
    if (!canManageArchive || !archive.data?.canRetire) return;
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
       {canManageArchive && <Button onClick={() => setShowEntry((value) => !value)}><Plus className="mr-2 h-4 w-4" />Add document</Button>}
    </div>
     {canManageArchive && showEntry && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Document data entry</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
       <div className="space-y-2 md:col-span-2"><Label>File</Label><Input ref={fileRef} type="file" accept={accepted} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
       <div className="space-y-2 md:col-span-2"><Label>Document name (optional)</Label><Input value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="Leave blank to use the uploaded file name" /></div>
       <div className="space-y-2"><Label>Category</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); setNewSubcategory(""); }}><option value="">Choose a category</option>{archive.data?.categories.map((folder) => <option key={folder.name} value={folder.name}>{folder.name}</option>)}<option value="__new__">＋ New category</option></select>{category === "__new__" && <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Enter new category name" />}</div>
       <div className="space-y-2"><Label>Subcategory</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={category === ""}><option value="">{category ? "Choose a subcategory" : "Choose a category first"}</option>{subcategoryOptions.map((sub) => <option key={sub.name} value={sub.name}>{sub.name}</option>)}<option value="__new__">＋ New subcategory</option></select>{subcategory === "__new__" && <Input value={newSubcategory} onChange={(e) => setNewSubcategory(e.target.value)} placeholder="Enter new subcategory name" />}</div>
       <div className="space-y-2"><Label>Document date</Label><Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} /></div>
       <div className="space-y-2"><Label>Expiry date (optional)</Label><Input type="date" value={expiryDate} min={documentDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
      <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      {progress > 0 && <div className="md:col-span-2"><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{progress}% uploaded</p></div>}
       <Button type="submit" disabled={!file || !enteredCategory || !enteredSubcategory || requestUrl.isPending || createDocument.isPending}>Save document</Button>
    </form></CardContent></Card>}
      {canManageArchive && editingDocumentId !== null && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" />Edit archive document</CardTitle></CardHeader><CardContent><form onSubmit={saveEdit} className="grid gap-4 md:grid-cols-2">
       <div className="space-y-2 md:col-span-2"><Label>Document name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
       <div className="space-y-2"><Label>Category</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editCategory} onChange={(e) => { setEditCategory(e.target.value); setEditSubcategory(""); }}><option value="">Choose a category</option>{archive.data?.categories.map((folder) => <option key={folder.name} value={folder.name}>{folder.name}</option>)}</select></div>
       <div className="space-y-2"><Label>Subcategory</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editSubcategory} onChange={(e) => setEditSubcategory(e.target.value)} disabled={!editCategory}><option value="">Choose a subcategory</option>{editSubcategoryOptions.map((sub) => <option key={sub.name} value={sub.name}>{sub.name}</option>)}</select></div>
        <div className="space-y-2"><Label>Document date</Label><Input type="date" value={editDocumentDate} onChange={(e) => setEditDocumentDate(e.target.value)} /></div>
        <div className="space-y-2"><Label>Expiry date (optional)</Label><Input type="date" value={editExpiryDate} min={editDocumentDate} onChange={(e) => setEditExpiryDate(e.target.value)} /></div>
       <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></div>
       <div className="flex gap-2"><Button type="submit" disabled={!editName.trim() || !editCategory || !editSubcategory || updateDocument.isPending}>Save changes</Button><Button type="button" variant="outline" onClick={() => setEditingDocumentId(null)}>Cancel</Button></div>
     </form></CardContent></Card>}
    {!selectedFolder ? <div className="space-y-4">
      <Card><CardHeader><CardTitle>Search archive documents</CardTitle></CardHeader><CardContent><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by file name, category, subcategory, description, or date" /></div></CardContent></Card>
        {search && <Card><CardHeader><CardTitle>Search results</CardTitle></CardHeader><CardContent className="space-y-2">{globalDocuments.length ? globalDocuments.map((doc) => <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.originalName}</p><p className="text-xs text-muted-foreground">Date: {dateOnly(doc.documentDate)}</p><ExpiryInfo expiryDate={doc.expiryDate} /><p className="mt-1 text-sm text-muted-foreground">{doc.description || "No description provided."}</p></div>{(doc.mimeType === "application/pdf" || doc.originalName.toLowerCase().endsWith(".pdf")) && <Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/content`} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Review</a></Button>}<Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/download`}><Download className="mr-2 h-4 w-4" />Download</a></Button>{canManageArchive && <Button variant="outline" size="sm" onClick={() => beginEdit(doc.id)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>}</div>) : <p className="py-6 text-center text-sm text-muted-foreground">No matching documents.</p>}</CardContent></Card>}
      <Card><CardHeader><CardTitle>Categories</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{archive.data?.categories.length ? archive.data.categories.map((folder) => <button key={folder.name} onClick={() => { setSelectedFolder({ category: folder.name }); setSearch(""); }} className="flex items-center gap-3 rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"><Folder className="h-7 w-7 text-primary" /><span><span className="block font-medium">{folder.name}</span><span className="text-xs text-muted-foreground">{folder.count} document{folder.count === 1 ? "" : "s"}</span></span></button>) : <p className="text-sm text-muted-foreground">No categories yet. Use Add document to create one.</p>}</CardContent></Card>
    </div> : <div className="space-y-4">
      <Button variant="ghost" onClick={() => { setSelectedFolder(null); setSearch(""); }}><ArrowLeft className="mr-2 h-4 w-4" />All categories</Button>
      {!selectedFolder.subcategory && <Card><CardHeader><CardTitle>{selectedTitle} subcategories</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(archive.data?.categories.find((folder) => folder.name === selectedFolder.category)?.subcategories ?? []).map((sub) => <button key={sub.name} onClick={() => setSelectedFolder({ category: selectedFolder.category, subcategory: sub.name })} className="flex items-center gap-3 rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"><Folder className="h-6 w-6 text-primary" /><span><span className="block font-medium">{sub.name}</span><span className="text-xs text-muted-foreground">{sub.count} document{sub.count === 1 ? "" : "s"}</span></span></button>)}</CardContent></Card>}
          {selectedFolder.subcategory && <Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>{selectedTitle}</CardTitle><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this folder" /></div></div></CardHeader><CardContent className="space-y-2">{visibleDocuments.length ? visibleDocuments.map((doc) => <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.originalName}</p><p className="text-xs text-muted-foreground">Date: {dateOnly(doc.documentDate)}</p><ExpiryInfo expiryDate={doc.expiryDate} /><p className="mt-1 text-sm text-muted-foreground">{doc.description || "No description provided."}</p></div>{(doc.mimeType === "application/pdf" || doc.originalName.toLowerCase().endsWith(".pdf")) && <Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/content`} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Review</a></Button>}<Button variant="outline" size="sm" asChild><a href={`/api/archive/documents/${doc.id}/download`}><Download className="mr-2 h-4 w-4" />Download</a></Button>{canManageArchive && <Button variant="outline" size="sm" onClick={() => beginEdit(doc.id)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>}{canManageArchive && archive.data?.canRetire ? <Button type="button" variant="outline" size="sm" disabled={retireDocument.isPending} onClick={() => retire(doc.id, doc.originalName)}><Trash2 className="mr-2 h-4 w-4" />Retire</Button> : null}</div>) : <p className="py-10 text-center text-sm text-muted-foreground">No documents in this folder.</p>}</CardContent></Card>}
    </div>}
  </div>;
}
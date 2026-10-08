import { useState, useMemo, useEffect, type FormEvent } from "react";
import { 
  useGetReferenceData, 
  useCreateReferenceCategory, 
  useUpdateReferenceCategory, 
  useDeleteReferenceCategory, 
  useCreateReferenceItem, 
  useUpdateReferenceItem, 
  useDeleteReferenceItem,
  getGetReferenceDataQueryKey,
  getGetLookupsQueryKey,
  getListShapeFactorsQueryKey,
  getGetEmployeeAccessQueryKey,
  useGetEmployeeAccess,
  useCreateEmployeeAccess,
  useUpdateEmployeeAccess,
  useGetEmployeeActivity,
  getGetEmployeeActivityQueryKey,
  EmployeeAccess,
  type EmployeeActivityDay,
  type EmployeeActivityChange,
  UserRole,
  ReferenceCategory,
  ReferenceItem,
  usePreviewRecordAgeBackfill,
  useApplyRecordAgeBackfill,
  type RecordAgeBackfillPreview,
  type RecordAgeBackfillApplyResult,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Settings2, Building2, Users, Package, MapPin, Truck, Plus, Trash2, Edit2, KeyRound,
  Database, Check, X, Search, MoreVertical, UserPlus, ShieldAlert, Mail, ChevronDown,
  Activity, CalendarDays, RefreshCw, Clock3, FileJson, LogIn, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportLayoutsEditor } from "./ReportLayoutsEditor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function getCategoryIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("employe") || k.includes("technician")) return <Users className="w-5 h-5" />;
  if (k.includes("locat") || k.includes("plant") || k.includes("factor")) return <MapPin className="w-5 h-5" />;
  if (k.includes("suppli")) return <Truck className="w-5 h-5" />;
  if (k.includes("block")) return <Building2 className="w-5 h-5" />;
  if (k.includes("material") || k.includes("mix")) return <Package className="w-5 h-5" />;
  return <Database className="w-5 h-5" />;
}

function formatAccessDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function HistoricalAgeBackfillSection() {
  const queryClient = useQueryClient();
  const previewMutation = usePreviewRecordAgeBackfill();
  const applyMutation = useApplyRecordAgeBackfill();
  const [preview, setPreview] = useState<RecordAgeBackfillPreview | null>(null);
  const [applyResult, setApplyResult] = useState<RecordAgeBackfillApplyResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const createPreview = async () => {
    setPreview(null);
    setApplyResult(null);
    try {
      setPreview(await previewMutation.mutateAsync({ data: {} }));
    } catch {
      toast.error("Unable to preview historical records. Try again.");
    }
  };

  const applyPreview = async () => {
    if (!preview?.eligible.length) return;
    try {
      const result = await applyMutation.mutateAsync({
        data: { candidates: preview.eligible },
      });
      setApplyResult(result);
      setConfirmOpen(false);
      await queryClient.invalidateQueries({
        predicate: (query) =>
          String(query.queryKey[0] ?? "").startsWith("/api/records"),
      });
      setPreview(await previewMutation.mutateAsync({ data: {} }));
      toast.success(`Added ages to ${result.applied} historical record${result.applied === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Unable to apply the previewed ages. Generate a new preview and try again.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historical age backfill</CardTitle>
        <CardDescription>
          Find older Blocks, Paving Blocks, Sand Sieve, and Aggregate Sieve records
          that have a saved Testing Date but no matching age field.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Preview the proposed ages first. Applying adds only the age value, keeps
            the saved Testing Date, and leaves ambiguous records unchanged for manual review.
          </p>
          <Button
            variant="outline"
            onClick={() => void createPreview()}
            disabled={previewMutation.isPending || applyMutation.isPending}
          >
            {previewMutation.isPending ? "Previewing…" : preview ? "Refresh preview" : "Preview records"}
          </Button>
        </div>

        {applyResult && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <strong>{applyResult.applied} age value{applyResult.applied === 1 ? "" : "s"} applied.</strong>
            {applyResult.skipped.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                {applyResult.skipped.length} record{applyResult.skipped.length === 1 ? "" : "s"} changed after preview and were left unchanged.
              </span>
            )}
          </div>
        )}

        {preview && (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Ready to update ({preview.eligible.length})</h3>
                  <p className="text-sm text-muted-foreground">
                    The age shown is the whole-day difference between Sample Date and saved Testing Date.
                  </p>
                </div>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!preview.eligible.length || applyMutation.isPending}>
                      Apply age values
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apply the previewed ages?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will add an age field to {preview.eligible.length} records.
                        Each record is checked again before saving; records that changed
                        since this preview will be skipped.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={applyMutation.isPending}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={applyMutation.isPending}
                        onClick={(event) => {
                          event.preventDefault();
                          void applyPreview();
                        }}
                      >
                        {applyMutation.isPending ? "Applying…" : "Confirm apply"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {preview.eligible.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No historical records are ready for an age update.
                </p>
              ) : (
                <div className="max-h-80 overflow-auto rounded-md border">
                  <Table className="min-w-[780px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Record</TableHead>
                        <TableHead>Test type</TableHead>
                        <TableHead>Sample date</TableHead>
                        <TableHead>Testing date</TableHead>
                        <TableHead className="text-right">Age (days)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.eligible.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.recordNo}</TableCell>
                          <TableCell>{record.testType}</TableCell>
                          <TableCell>{record.sampleDate}</TableCell>
                          <TableCell>{record.testingDate}</TableCell>
                          <TableCell className="text-right font-medium">{record.age}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="font-semibold">Manual review ({preview.manualReview.length})</h3>
                <p className="text-sm text-muted-foreground">
                  These records are not changed because their dates or existing age values are missing, invalid, or conflicting.
                </p>
              </div>
              {preview.manualReview.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No records need manual review.
                </p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table className="min-w-[780px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Record</TableHead>
                        <TableHead>Test type</TableHead>
                        <TableHead>Sample date</TableHead>
                        <TableHead>Saved testing date</TableHead>
                        <TableHead>Why it needs review</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.manualReview.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.recordNo}</TableCell>
                          <TableCell>{record.testType}</TableCell>
                          <TableCell>{record.sampleDate ?? "—"}</TableCell>
                          <TableCell>{record.testingDate ?? "—"}</TableCell>
                          <TableCell className="min-w-64 whitespace-normal">{record.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {applyResult && applyResult.skipped.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-semibold">Skipped after preview ({applyResult.skipped.length})</h3>
                <div className="max-h-60 overflow-auto rounded-md border">
                  <Table className="min-w-[780px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Record</TableHead>
                        <TableHead>Why it was skipped</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applyResult.skipped.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.recordNo}</TableCell>
                          <TableCell className="whitespace-normal">{record.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const employeeRoleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "technician", label: "Technician" },
  { value: "managerial", label: "Managerial" },
  { value: "administrator", label: "Administrator" },
  { value: "visitor", label: "Visitor" },
];

function employeeRoleLabel(role: UserRole) {
  return employeeRoleOptions.find((option) => option.value === role)?.label ?? "Technician";
}
interface EmployeeAccessEntry {
  id: number;
  employeeId: string;
  name: string;
  active: boolean;
}

async function getEmployeeError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? "The employee directory request failed.";
}

function EmployeeAccessCard({ isAdmin }: { isAdmin: boolean }) {
  const [employees, setEmployees] = useState<EmployeeAccessEntry[]>([]);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isAdmin) return null;

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/employees", { credentials: "include" });
      if (!response.ok) throw new Error(await getEmployeeError(response));
      const body = await response.json() as { employees: EmployeeAccessEntry[] };
      setEmployees(body.employees);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load employees.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadEmployees();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin]);

  const createEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !employeeId.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, employeeId }),
      });
      if (!response.ok) throw new Error(await getEmployeeError(response));
      setName("");
      setEmployeeId("");
      toast.success("Employee added");
      await loadEmployees();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to add employee.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveEmployee = async (id: number) => {
    if (!editName.trim() || !editEmployeeId.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName, employeeId: editEmployeeId }),
      });
      if (!response.ok) throw new Error(await getEmployeeError(response));
      setEditingId(null);
      toast.success("Employee updated");
      await loadEmployees();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to update employee.");
    } finally {
      setIsSaving(false);
    }
  };

  const setEmployeeActive = async (employee: EmployeeAccessEntry) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !employee.active }),
      });
      if (!response.ok) throw new Error(await getEmployeeError(response));
      toast.success(employee.active ? "Employee access disabled" : "Employee access enabled");
      await loadEmployees();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to change employee access.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEmployee = async (employee: EmployeeAccessEntry) => {
    if (!window.confirm(`Remove ${employee.name} (${employee.employeeId}) from site access?`)) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await getEmployeeError(response));
      toast.success("Employee removed");
      await loadEmployees();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to remove employee.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shrink-0 border-primary/20 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-primary/[0.03]">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Employee Access
        </CardTitle>
        <CardDescription>
          Add the employee names and IDs that are allowed to enter the QC system.
          Disabled employees cannot log in.
          Passwords cannot be viewed; use the password action to set or change one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" onSubmit={createEmployee}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Employee name"
            aria-label="Employee name"
            disabled={isSaving}
          />
          <Input
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            placeholder="Employee ID"
            aria-label="Employee ID"
            inputMode="numeric"
            disabled={isSaving}
          />
          <Button type="submit" disabled={isSaving || !name.trim() || !employeeId.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add employee
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading employee access...</p>
        ) : employees.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No employees are registered yet.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {employees.map((employee) => (
              <div key={employee.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                {editingId === employee.id ? (
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_160px]">
                    <Input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="Edit employee name" />
                    <Input value={editEmployeeId} onChange={(event) => setEditEmployeeId(event.target.value)} aria-label="Edit employee ID" inputMode="numeric" />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="truncate font-medium">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">ID: {employee.employeeId}</p>
                  </div>
                )}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant={employee.active ? "default" : "secondary"}>
                    {employee.active ? "Active" : "Disabled"}
                  </Badge>
                  {editingId === employee.id ? (
                    <>
                      <Button size="sm" onClick={() => void saveEmployee(employee.id)} disabled={isSaving}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={isSaving}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(employee.id);
                          setEditName(employee.name);
                          setEditEmployeeId(employee.employeeId);
                        }}
                        disabled={isSaving}
                      >
                        <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void setEmployeeActive(employee)} disabled={isSaving}>
                        {employee.active ? "Disable" : "Enable"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void deleteEmployee(employee)} disabled={isSaving}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Category Card Component
function CategoryCard({ category }: { category: ReferenceCategory }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editCategoryLabel, setEditCategoryLabel] = useState(category.label);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemValue, setNewItemValue] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemValue, setEditItemValue] = useState("");
  const [itemToDelete, setItemToDelete] = useState<ReferenceItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ReferenceCategory | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const updateCategory = useUpdateReferenceCategory();
  const deleteCategory = useDeleteReferenceCategory();
  const createItem = useCreateReferenceItem();
  const updateItem = useUpdateReferenceItem();
  const deleteItem = useDeleteReferenceItem();

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: getGetReferenceDataQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetLookupsQueryKey() });
    if (category.key === "blockSizes") {
      queryClient.invalidateQueries({ queryKey: getListShapeFactorsQueryKey() });
    }
  };

  const handleUpdateCategory = () => {
    if (!editCategoryLabel.trim()) return;
    updateCategory.mutate(
      { id: category.id, data: { label: editCategoryLabel, key: category.key } },
      {
        onSuccess: () => {
          toast.success("Category updated");
          setIsEditingCategory(false);
          invalidateData();
        },
        onError: () => toast.error("Failed to update category")
      }
    );
  };

  const handleDeleteCategory = () => {
    if (!categoryToDelete) return;
    deleteCategory.mutate(
      { id: categoryToDelete.id },
      {
        onSuccess: () => {
          toast.success("Category deleted");
          setCategoryToDelete(null);
          invalidateData();
        },
        onError: () => toast.error("Failed to delete category")
      }
    );
  };

  const handleCreateItem = () => {
    if (!newItemValue.trim()) return;
    createItem.mutate(
      { categoryId: category.id, data: { value: newItemValue } },
      {
        onSuccess: () => {
          setNewItemValue("");
          setIsAddingItem(false);
          invalidateData();
        },
        onError: () => toast.error("Failed to add value")
      }
    );
  };

  const handleUpdateItem = (id: number) => {
    if (!editItemValue.trim()) return;
    updateItem.mutate(
      { id, data: { value: editItemValue } },
      {
        onSuccess: () => {
          setEditingItemId(null);
          invalidateData();
        },
        onError: () => toast.error("Failed to update value")
      }
    );
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;
    deleteItem.mutate(
      { id: itemToDelete.id },
      {
        onSuccess: () => {
          setItemToDelete(null);
          invalidateData();
        },
        onError: () => toast.error("Failed to delete value")
      }
    );
  };

  const filteredItems = useMemo(() => {
    const s = search.toLowerCase();
    return category.items.filter(item => item.value.toLowerCase().includes(s));
  }, [category.items, search]);

  return (
    <>
      <Card className="mb-6 break-inside-avoid flex flex-col border shadow-sm">
        <CardHeader className="shrink-0 border-b border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
              onClick={() => setIsExpanded((value) => !value)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category.label}`}
            >
              <div className="shrink-0 rounded-md bg-primary/10 p-2 text-primary">
                {getCategoryIcon(category.key)}
              </div>
              <div className="min-w-0 flex-1">
                {isEditingCategory ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editCategoryLabel}
                      onChange={(e) => setEditCategoryLabel(e.target.value)}
                      className="h-7 px-2 py-1 text-sm"
                      autoFocus
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateCategory()}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-success"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleUpdateCategory();
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsEditingCategory(false);
                        setEditCategoryLabel(category.label);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <CardTitle className="truncate text-base text-foreground" title={category.label}>
                      {category.label}
                    </CardTitle>
                    {isExpanded && (
                      <CardDescription className="mt-0.5 truncate text-xs" title={category.key}>
                        Key: {category.key}
                      </CardDescription>
                    )}
                  </>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {!isEditingCategory && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setIsExpanded(true); setIsEditingCategory(true); }}>
                    <Edit2 className="mr-2 h-4 w-4" /> Edit Label
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setCategoryToDelete(category)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Category
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        {isExpanded && (
        <CardContent className="relative flex flex-1 flex-col overflow-hidden p-0">
          <div className="p-3 border-b border-border/50 flex gap-2 items-center bg-card">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search values..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/30" 
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => { setIsAddingItem(true); setNewItemValue(""); }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[150px]">
            {isAddingItem && (
              <div className="flex items-center gap-2 py-1.5 px-2 bg-muted/30 rounded-md border border-primary/20">
                <Input 
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  placeholder="New value..."
                  className="h-7 text-sm px-2 py-1 flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateItem();
                    if (e.key === "Escape") setIsAddingItem(false);
                  }}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-success shrink-0" onClick={handleCreateItem}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={() => setIsAddingItem(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {filteredItems.map((item) => (
              <div key={item.id} className="group flex justify-between items-center py-1.5 px-2 hover:bg-muted/50 rounded-md transition-colors text-sm">
                {editingItemId === item.id ? (
                  <div className="flex items-center gap-2 flex-1 w-full">
                    <Input 
                      value={editItemValue}
                      onChange={(e) => setEditItemValue(e.target.value)}
                      className="h-7 text-sm px-2 py-1 flex-1 min-w-0"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateItem(item.id);
                        if (e.key === "Escape") setEditingItemId(null);
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-success shrink-0" onClick={() => handleUpdateItem(item.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={() => setEditingItemId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="truncate pr-2 font-medium" title={item.value}>{item.value}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-foreground" 
                        onClick={() => { setEditingItemId(item.id); setEditItemValue(item.value); }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-destructive/70 hover:text-destructive" 
                        onClick={() => setItemToDelete(item)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {filteredItems.length === 0 && !isAddingItem && (
              <div className="text-center text-muted-foreground text-sm py-8 px-4">
                {search ? "No matches found." : "No values added yet."}
              </div>
            )}
          </div>
        </CardContent>
        )}
      </Card>

      {/* Delete Item Dialog */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Value</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{itemToDelete?.value}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteItem}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{categoryToDelete?.label}" and all its values? This action cannot be undone and may break existing records referencing these values.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCategory}>Delete Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportLayoutsSection() {
  return <ReportLayoutsEditor />;
}

const EMPLOYEE_REFERENCE_VALUE_OPTIONS = [
  { key: "customers", label: "Customer name", placeholder: "Enter customer name" },
  {
    key: "customerLocations",
    label: "Customer location",
    placeholder: "Enter customer location",
  },
  {
    key: "locations",
    label: "Plant / production location",
    placeholder: "Enter plant or production location",
  },
  { key: "mixStrengths", label: "Mix design", placeholder: "Enter mix design" },
] as const;

function EmployeeSharedValues({
  categories,
  isLoading,
  isError,
  onRetry,
}: {
  categories: ReferenceCategory[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  const createItem = useCreateReferenceItem();
  const [categoryKey, setCategoryKey] = useState<string>("customers");
  const [value, setValue] = useState("");
  const availableOptions = EMPLOYEE_REFERENCE_VALUE_OPTIONS.flatMap((option) => {
    const category = categories.find((item) => item.key === option.key);
    return category ? [{ ...option, category }] : [];
  });
  const selectedOption = availableOptions.find(
    (option) => option.key === categoryKey,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedValue = value.trim();
    if (!selectedOption || !normalizedValue) return;
    createItem.mutate(
      {
        categoryId: selectedOption.category.id,
        data: { value: normalizedValue },
      },
      {
        onSuccess: (createdItem) => {
          setValue("");
          toast.success(`Added “${createdItem.value}” for everyone to use.`);
          void queryClient.invalidateQueries({
            queryKey: getGetReferenceDataQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetLookupsQueryKey(),
          });
        },
        onError: () =>
          toast.error("Could not add this value. It may already exist."),
      },
    );
  };

  return (
    <div className="mx-auto mt-8 w-full max-w-3xl">
      <Card>
        <div className="border-b p-6">
          <h1 className="text-xl font-semibold">Add shared values</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Any approved employee can add customer names, customer and plant
            locations, or Ready Mix mix designs. New values become available
            to everyone.
          </p>
        </div>
        <div className="p-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading shared values…
            </p>
          ) : isError ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                Shared values could not be loaded.
              </p>
              <Button type="button" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
            >
              <div className="space-y-2">
                <label
                  htmlFor="shared-reference-category"
                  className="text-sm font-medium"
                >
                  Value type
                </label>
                <select
                  id="shared-reference-category"
                  value={categoryKey}
                  onChange={(event) => setCategoryKey(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!availableOptions.length}
                >
                  {availableOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="shared-reference-value"
                  className="text-sm font-medium"
                >
                  New value
                </label>
                <Input
                  id="shared-reference-value"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={
                    selectedOption?.placeholder ?? "Enter a new value"
                  }
                  maxLength={120}
                  required
                  disabled={!selectedOption}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={
                    !selectedOption ||
                    !value.trim() ||
                    createItem.isPending
                  }
                >
                  {createItem.isPending ? "Adding…" : "Add value"}
                </Button>
              </div>
              {!availableOptions.length && (
                <p className="text-sm text-destructive sm:col-span-3">
                  The shared-value categories are not configured. Ask an
                  administrator to restore them.
                </p>
              )}
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatActivityDate(value: string, includeDate = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", includeDate
    ? { dateStyle: "medium", timeStyle: "short" }
    : { timeStyle: "short" }).format(date);
}

function formatActivityDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function activitySessionExit(session: EmployeeActivityDay["sessions"][number]) {
  if (session.endedAt) return formatActivityDate(session.endedAt);
  if (session.endReason === "expired") return "Ended at expiry (inferred)";
  if (session.endReason === "revoked") return "Ended when revoked (inferred)";
  return "Open / no exit recorded";
}

function activityEndReasonLabel(
  reason: EmployeeActivityDay["sessions"][number]["endReason"],
  hasEndedAt = false,
) {
  if (reason === "logout") return "Logged out";
  if (reason === "expired") return "Expired";
  if (reason === "revoked") return "Revoked";
  return hasEndedAt ? "Ended" : "Open";
}

function sanitizeActivityValue(value: unknown, key?: string): unknown {
  if (key && /password|token|secret|authorization|cookie|credential/i.test(key)) {
    return "[redacted]";
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeActivityValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeActivityValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function activityDetailsText(details: Record<string, unknown>) {
  const safeDetails = sanitizeActivityValue(details);
  return JSON.stringify(safeDetails, null, 2) ?? "No additional details recorded.";
}

function EmployeeActivitySection({ isAdmin }: { isAdmin: boolean }) {
  const today = useMemo(() => new Date(), []);
  const defaultTo = toDateInputValue(today);
  const defaultFrom = toDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [appliedRange, setAppliedRange] = useState({ from: defaultFrom, to: defaultTo });
  const [selectedDay, setSelectedDay] = useState<EmployeeActivityDay | null>(null);
  const [rangeError, setRangeError] = useState("");
  const { data, isLoading, isFetching, isError, error, refetch } = useGetEmployeeActivity(
    appliedRange,
    {
      query: {
        enabled: isAdmin,
        queryKey: getGetEmployeeActivityQueryKey(appliedRange),
      },
    },
  );

  if (!isAdmin) return null;

  const records = data?.records ?? [];
  const loginTotal = records.reduce((total, record) => total + record.loginCount, 0);
  const changeTotal = records.reduce((total, record) => total + record.changes.length, 0);
  const sessionTotal = records.reduce((total, record) => total + record.sessions.length, 0);
  const loginAttempts = records
    .flatMap((record) =>
      record.loginAttempts.map((attempt) => ({
        ...attempt,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
      })),
    )
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    );
  const uniqueIpCount = new Set(
    loginAttempts
      .map((attempt) => attempt.ipAddress)
      .filter((ipAddress) => ipAddress !== "Unknown"),
  ).size;

  const applyRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!from || !to) {
      setRangeError("Choose both a start date and an end date.");
      return;
    }
    if (from > to) {
      setRangeError("The start date must be on or before the end date.");
      return;
    }
    setRangeError("");
    setAppliedRange({ from, to });
  };

  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1);
    setFrom(toDateInputValue(start));
    setTo(toDateInputValue(end));
    setRangeError("");
    setAppliedRange({
      from: toDateInputValue(start),
      to: toDateInputValue(end),
    });
  };

  return (
    <section className="space-y-4" data-testid="section-employee-activity">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Activity className="h-6 w-6 text-primary" /> Employee activity
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Audit sign-ins, confirmed requests, session endings, and changes made by each employee.
            Times are shown in your browser&apos;s local time.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" /> Administrator view
        </Badge>
      </div>

      <Card className="border-primary/15 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={applyRange}>
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              From
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="pl-9 font-normal tracking-normal"
                  aria-label="Activity from date"
                  data-testid="input-activity-from"
                />
              </div>
            </label>
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              To
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="pl-9 font-normal tracking-normal"
                  aria-label="Activity to date"
                  data-testid="input-activity-to"
                />
              </div>
            </label>
            <Button type="submit" className="self-end" disabled={isFetching} data-testid="button-apply-activity-range">
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Apply range
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Quick range</span>
            {[1, 7, 30].map((days) => (
              <Button
                key={days}
                type="button"
                variant={days === 7 && from === appliedRange.from && to === appliedRange.to ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPreset(days)}
                data-testid={`button-activity-preset-${days}`}
              >
                {days === 1 ? "Today" : `${days} days`}
              </Button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              Showing {formatActivityDay(appliedRange.from)} – {formatActivityDay(appliedRange.to)}
            </span>
          </div>
          {rangeError && <p className="text-sm text-destructive" role="alert" data-testid="status-activity-range-error">{rangeError}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Daily login count", value: loginTotal, icon: LogIn },
          { label: "Sign-in attempts", value: loginAttempts.length, icon: ShieldAlert },
          { label: "Unique IP addresses", value: uniqueIpCount, icon: MapPin },
          { label: "Tracked sessions", value: sessionTotal, icon: Clock3 },
          { label: "Recorded changes", value: changeTotal, icon: FileJson },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-card/80">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums" data-testid={`text-activity-total-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
          <CardTitle className="text-base">Sign-in attempts</CardTitle>
          <CardDescription className="mt-1">
            Successful and failed sign-ins in the selected range. Location is unavailable because no outside geolocation service is used.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loginAttempts.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No sign-in attempts were recorded in this date range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]" data-testid="table-login-attempts">
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Employee / attempted ID</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginAttempts.map((attempt, index) => (
                    <TableRow key={`${attempt.occurredAt}-${attempt.employeeId}-${index}`}>
                      <TableCell className="whitespace-nowrap">
                        {formatActivityDate(attempt.occurredAt, true)}
                      </TableCell>
                      <TableCell>
                        <div className="break-words font-medium">{attempt.employeeName}</div>
                        <div className="break-all text-xs text-muted-foreground">{attempt.employeeId}</div>
                      </TableCell>
                      <TableCell className="break-all font-mono text-xs">
                        {attempt.ipAddress}
                      </TableCell>
                      <TableCell>{attempt.location}</TableCell>
                      <TableCell>
                        <Badge variant={attempt.outcome === "success" ? "default" : "destructive"}>
                          {attempt.outcome === "success" ? "Successful" : "Failed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Daily activity register</CardTitle>
              <CardDescription className="mt-1">
                One row per employee per day. Select a change count to inspect sanitized request and response details.
              </CardDescription>
            </div>
            {isFetching && !isLoading && <span className="text-xs text-muted-foreground">Refreshing…</span>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4" aria-label="Loading employee activity">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : isError ? (
            <div className="flex min-h-[230px] flex-col items-center justify-center gap-3 p-6 text-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              <div>
                <h3 className="font-semibold">Employee activity could not be loaded</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {errorStatus(error) === 403
                    ? "This audit register is restricted to administrators."
                    : "Check the connection and try the selected date range again."}
                </p>
              </div>
              {errorStatus(error) !== 403 && (
                <Button variant="outline" onClick={() => void refetch()} data-testid="button-retry-activity">
                  Try again
                </Button>
              )}
            </div>
          ) : records.length === 0 ? (
            <div className="flex min-h-[230px] flex-col items-center justify-center gap-2 p-6 text-center">
              <div className="rounded-full bg-primary/10 p-3 text-primary"><Activity className="h-6 w-6" /></div>
              <h3 className="font-semibold">No activity in this range</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                No employee sign-ins or recorded changes were found from {formatActivityDay(appliedRange.from)} to {formatActivityDay(appliedRange.to)}.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <table className="employee-activity-table w-full table-fixed text-xs" data-testid="table-employee-activity">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[29%]" />
                  <col className="w-[17%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead className="bg-muted/35">
                  <tr className="border-b text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="font-semibold">Employee</th>
                    <th className="font-semibold">Date</th>
                    <th className="font-semibold">Logins</th>
                    <th className="font-semibold">Entry / exit</th>
                    <th className="font-semibold">Last confirmed</th>
                    <th className="text-right font-semibold">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={`${record.employeeId}-${record.date}`} className="border-b align-top last:border-0 hover:bg-muted/20" data-testid={`row-activity-${record.employeeId}-${record.date}`}>
                      <td>
                        <div className="break-words font-semibold text-foreground">{record.employeeName}</div>
                        <div className="mt-0.5 break-all text-[10px] text-muted-foreground">{record.employeeId}</div>
                      </td>
                      <td className="break-words text-muted-foreground">{formatActivityDay(record.date)}</td>
                      <td className="font-semibold tabular-nums">{record.loginCount}</td>
                      <td>
                        {record.sessions.length === 0 ? (
                          <span className="text-muted-foreground">No session recorded</span>
                        ) : (
                          <div className="space-y-2">
                            {record.sessions.map((session, index) => (
                              <div key={`${session.startedAt}-${index}`} className="space-y-0.5">
                                <div className="flex items-start gap-1.5">
                                  <LogIn className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                                  <span className="break-words">In {formatActivityDate(session.startedAt)}</span>
                                </div>
                                <div className="flex items-start gap-1.5 text-muted-foreground">
                                  <LogOut className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="break-words">
                                    {activitySessionExit(session)}
                                    <span className="ml-1">({activityEndReasonLabel(session.endReason, Boolean(session.endedAt))})</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {record.sessions.length === 0 ? (
                          <span className="text-muted-foreground">No confirmed request</span>
                        ) : (
                          <div className="space-y-2">
                            {record.sessions.map((session, index) => (
                              <div key={`${session.lastSeenAt}-${index}`} className="space-y-0.5">
                                <div className="flex items-start gap-1.5">
                                  <Clock3 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                  <span className="break-words">{formatActivityDate(session.lastSeenAt)}</span>
                                </div>
                                <span className="block break-words text-[10px] text-muted-foreground">
                                  Expires {formatActivityDate(session.expiresAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        {record.changes.length ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 max-w-full whitespace-normal px-2 text-[11px]"
                            onClick={() => setSelectedDay(record)}
                            data-testid={`button-view-changes-${record.employeeId}-${record.date}`}
                          >
                            View {record.changes.length}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => { if (!open) setSelectedDay(null); }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changes by {selectedDay?.employeeName}</DialogTitle>
            <DialogDescription>
              {selectedDay && `${formatActivityDay(selectedDay.date)} · ${selectedDay.employeeId}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedDay?.changes.map((change) => (
              <ActivityChangeItem key={change.id} change={change} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ActivityChangeItem({ change }: { change: EmployeeActivityChange }) {
  const actionLabel = change.action.charAt(0).toUpperCase() + change.action.slice(1);
  return (
    <article className="rounded-lg border bg-muted/15 p-3" data-testid={`activity-change-${change.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={change.action === "deleted" ? "destructive" : change.action === "created" ? "default" : "secondary"}>
              {actionLabel}
            </Badge>
            <span className="break-words font-medium">{change.entityType}{change.entityId ? ` #${change.entityId}` : ""}</span>
          </div>
          <p className="mt-2 break-words text-sm">{change.summary}</p>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">{formatActivityDate(change.occurredAt, true)}</time>
      </div>
      <div className="mt-3 rounded-md border border-dashed bg-background/70 p-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <FileJson className="h-3.5 w-3.5" /> Sanitized request / response details
        </div>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
          {activityDetailsText(change.details)}
        </pre>
      </div>
    </article>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: referenceData, isLoading, isError, refetch } = useGetReferenceData();
  const createCategory = useCreateReferenceCategory();

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  if (!isAdmin) {
    return (
      <EmployeeSharedValues
        categories={referenceData?.categories ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
      />
    );
  }

  const handleCreateCategory = () => {
    if (!newCategoryKey.trim() || !newCategoryLabel.trim()) {
      toast.error("Key and Label are required");
      return;
    }
    createCategory.mutate(
      { data: { key: newCategoryKey, label: newCategoryLabel } },
      {
        onSuccess: () => {
          toast.success("Category created");
          setIsAddCategoryOpen(false);
          setNewCategoryKey("");
          setNewCategoryLabel("");
          queryClient.invalidateQueries({ queryKey: getGetReferenceDataQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLookupsQueryKey() });
        },
        onError: () => toast.error("Failed to create category")
      }
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;
  }

  if (isError) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <Database className="h-9 w-9 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">Settings could not be loaded</h2>
          <p className="mt-1 text-sm text-muted-foreground">Check the connection and try again.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  const categories = referenceData?.categories || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-6">
      <div className="shrink-0">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
          <Settings2 className="h-8 w-8 text-primary" /> Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage employee access and the master data used throughout quality control.</p>
      </div>

      <Tabs defaultValue="report-layouts" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid h-auto w-full max-w-5xl shrink-0 grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="reference-data" className="gap-2 py-2.5">
            <Database className="h-4 w-4" /> Settings
          </TabsTrigger>
          <TabsTrigger value="employee-access" className="gap-2 py-2.5">
            <Users className="h-4 w-4" /> Employee Access
          </TabsTrigger>
          <TabsTrigger value="report-layouts" className="gap-2 py-2.5">
            <Settings2 className="h-4 w-4" /> Report Layouts
          </TabsTrigger>
          <TabsTrigger value="employee-activity" className="gap-2 py-2.5">
            <Activity className="h-4 w-4" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employee-access" className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <EmployeeAccessSection isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="reference-data" className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage locations, materials, mix designs, and personnel.</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="hidden text-muted-foreground md:inline-flex">System Administrator</Badge>
              <Button onClick={() => setIsAddCategoryOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Category
              </Button>
            </div>
          </div>

          {categories.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
               <h3 className="mb-2 text-lg font-semibold">No Settings Data Found</h3>
              <p className="mb-6 max-w-sm text-muted-foreground">Create categories to manage the lookup values used throughout the application.</p>
              <Button onClick={() => setIsAddCategoryOpen(true)}>Create First Category</Button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 columns-1 gap-6 overflow-y-auto pb-8 pt-4 md:columns-2 lg:columns-3">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="report-layouts" className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <ReportLayoutsSection />
        </TabsContent>

        <TabsContent value="employee-activity" className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <EmployeeActivitySection isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Reference Category</DialogTitle>
            <DialogDescription>
              Create a new category for lookup values. The key is used internally by the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Label</label>
              <Input 
                placeholder="e.g. Test Methods" 
                value={newCategoryLabel} 
                onChange={(e) => {
                  setNewCategoryLabel(e.target.value);
                  if (!newCategoryKey || newCategoryKey === newCategoryLabel.toLowerCase().replace(/\s+/g, "")) {
                    setNewCategoryKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                  }
                }} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Key</label>
              <Input 
                placeholder="e.g. testMethods" 
                value={newCategoryKey} 
                onChange={(e) => setNewCategoryKey(e.target.value)} 
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCategory} disabled={!newCategoryLabel || !newCategoryKey}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function EmployeeAccessSection({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmployeeRole, setNewEmployeeRole] = useState<UserRole>("technician");
  const [employeeForEdit, setEmployeeForEdit] = useState<EmployeeAccess | null>(null);
  const [editName, setEditName] = useState("");
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<EmployeeAccess | null>(null);
  const [employeeForPassword, setEmployeeForPassword] = useState<EmployeeAccess | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const { data, isLoading, isError, error, refetch } = useGetEmployeeAccess({
    query: { enabled: isAdmin, queryKey: getGetEmployeeAccessQueryKey() },
  });
  const createEmployee = useCreateEmployeeAccess();
  const updateEmployee = useUpdateEmployeeAccess();

  if (!isAdmin) return null;

  const employees = data?.employees ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredEmployees = employees.filter((employee) =>
    [employee.employeeId, employee.displayName].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    ),
  );
  const activeCount = employees.filter((employee) => employee.active).length;

  const invalidateAccess = () => {
    queryClient.invalidateQueries({ queryKey: getGetEmployeeAccessQueryKey() });
  };

  const handleAddEmployee = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmployeeId = employeeId.trim();
    const normalizedEmployeeName = employeeName.trim();
    if (!/^\d+$/.test(normalizedEmployeeId) || !normalizedEmployeeName) {
      toast.error("Enter the employee name and a valid employee ID");
      return;
    }

    createEmployee.mutate(
       { data: { employeeId: normalizedEmployeeId, name: normalizedEmployeeName, role: newEmployeeRole } },
      {
        onSuccess: () => {
          toast.success("Employee access added");
          setEmployeeId("");
          setEmployeeName("");
          setNewEmployeeRole("technician");
          setIsAddOpen(false);
          invalidateAccess();
        },
        onError: () => toast.error("Could not update employee access. Try again."),
      },
    );
  };

  const openEditEmployee = (employee: EmployeeAccess) => {
    setEmployeeForEdit(employee);
    setEditName(employee.displayName);
  };

  const closeEditEmployee = () => {
    setEmployeeForEdit(null);
    setEditName("");
  };

  const handleEditEmployee = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeForEdit) return;
    if (!editName.trim()) {
      toast.error("Employee name cannot be blank.");
      return;
    }

    updateEmployee.mutate(
      {
        id: employeeForEdit.id,
        data: { name: editName.trim() },
      },
      {
        onSuccess: () => {
          toast.success("Employee access updated");
          closeEditEmployee();
          invalidateAccess();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not update employee access."),
      },
    );
  };

  const updateAccess = (employee: EmployeeAccess, active: boolean) => {
    updateEmployee.mutate(
      { id: employee.id, data: { active } },
      {
        onSuccess: () => {
          toast.success(active ? "Access activated" : "Access deactivated");
          setEmployeeToDeactivate(null);
          invalidateAccess();
        },
        onError: () => toast.error("Could not update employee access. Try again."),
      },
    );
  };

  const updateRole = (employee: EmployeeAccess, role: UserRole) => {
    updateEmployee.mutate(
      { id: employee.id, data: { role } },
      {
        onSuccess: () => {
          toast.success(`${employeeRoleLabel(role)} access assigned`);
          invalidateAccess();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not update employee role."),
      },
    );
  };

  const closePasswordDialog = () => {
    setEmployeeForPassword(null);
    setPassword("");
    setPasswordConfirmation("");
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirmation) {
      toast.error("Passwords do not match.");
      return;
    }
    if (!employeeForPassword) return;

    updateEmployee.mutate(
      { id: employeeForPassword.id, data: { password } },
      {
        onSuccess: () => {
          toast.success(employeeForPassword.passwordSet ? "Password changed" : "Password set");
          closePasswordDialog();
          invalidateAccess();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not update password."),
      },
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <UserPlus className="h-6 w-6 text-primary" /> Employee access
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control which registered employee IDs can sign in to the quality control system.
        </p>
      </div>

      {isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            {errorStatus(error) === 403 ? (
              <>
                <ShieldAlert className="h-9 w-9 text-destructive" />
                <div>
                  <h3 className="text-lg font-semibold">Administrator access required</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Employee access is controlled by the server and is only available to authorized administrators.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Mail className="h-9 w-9 text-destructive" />
                <div>
                  <h3 className="text-lg font-semibold">Employee access could not be loaded</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Check the connection and try again.</p>
                </div>
                <Button variant="outline" onClick={() => refetch()}>Try again</Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Approved employees</CardTitle>
              <CardDescription>
                {activeCount} active {activeCount === 1 ? "employee" : "employees"} of {employees.length}
              </CardDescription>
            </div>
            <Button className="w-full sm:w-auto" onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add employee
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <Input
              aria-label="Search employees"
              placeholder="Search by name or employee ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-md"
            />
            {isLoading ? (
              <div className="space-y-3" aria-label="Loading employee access">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">
                  {employees.length === 0 ? "No employee access entries yet" : "No matching employees"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {employees.length === 0
                    ? "Add a registered employee ID to allow an employee to sign in."
                    : "Try a different name or employee ID search."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="employee-access-table w-full table-fixed text-xs">
                    <colgroup>
                      <col className="w-[16%]" />
                      <col className="w-[9%]" />
                      <col className="w-[12%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[11%]" />
                      <col className="w-[30%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="font-medium">Employee</th>
                        <th className="font-medium">Status</th>
                        <th className="font-medium">Role</th>
                        <th className="font-medium">Password</th>
                        <th className="font-medium">Added</th>
                        <th className="font-medium">Last updated</th>
                        <th className="text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="border-b last:border-0">
                          <td>
                            <div className="font-medium">{employee.displayName}</div>
                            <div className="text-xs text-muted-foreground">ID: {employee.employeeId}</div>
                          </td>
                          <td>
                            <Badge variant={employee.active ? "default" : "secondary"}>
                              {employee.active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant={employee.role === "administrator" ? "outline" : "secondary"}>
                              {employeeRoleLabel(employee.role)}
                            </Badge>
                          </td>
                          <td>
                            <Badge variant={employee.passwordSet ? "outline" : "secondary"}>
                              {employee.passwordSet ? "Set" : "Not set"}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground">{formatAccessDate(employee.createdAt)}</td>
                          <td className="text-muted-foreground">{formatAccessDate(employee.updatedAt)}</td>
                          <td className="text-right">
                            <div className="employee-access-actions grid grid-cols-2 gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-full whitespace-normal px-2 text-[10px]"
                                onClick={() => {
                                  setEmployeeForPassword(employee);
                                  setPassword("");
                                  setPasswordConfirmation("");
                                }}
                                disabled={updateEmployee.isPending}
                              >
                                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                                {employee.passwordSet ? "Change password" : "Set password"}
                              </Button>
                              <select
                                aria-label={`Role for ${employee.displayName}`}
                                className="h-8 min-w-0 w-full rounded-md border border-input bg-background px-1.5 text-[10px]"
                                value={employee.role}
                                onChange={(event) => updateRole(employee, event.target.value as UserRole)}
                                disabled={updateEmployee.isPending}
                              >
                                {employeeRoleOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                              {employee.active ? (
                                <Button variant="outline" size="sm" className="h-8 w-full whitespace-normal px-2 text-[10px]" onClick={() => setEmployeeToDeactivate(employee)}>
                                  Deactivate access
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" className="h-8 w-full whitespace-normal px-2 text-[10px]" onClick={() => updateAccess(employee, true)} disabled={updateEmployee.isPending}>
                                  Activate access
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-full whitespace-normal px-2 text-[10px]"
                                onClick={() => openEditEmployee(employee)}
                                disabled={updateEmployee.isPending}
                              >
                                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 md:hidden">
                  {filteredEmployees.map((employee) => (
                    <div key={employee.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{employee.displayName}</div>
                          <div className="truncate text-xs text-muted-foreground">ID: {employee.employeeId}</div>
                        </div>
                        <Badge variant={employee.active ? "default" : "secondary"}>
                          {employee.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div><span className="block font-medium text-foreground">Added</span>{formatAccessDate(employee.createdAt)}</div>
                        <div><span className="block font-medium text-foreground">Updated</span>{formatAccessDate(employee.updatedAt)}</div>
                      </div>
                       <Badge className="mt-4" variant={employee.role === "administrator" ? "outline" : "secondary"}>
                         {employeeRoleLabel(employee.role)}
                      </Badge>
                      <Badge className="ml-2 mt-4" variant={employee.passwordSet ? "outline" : "secondary"}>
                        {employee.passwordSet ? "Password set" : "Password not set"}
                      </Badge>
                      <div className="mt-3 grid gap-2">
                         <Button
                           className="w-full"
                           variant="outline"
                           onClick={() => {
                             setEmployeeForPassword(employee);
                             setPassword("");
                             setPasswordConfirmation("");
                           }}
                           disabled={updateEmployee.isPending}
                         >
                           <KeyRound className="mr-2 h-4 w-4" />
                           {employee.passwordSet ? "Change password" : "Set password"}
                         </Button>
                         <label className="space-y-1 text-left text-sm font-medium">
                           Role
                           <select
                             aria-label={`Role for ${employee.displayName}`}
                             className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                             value={employee.role}
                             onChange={(event) => updateRole(employee, event.target.value as UserRole)}
                             disabled={updateEmployee.isPending}
                           >
                             {employeeRoleOptions.map((option) => (
                               <option key={option.value} value={option.value}>{option.label}</option>
                             ))}
                           </select>
                         </label>
                         {employee.active ? (
                           <Button className="w-full" variant="outline" onClick={() => setEmployeeToDeactivate(employee)}>
                             Deactivate access
                           </Button>
                         ) : (
                           <Button className="w-full" variant="outline" onClick={() => updateAccess(employee, true)} disabled={updateEmployee.isPending}>
                             Activate access
                           </Button>
                         )}
                         <Button className="w-full" variant="outline" onClick={() => openEditEmployee(employee)} disabled={updateEmployee.isPending}>
                           <Edit2 className="mr-2 h-4 w-4" />
                           Edit
                         </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <form onSubmit={handleAddEmployee}>
            <DialogHeader>
              <DialogTitle>Add employee access</DialogTitle>
              <DialogDescription>
                Enter the employee name and ID to create access. The employee will use the existing login flow.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <label htmlFor="employee-name" className="text-sm font-medium">Employee name</label>
              <Input
                id="employee-name"
                placeholder="Enter employee name"
                value={employeeName}
                onChange={(event) => setEmployeeName(event.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2 pb-4">
              <label htmlFor="employee-id" className="text-sm font-medium">Employee ID</label>
              <Input
                id="employee-id"
                inputMode="numeric"
                placeholder="Enter employee ID"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2 pb-4">
              <label htmlFor="employee-role" className="text-sm font-medium">Access role</label>
              <select
                id="employee-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newEmployeeRole}
                onChange={(event) => setNewEmployeeRole(event.target.value as UserRole)}
              >
                {employeeRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createEmployee.isPending}>Add access</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={employeeForEdit !== null}
        onOpenChange={(open) => { if (!open) closeEditEmployee(); }}
      >
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <form onSubmit={handleEditEmployee}>
            <DialogHeader>
              <DialogTitle>Edit employee name</DialogTitle>
              <DialogDescription>
                Update the name shown for employee ID {employeeForEdit?.employeeId}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <label htmlFor="edit-employee-name" className="text-sm font-medium">Employee name</label>
              <Input
                id="edit-employee-name"
                placeholder="Enter employee name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditEmployee}>Cancel</Button>
              <Button type="submit" disabled={updateEmployee.isPending || !editName.trim()}>
                Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={employeeForPassword !== null}
        onOpenChange={(open) => { if (!open) closePasswordDialog(); }}
      >
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <form onSubmit={handlePasswordSubmit}>
            <DialogHeader>
              <DialogTitle>{employeeForPassword?.passwordSet ? "Change password" : "Set password"}</DialogTitle>
              <DialogDescription>
                Set the sign-in password for employee ID {employeeForPassword?.employeeId}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="employee-password" className="text-sm font-medium">Password</label>
                <Input
                  id="employee-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="employee-password-confirmation" className="text-sm font-medium">Confirm password</label>
                <Input
                  id="employee-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePasswordDialog}>Cancel</Button>
              <Button type="submit" disabled={updateEmployee.isPending || password.length < 8 || password !== passwordConfirmation}>
                Save password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={employeeToDeactivate !== null}
        onOpenChange={(open) => { if (!open) setEmployeeToDeactivate(null); }}
      >
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate employee access?</DialogTitle>
            <DialogDescription>
              Employee ID {employeeToDeactivate?.employeeId} will remain registered but will not be able to sign in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeToDeactivate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => employeeToDeactivate && updateAccess(employeeToDeactivate, false)}
              disabled={updateEmployee.isPending}
            >
              Deactivate access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function errorStatus(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}

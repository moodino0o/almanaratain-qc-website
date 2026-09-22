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
  getGetEmployeeAccessQueryKey,
  useGetEmployeeAccess,
  useCreateEmployeeAccess,
  useUpdateEmployeeAccess,
  EmployeeAccess,
  UserRole,
  ReferenceCategory,
  ReferenceItem,
  ReportLayout,
  ReportLayoutColumn,
  useListReportLayouts,
  useUpdateReportLayout,
  getListReportLayoutsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Settings2, Building2, Users, Package, MapPin, Truck, Plus, Trash2, Edit2, KeyRound,
  Database, Check, X, Search, MoreVertical, UserPlus, ShieldAlert, Mail, ChevronDown
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

const REPORT_LAYOUT_COLUMN_OPTIONS: Record<
  string,
  Array<{ key: string; label: string }>
> = {
  blockCompression: [
    { key: "no", label: "No." },
    { key: "length", label: "Length (mm)" },
    { key: "width", label: "Width (mm)" },
    { key: "height", label: "Height (mm)" },
    { key: "load", label: "Load (kN)" },
    { key: "water", label: "Water (N/mm2)" },
    { key: "airDry", label: "Air Dry (N/mm2)" },
    { key: "normalized", label: "Normalized (N/mm2)" },
    { key: "density", label: "Density (kg/m3)" },
    { key: "wetWeight", label: "Wet Weight (kg)" },
  ],
  readyMixResults: [
    { key: "no", label: "No." },
    { key: "age", label: "Test Age" },
    { key: "length", label: "Length (mm)" },
    { key: "width", label: "Width (mm)" },
    { key: "height", label: "Height (mm)" },
    { key: "dryWeight", label: "Dry Weight" },
    { key: "wetWeight", label: "Wet Weight" },
    { key: "absorption", label: "Water Absorption (%)" },
    { key: "load", label: "Load (kN)" },
    { key: "strength", label: "Calculated Strength" },
  ],
  sieveResults: [
    { key: "no", label: "No." },
    { key: "size", label: "Sieve / Pore Size" },
    { key: "returned", label: "Amount Returned" },
    { key: "passing", label: "Amount Passing" },
    { key: "percentage", label: "% Passing" },
  ],
  pavingResults: [
    { key: "no", label: "No." },
    { key: "age", label: "Test Age" },
    { key: "length", label: "Length (mm)" },
    { key: "width", label: "Width (mm)" },
    { key: "height", label: "Height (mm)" },
    { key: "dryWeight", label: "Dry Weight" },
    { key: "wetWeight", label: "Wet Weight" },
    { key: "load", label: "Load (kN)" },
    { key: "strength", label: "Calculated Strength" },
  ],
};

const REPORT_LAYOUT_TABLE_LABELS: Record<string, string> = {
  blockCompression: "Block compression results",
  readyMixResults: "Ready Mix specimen results",
  sieveResults: "Sieve results",
  pavingResults: "Paving Block specimen results",
};

function ReportLayoutsSection() {
  const { data: layouts = [], isLoading, isError } = useListReportLayouts();
  const queryClient = useQueryClient();
  const updateLayout = useUpdateReportLayout();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ReportLayout | null>(null);
  const selectedLayout = layouts.find((layout) => layout.id === selectedId) ?? layouts[0];

  useEffect(() => {
    if (selectedLayout) {
      setSelectedId(selectedLayout.id);
      setDraft(selectedLayout);
    }
  }, [selectedLayout?.id]);

  if (isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading report layouts...</CardContent></Card>;
  }
  if (isError) {
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <p className="font-medium">Report editor could not be loaded.</p>
          <p className="text-sm text-muted-foreground">
            Sign in as an administrator to edit and save report forms.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!draft) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No report layouts are configured.</CardContent></Card>;
  }

  const config = draft.config;
  const tableKey = draft.testType === "Blocks"
    ? "blockCompression"
    : draft.testType === "Ready Mix"
      ? "readyMixResults"
      : draft.testType === "Sand Sieve" || draft.testType === "Aggregate Sieve"
        ? "sieveResults"
        : draft.testType === "Paving Blocks"
          ? "pavingResults"
          : "";
  const configuredColumns = tableKey ? (config.columns[tableKey] ?? []) : [];
  const columnOptions = REPORT_LAYOUT_COLUMN_OPTIONS[tableKey] ?? [];
  const availableColumns = columnOptions.filter(
    (option) => !configuredColumns.some((column) => column.key === option.key),
  );
  const setConfig = (patch: Partial<ReportLayout["config"]>) => {
    setDraft((current) => current ? {
      ...current,
      config: { ...current.config, ...patch },
    } : current);
  };
  const updateColumn = (columnKey: string, patch: Partial<ReportLayoutColumn>) => {
    setConfig({
      columns: {
        ...config.columns,
        [tableKey]: configuredColumns.map((column) =>
          column.key === columnKey ? { ...column, ...patch } : column,
        ),
      },
    });
  };
  const save = () => {
    updateLayout.mutate(
      { id: draft.id, data: { name: draft.name, config } },
      {
        onSuccess: (saved) => {
          setDraft(saved);
          queryClient.invalidateQueries({ queryKey: getListReportLayoutsQueryKey() });
          toast.success(`${saved.testType} report layout saved`);
        },
        onError: () => toast.error("Unable to save report layout"),
      },
    );
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> Report layouts</CardTitle>
        <CardDescription>
          Customize each report type. Changes affect new and existing printable reports and are limited to approved data fields.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1 text-sm font-medium">
            Report type
            <select
              value={draft.id}
              onChange={(event) => setSelectedId(Number(event.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal"
            >
              {layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.testType}</option>)}
            </select>
          </label>
          <label className="flex-1 space-y-1 text-sm font-medium">
            Report title
            <Input
              value={draft.config.title}
              onChange={(event) => setConfig({ title: event.target.value })}
            />
          </label>
          <Button onClick={save} disabled={updateLayout.isPending}>Save layout</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm font-medium">
            Font family
            <select
              value={config.fontFamily}
              onChange={(event) => setConfig({ fontFamily: event.target.value as ReportLayout["config"]["fontFamily"] })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal"
            >
              {["Arial", "Calibri", "Times New Roman", "Helvetica"].map((font) => <option key={font}>{font}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Font size
            <Input type="number" min={8} max={24} value={config.fontSize} onChange={(event) => setConfig({ fontSize: Number(event.target.value) })} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Text color
            <Input type="color" value={config.textColor} onChange={(event) => setConfig({ textColor: event.target.value })} className="h-10 p-1" />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Accent color
            <Input type="color" value={config.accentColor} onChange={(event) => setConfig({ accentColor: event.target.value })} className="h-10 p-1" />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Paper padding (mm)
            <Input type="number" min={5} max={30} value={config.paperPadding} onChange={(event) => setConfig({ paperPadding: Number(event.target.value) })} />
          </label>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Sections and position</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {[...config.sections].sort((left, right) => left.order - right.order).map((section) => (
              <div key={section.key} className="flex items-center gap-2 rounded-md border p-2">
                <input
                  type="checkbox"
                  checked={section.visible}
                  onChange={(event) => setConfig({
                    sections: config.sections.map((item) => item.key === section.key ? { ...item, visible: event.target.checked } : item),
                  })}
                />
                <span className="min-w-0 flex-1 text-sm">{section.label}</span>
                <Input
                  type="number"
                  min={0}
                  value={section.order}
                  className="h-8 w-20"
                  onChange={(event) => setConfig({
                    sections: config.sections.map((item) => item.key === section.key ? { ...item, order: Number(event.target.value) } : item),
                  })}
                />
              </div>
            ))}
          </div>
        </div>

        {tableKey && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{REPORT_LAYOUT_TABLE_LABELS[tableKey]}</h3>
                <p className="text-xs text-muted-foreground">Change order, width, visibility, and labels. Add only supported fields.</p>
              </div>
              <select
                disabled={!availableColumns.length}
                value=""
                onChange={(event) => {
                  const option = columnOptions.find((item) => item.key === event.target.value);
                  if (!option) return;
                  setConfig({
                    columns: {
                      ...config.columns,
                      [tableKey]: [
                        ...configuredColumns,
                        { ...option, visible: true, order: configuredColumns.length, width: 10 },
                      ],
                    },
                  });
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Add column…</option>
                {availableColumns.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {configuredColumns.map((column) => (
                <div key={column.key} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr_90px_90px_auto]">
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={(event) => updateColumn(column.key, { visible: event.target.checked })}
                  />
                  <Input value={column.label} onChange={(event) => updateColumn(column.key, { label: event.target.value })} />
                  <Input type="number" min={0} value={column.order} onChange={(event) => updateColumn(column.key, { order: Number(event.target.value) })} aria-label={`${column.label} order`} />
                  <Input type="number" min={1} max={100} value={column.width} onChange={(event) => updateColumn(column.key, { width: Number(event.target.value) })} aria-label={`${column.label} width`} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfig({ columns: { ...config.columns, [tableKey]: configuredColumns.filter((item) => item.key !== column.key) } })}
                    aria-label={`Remove ${column.label}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
      <Card className="mx-auto mt-12 max-w-lg text-center">
        <CardContent className="space-y-3 p-10">
          <h1 className="text-lg font-semibold">Administrator access required</h1>
          <p className="text-sm text-muted-foreground">
            Settings and employee access are only available to administrators.
          </p>
        </CardContent>
      </Card>
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
        <TabsList className="grid h-auto w-full max-w-2xl shrink-0 grid-cols-3">
          <TabsTrigger value="reference-data" className="gap-2 py-2.5">
            <Database className="h-4 w-4" /> Settings
          </TabsTrigger>
          <TabsTrigger value="employee-access" className="gap-2 py-2.5">
            <Users className="h-4 w-4" /> Employee Access
          </TabsTrigger>
          <TabsTrigger value="report-layouts" className="gap-2 py-2.5">
            <Settings2 className="h-4 w-4" /> Report Layouts
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

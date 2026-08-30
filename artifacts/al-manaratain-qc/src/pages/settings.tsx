import { useState, useMemo } from "react";
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
  ReferenceCategory,
  ReferenceItem
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Settings2, Building2, Users, Package, MapPin, Truck, Plus, Trash2, Edit2, 
  Database, Check, X, Search, MoreVertical 
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

function getCategoryIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("employe") || k.includes("technician")) return <Users className="w-5 h-5" />;
  if (k.includes("locat") || k.includes("plant") || k.includes("factor")) return <MapPin className="w-5 h-5" />;
  if (k.includes("suppli")) return <Truck className="w-5 h-5" />;
  if (k.includes("block")) return <Building2 className="w-5 h-5" />;
  if (k.includes("material") || k.includes("mix")) return <Package className="w-5 h-5" />;
  return <Database className="w-5 h-5" />;
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
      <Card className="flex flex-col h-full border shadow-sm">
        <CardHeader className="pb-4 shrink-0 bg-muted/20 border-b border-border/50 group">
          <div className="flex justify-between items-start gap-2">
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
                {getCategoryIcon(category.key)}
              </div>
              <div className="flex-1 min-w-0">
                {isEditingCategory ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <Input 
                      value={editCategoryLabel} 
                      onChange={(e) => setEditCategoryLabel(e.target.value)}
                      className="h-7 text-sm px-2 py-1"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateCategory()}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-success shrink-0" onClick={handleUpdateCategory}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0" onClick={() => { setIsEditingCategory(false); setEditCategoryLabel(category.label); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <CardTitle className="text-lg truncate" title={category.label}>{category.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5 truncate" title={category.key}>Key: {category.key}</CardDescription>
                  </>
                )}
              </div>
            </div>
            {!isEditingCategory && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditingCategory(true)}>
                    <Edit2 className="h-4 w-4 mr-2" /> Edit Label
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setCategoryToDelete(category)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Category
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col relative">
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

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: referenceData, isLoading, isError, refetch } = useGetReferenceData();
  const createCategory = useCreateReferenceCategory();

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

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
    return <div className="p-8 text-center text-muted-foreground">Loading reference data...</div>;
  }

  if (isError) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <Database className="h-9 w-9 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">Reference data could not be loaded</h2>
          <p className="mt-1 text-sm text-muted-foreground">Check the connection and try again.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  const categories = referenceData?.categories || [];

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" /> Reference Data
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage Master Data: locations, materials, mix designs, and personnel.</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-muted-foreground hidden md:inline-flex">System Administrator</Badge>
          <Button onClick={() => setIsAddCategoryOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Category
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-center">
          <div className="bg-muted p-4 rounded-full mb-4">
            <Database className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Reference Data Found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Create categories to manage the lookup values used throughout the application.</p>
          <Button onClick={() => setIsAddCategoryOpen(true)}>Create First Category</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pb-8">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}

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

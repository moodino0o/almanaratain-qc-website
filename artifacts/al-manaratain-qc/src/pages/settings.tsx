import { useGetLookups } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, Building2, Users, Package, MapPin, Truck, Plus, Lock } from "lucide-react";
import { ReactNode } from "react";

export default function Settings() {
  const { data: lookups, isLoading } = useGetLookups();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading reference data...</div>;
  }

  const renderList = (items: string[] = [], title: string, icon: ReactNode, description: string) => (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-4 shrink-0 bg-muted/20 border-b border-border/50">
        <div className="flex justify-between items-start">
          <div className="flex gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-xs mt-1">{description}</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-8" disabled>
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50">
          <Input placeholder="Search..." className="h-8 text-xs" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between items-center py-2 px-3 hover:bg-muted/50 rounded-md transition-colors text-sm font-medium">
              <span>{item}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" disabled>
                <Lock className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-4">No records found.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" /> Reference Data
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage Master Data: locations, materials, mix designs, and personnel.</p>
        </div>
        <Badge variant="outline" className="text-muted-foreground">System Administrator</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pb-8">
        {renderList(
          lookups?.materials, 
          "Products & Materials", 
          <Package className="w-5 h-5" />, 
          "Catalog of produced materials."
        )}
        
        {renderList(
          lookups?.employees, 
          "Technicians", 
          <Users className="w-5 h-5" />, 
          "Authorized lab personnel."
        )}
        
        {renderList(
          lookups?.locations, 
          "Locations & Plants", 
          <MapPin className="w-5 h-5" />, 
          "Operating facilities."
        )}
        
        {renderList(
          lookups?.suppliers, 
          "Suppliers", 
          <Truck className="w-5 h-5" />, 
          "Approved raw material vendors."
        )}
        
        {renderList(
          lookups?.blockTypes, 
          "Block Types", 
          <Building2 className="w-5 h-5" />, 
          "Manufactured block variants."
        )}
        
        {renderList(
          lookups?.mixStrengths, 
          "Mix Strengths", 
          <Package className="w-5 h-5" />, 
          "Ready Mix design specifications."
        )}
      </div>
    </div>
  );
}

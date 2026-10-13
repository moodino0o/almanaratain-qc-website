<?php

namespace App\Http\Controllers;

use App\Models\QcReferenceCategory;
use App\Models\QcReferenceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class QcReferenceController extends Controller
{
    private const SEEDS = [
        'machines' => ['Masonry Machines', ['HENKI I', 'HENKI II', 'MASA', 'FRIMA', 'COLOMBIA']],
        'employees' => ['Technicians', ['ADEL ABBAS EBRAHIM', 'AHMED ABDULLA', 'AHMED HUSHAM', 'AMIT ANIL', 'AMMAR JAFFER']],
        'suppliers' => ['Suppliers', ['Al Manaratain', 'AL HASANAIN', 'AL NAMAL', 'AZELON', 'HAFFERA CRUSHER']],
        'materials' => ['Materials', ['Ready Mix Concrete', 'Concrete Block', 'Paving Block', 'Sand', 'Dust', '2-5 mm Aggregate', '10 mm Aggregate', '20 mm Aggregate', 'Water']],
        'locations' => ['Other QC Plant Locations', ['Hidd', 'Khamis', 'Haffera', 'Dammam']],
        'readyMixPlantLocations' => ['Ready Mix Plant / Production Locations', ['ELBA', 'EASTERN']],
        'blockTypes' => ['Block Types', ['Plain Block', 'Lined Block', 'Sandwich Insulation Block', '8\'\' Two Piston Block', '8\'\' Three Piston Block', '8\'\' Solid Block', '8\'\' Slotted Insulation Block']],
        'blockSizes' => ['Block Sizes', ['4"', '6"', '8"', '12"', '200*200*80', '400*100*200', '400*150*200', '400*200*200', '400*250*200']],
        'sampleTypes' => ['Block Sample Types', ['CUBER', 'MANUAL']],
        'conditioningMethods' => ['Block Conditioning Methods', ['WATER at 20±5 C']],
        'preparationMethods' => ['Block Preparation Methods', ['GRINDING']],
        'complaintTypes' => ['Complaint Types', ['Damage', 'Crack', 'Missing item']],
        'complaintMaterials' => ['Complaint Materials', ['Block', 'Paving', 'Ready Mix']],
        'mixStrengths' => ['Mix Strengths', [
            '20 N OPC', '20 N OPC Ice', '20 N SRC', '20 N SRC Ice',
            '25 N OPC', '25 N OPC Ice', '25 N SRC', '25 N SRC Ice',
            '30 N OPC', '30 N OPC Ice', '30 N SRC', '30 N SRC Ice',
            '35 N OPC', '35 N OPC Ice', '35 N SRC', '35 N SRC Ice',
            '45 N OPC', '45 N OPC Ice', '45 N OPC Fiber', '45 N OPC Fiber Ice',
            '45 N SRC', '45 N SRC Ice', '45 N SRC Fiber', '45 N SRC Fiber Ice',
            '50 N OPC', '50 N OPC Ice', '50 N SRC', '50 N SRC Ice',
        ]],
        'compactionTypes' => ['Compaction Types', ['Mechanical compaction']],
        'precastTypes' => ['Precast Types', ['150 mm slab', '200', '250', '260']],
        'sieveSizes' => ['Sieve / Pore Sizes', ['0 mm', '0.063 mm', '0.075 mm', '0.125 mm', '0.15 mm', '0.25 mm', '0.3 mm', '0.5 mm', '0.6 mm', '1 mm', '1.18 mm', '2 mm', '2.36 mm', '5 mm', '6.3 mm', '10 mm', '14 mm', '20 mm']],
        'customers' => ['Customers', []], 'customerLocations' => ['Customer Locations', []],
    ];

    public function index(): JsonResponse
    {
        $this->reconcileDefaults();
        $categories = QcReferenceCategory::with(['items' => fn ($query) => $query->select('id', 'category_id', 'value')->orderBy('value')])->whereNotIn('key', ['factories', 'plants'])->orderBy('label')->get();
        return response()->json(['categories' => $categories->map(fn ($category) => ['id' => $category->id, 'key' => $category->key, 'label' => $category->label, 'items' => $category->items->map(fn ($item) => ['id' => $item->id, 'categoryId' => $item->category_id, 'value' => $item->value])->values()])->values()]);
    }

    public function lookups(): JsonResponse
    {
        $this->reconcileDefaults();
        $items = QcReferenceItem::with('category')->orderBy('value')->get()->groupBy(fn ($item) => $item->category->key);
        $values = fn (string $key) => ($items->get($key) ?? collect())->pluck('value')->values();
        return response()->json([
            'factories' => $values('factories'), 'plants' => $values('plants'),
            'employees' => $values('employees'), 'suppliers' => $values('suppliers'), 'materials' => $values('materials'),
            'locations' => $values('locations'), 'blockTypes' => $values('blockTypes'), 'blockSizes' => $values('blockSizes'),
            'mixStrengths' => $values('mixStrengths'), 'customers' => $values('customers'), 'customerLocations' => $values('customerLocations'),
            'sieveSizes' => $values('sieveSizes'),
        ])->header('Cache-Control', 'no-store');
    }

    public function createCategory(Request $request): JsonResponse
    {
        $data = $request->validate(['key' => ['required', 'string', 'max:100'], 'label' => ['required', 'string', 'max:160']]);
        $key = Str::slug($data['key']);
        if (! $key) return response()->json(['error' => 'Category key and label are required'], 400);
        if (QcReferenceCategory::where('key', $key)->exists()) return response()->json(['error' => 'A category with this key already exists'], 409);
        $category = QcReferenceCategory::create(['key' => $key, 'label' => trim($data['label'])]);
        return response()->json(['id' => $category->id, 'key' => $category->key, 'label' => $category->label, 'items' => []], 201);
    }

    public function updateCategory(Request $request, int $id): JsonResponse
    {
        $category = QcReferenceCategory::with('items')->find($id);
        if (! $category) return response()->json(['error' => 'Reference category not found'], 404);
        $data = $request->validate(['key' => ['sometimes', 'string', 'max:100'], 'label' => ['sometimes', 'string', 'max:160']]);
        if (isset($data['key'])) $category->key = preg_replace('/[^a-zA-Z0-9]+/', '-', trim($data['key']));
        if (isset($data['label'])) $category->label = trim($data['label']);
        $category->save();
        return response()->json(['id' => $category->id, 'key' => $category->key, 'label' => $category->label, 'items' => $category->items->map(fn ($item) => ['id' => $item->id, 'categoryId' => $item->category_id, 'value' => $item->value])->values()]);
    }

    public function deleteCategory(int $id): JsonResponse
    {
        $category = QcReferenceCategory::find($id);
        if (! $category) return response()->json(['error' => 'Reference category not found'], 404);
        $category->delete();
        return response()->json(null, 204);
    }

    public function createItem(Request $request, int $categoryId): JsonResponse
    {
        $data = $request->validate(['value' => ['required', 'string', 'min:1', 'max:255']]);
        $category = QcReferenceCategory::find($categoryId);
        if (! $category) return response()->json(['error' => 'Reference category not found'], 404);
        $user = $request->user();
        $isAdmin = (bool) ($user?->is_admin ?? $user?->isAdmin ?? false) || strtolower((string) ($user?->role ?? '')) === 'administrator';
        $employeeAddable = ['locations', 'readyMixPlantLocations', 'customers', 'customerLocations', 'mixStrengths', 'machines'];
        if (! $isAdmin && ! in_array($category->key, $employeeAddable, true)) {
            return response()->json(['code' => 'REFERENCE_DATA_ADMIN_REQUIRED', 'error' => 'Administrator access is required to add values to this category.'], 403);
        }
        $value = trim($data['value']);
        if ($category->items()->where('value', $value)->exists()) return response()->json(['error' => 'This value already exists in the category'], 409);
        $item = $category->items()->create(['value' => $value]);
        return response()->json(['id' => $item->id, 'categoryId' => $item->category_id, 'value' => $item->value], 201);
    }

    public function updateItem(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['value' => ['required', 'string', 'min:1', 'max:255']]);
        $item = QcReferenceItem::find($id);
        if (! $item) return response()->json(['error' => 'Reference value not found'], 404);
        $value = trim($data['value']);
        if (QcReferenceItem::where('category_id', $item->category_id)->where('value', $value)->where('id', '<>', $id)->exists()) return response()->json(['error' => 'This value already exists in the category'], 409);
        $item->update(['value' => $value]);
        return response()->json(['id' => $item->id, 'categoryId' => $item->category_id, 'value' => $item->value]);
    }

    public function deleteItem(int $id): JsonResponse
    {
        $item = QcReferenceItem::find($id);
        if (! $item) return response()->json(['error' => 'Reference value not found'], 404);
        if ($item->sieveMaterialStandards()->exists() || $item->sieveSizeStandards()->exists()) return response()->json(['error' => 'This reference value is used by a configured sieve standard and cannot be deleted.'], 409);
        $item->delete();
        return response()->json(null, 204);
    }

    public function reconcileDefaults(): void
    {
        foreach (self::SEEDS as $key => [$label, $values]) {
            $category = QcReferenceCategory::firstOrCreate(['key' => $key], ['label' => $label]);
            foreach ($values as $value) $category->items()->firstOrCreate(['value' => $value]);
        }
    }
}

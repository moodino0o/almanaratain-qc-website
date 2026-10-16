<?php

namespace App\Http\Controllers;

use App\Models\QcReferenceCategory;
use App\Models\QcReferenceItem;
use App\Models\QcShapeFactor;
use App\Models\QcSieveStandard;
use App\Models\QcStrengthStandard;
use App\Models\QcWaterStandard;
use App\Services\QcCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QcStandardsController extends Controller
{
    private const TYPES = ['Ready Mix', 'Blocks', 'Paving Blocks', 'Sand Sieve', 'Aggregate Sieve', 'Water', 'Flakiness & Elongation', 'RMX Trial', 'Precast', 'Kerb Stone'];

    public function strengths(\App\Services\QcDefaultDataService $defaults): JsonResponse
    {
        $defaults->ensureStrengthStandards();
        return response()->json(QcStrengthStandard::orderBy('test_type')->orderBy('material')->orderBy('id')->get()->map(fn ($row) => $this->strengthJson($row)));
    }

    public function createStrength(Request $request): JsonResponse
    {
        $data = $request->validate([
            'testType' => ['required', Rule::in(self::TYPES)], 'material' => ['required', 'string', 'min:1'],
            'blockType' => ['nullable', 'string'], 'blockSize' => ['nullable', 'string'],
            'cubeAge' => ['nullable', 'integer', Rule::in([1, 7, 28])], 'kerbClass' => ['nullable', 'numeric', 'min:1'],
            'kerbMarking' => ['nullable', 'string'], 'bsStandard' => ['required', 'string', 'min:1'],
            'requiredStrength' => ['required', 'numeric', 'min:0'], 'minimumIndividualStrength' => ['nullable', 'numeric', 'min:0'],
            'waterAbsorptionLimit' => ['nullable', 'numeric', 'min:0'], 'dammamAverageStrength' => ['nullable', 'numeric', 'min:0'],
            'dammamMinimumStrength' => ['nullable', 'numeric', 'min:0'], 'strengthUnit' => ['sometimes', 'string'],
        ]);
        if (($data['testType'] === 'Precast' && ! in_array($data['cubeAge'] ?? null, [1, 7, 28], true)) || ($data['testType'] !== 'Precast' && isset($data['cubeAge']))) {
            return response()->json(['error' => 'Precast standards require an age of 1, 7, or 28 days; other strength standards cannot have a cube age.'], 400);
        }
        $data['material'] = trim($data['material']);
        $data['block_type'] = isset($data['blockType']) && trim($data['blockType']) !== '' ? trim($data['blockType']) : null;
        $data['block_size'] = isset($data['blockSize']) && trim($data['blockSize']) !== '' ? trim($data['blockSize']) : null;
        $data['cube_age'] = $data['cubeAge'] ?? null; $data['kerb_class'] = $data['kerbClass'] ?? null;
        $data['kerb_marking'] = $data['kerbMarking'] ?? null; $data['bs_standard'] = trim($data['bsStandard']);
        $data['required_strength'] = $data['requiredStrength']; $data['minimum_individual_strength'] = $data['minimumIndividualStrength'] ?? null;
        $data['water_absorption_limit'] = $data['waterAbsorptionLimit'] ?? null; $data['strength_unit'] = trim($data['strengthUnit'] ?? 'N/mm²') ?: 'N/mm²';
        if ($data['testType'] === 'Blocks') {
            $sandwich = stripos((string) $data['block_type'], 'sandwich') !== false;
            $data['dammam_average_strength'] = $data['dammamAverageStrength'] ?? ($sandwich ? 4.14 : 13.8);
            $data['dammam_minimum_strength'] = $sandwich ? null : ($data['dammamMinimumStrength'] ?? 12.4);
        } else {
            $data['dammam_average_strength'] = $data['dammam_minimum_strength'] = null;
        }
        $standard = QcStrengthStandard::create($this->strengthFields($data));
        $this->refreshEvaluations([$standard->test_type]);
        return response()->json($this->strengthJson($standard), 201);
    }

    public function updateStrength(Request $request, int $id): JsonResponse
    {
        $standard = QcStrengthStandard::find($id);
        if (! $standard) return response()->json(['error' => 'Strength standard not found'], 404);
        $data = $request->validate([
            'testType' => ['sometimes', Rule::in(self::TYPES)], 'material' => ['sometimes', 'string', 'min:1'],
            'blockType' => ['sometimes', 'nullable', 'string'], 'blockSize' => ['sometimes', 'nullable', 'string'],
            'cubeAge' => ['sometimes', 'nullable', 'integer', Rule::in([1, 7, 28])], 'kerbClass' => ['sometimes', 'nullable', 'numeric', 'min:1'],
            'kerbMarking' => ['sometimes', 'nullable', 'string'], 'bsStandard' => ['sometimes', 'string', 'min:1'],
            'requiredStrength' => ['sometimes', 'numeric', 'min:0'], 'minimumIndividualStrength' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'waterAbsorptionLimit' => ['sometimes', 'nullable', 'numeric', 'min:0'], 'dammamAverageStrength' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'dammamMinimumStrength' => ['sometimes', 'nullable', 'numeric', 'min:0'], 'strengthUnit' => ['sometimes', 'string'],
        ]);
        $type = $data['testType'] ?? $standard->test_type;
        $age = $data['cubeAge'] ?? $standard->cube_age;
        if (($type === 'Precast' && ! in_array((int) $age, [1, 7, 28], true)) || ($type !== 'Precast' && isset($data['cubeAge']))) return response()->json(['error' => 'Precast standards require a cube age of 1, 7, or 28 days.'], 400);
        $map = ['testType'=>'test_type','material'=>'material','blockType'=>'block_type','blockSize'=>'block_size','cubeAge'=>'cube_age','kerbClass'=>'kerb_class','kerbMarking'=>'kerb_marking','bsStandard'=>'bs_standard','requiredStrength'=>'required_strength','minimumIndividualStrength'=>'minimum_individual_strength','waterAbsorptionLimit'=>'water_absorption_limit','dammamAverageStrength'=>'dammam_average_strength','dammamMinimumStrength'=>'dammam_minimum_strength','strengthUnit'=>'strength_unit'];
        foreach ($map as $input => $column) if (array_key_exists($input, $data)) $standard->{$column} = is_string($data[$input]) ? trim($data[$input]) : $data[$input];
        $standard->cube_age = $type === 'Precast' ? $age : null;
        if ($type !== 'Blocks') { $standard->dammam_average_strength = null; $standard->dammam_minimum_strength = null; }
        if ($type === 'Blocks' && array_key_exists('blockType', $data) && ! array_key_exists('dammamAverageStrength', $data)) {
            $sandwich = stripos((string) $standard->block_type, 'sandwich') !== false;
            $standard->dammam_average_strength = $sandwich ? 4.14 : 13.8;
            $standard->dammam_minimum_strength = $sandwich ? null : 12.4;
        }
        $oldType = $standard->getOriginal('test_type');
        $standard->save();
        $this->refreshEvaluations([$oldType, $standard->test_type]);
        return response()->json($this->strengthJson($standard));
    }

    public function deleteStrength(int $id): JsonResponse
    {
        $standard = QcStrengthStandard::find($id);
        if (! $standard) return response()->json(['error' => 'Strength standard not found'], 404);
        $type = $standard->test_type; $standard->delete(); $this->refreshEvaluations([$type]);
        return response()->json(null, 204);
    }

    public function shapes(QcReferenceController $references): JsonResponse
    {
        $references->reconcileDefaults();
        $category = QcReferenceCategory::where('key', 'blockSizes')->first();
        foreach ($category?->items ?? [] as $item) QcShapeFactor::firstOrCreate(['block_size' => $item->value], ['block_type' => null, 'shape_factor' => null, 'correction_factor' => null]);
        return response()->json(QcShapeFactor::whereNotNull('block_size')->orderBy('block_size')->orderBy('id')->get()->map(fn ($row) => ['id'=>$row->id,'blockSize'=>$row->block_size ?? '', 'shapeFactor'=>$row->shape_factor===null?null:(float)$row->shape_factor, 'correctionFactor'=>$row->correction_factor===null?null:(float)$row->correction_factor]))->header('Cache-Control', 'no-store');
    }

    public function createShape(Request $request): JsonResponse
    {
        $data = $request->validate(['blockSize'=>['required','string','min:1'],'shapeFactor'=>['nullable','numeric','min:0'],'correctionFactor'=>['sometimes','nullable','numeric','min:0']]);
        $size = trim($data['blockSize']);
        $correction = array_key_exists('correctionFactor', $data) ? $data['correctionFactor'] : QcCalculationService::pavingCorrectionFactor($size);
        $row = QcShapeFactor::create(['block_size'=>$size,'shape_factor'=>$data['shapeFactor'] ?? null,'correction_factor'=>$correction]);
        $this->refreshEvaluations(['Blocks','Paving Blocks']);
        return response()->json(['id'=>$row->id,'blockSize'=>$row->block_size,'shapeFactor'=>$row->shape_factor===null?null:(float)$row->shape_factor,'correctionFactor'=>$row->correction_factor===null?null:(float)$row->correction_factor], 201);
    }

    public function updateShape(Request $request, int $id): JsonResponse
    {
        $row = QcShapeFactor::find($id);
        if (! $row) return response()->json(['error'=>'Shape factor not found'],404);
        $data = $request->validate(['blockSize'=>['sometimes','string','min:1'],'shapeFactor'=>['sometimes','nullable','numeric','min:0'],'correctionFactor'=>['sometimes','nullable','numeric','min:0']]);
        foreach (['blockSize'=>'block_size','shapeFactor'=>'shape_factor','correctionFactor'=>'correction_factor'] as $key=>$column) if (array_key_exists($key,$data)) $row->{$column} = is_string($data[$key]) ? trim($data[$key]) : $data[$key];
        $row->save(); $this->refreshEvaluations(['Blocks','Paving Blocks']);
        return response()->json(['id'=>$row->id,'blockSize'=>$row->block_size ?? '', 'shapeFactor'=>$row->shape_factor===null?null:(float)$row->shape_factor,'correctionFactor'=>$row->correction_factor===null?null:(float)$row->correction_factor]);
    }

    public function deleteShape(int $id): JsonResponse
    {
        $row = QcShapeFactor::find($id); if (! $row) return response()->json(['error'=>'Shape factor not found'],404);
        $row->delete(); $this->refreshEvaluations(['Blocks','Paving Blocks']); return response()->json(null,204);
    }

    public function waters(\App\Services\QcDefaultDataService $defaults): JsonResponse
    {
        $defaults->ensureWaterStandard();
        return response()->json(QcWaterStandard::orderByDesc('is_default')->orderBy('name')->get()->map(fn ($row) => $this->waterJson($row)));
    }

    public function createWater(Request $request): JsonResponse
    {
        $data = $request->validate(['name'=>['required','string','min:1'], ...$this->waterRules()]);
        if (! $this->ordered($data)) return response()->json(['error'=>'Each Water minimum must be less than or equal to its maximum.'],400);
        $fields = ['name'=>trim($data['name']),'is_default'=>false];
        foreach (['ph','chloride','tds','so3'] as $field) {
            $fields["{$field}_min"] = $data["{$field}Min"];
            $fields["{$field}_max"] = $data["{$field}Max"];
        }
        $row = QcWaterStandard::create($fields);
        return response()->json($this->waterJson($row),201);
    }

    public function updateWater(Request $request, int $id): JsonResponse
    {
        $row = QcWaterStandard::find($id); if (! $row) return response()->json(['error'=>'Water limit profile not found'],404);
        $data = $request->validate(['name'=>['sometimes','string','min:1'], ...$this->waterRules(true)]);
        $next = []; foreach (['ph','chloride','tds','so3'] as $field) { $next["{$field}_min"]=$data["{$field}Min"] ?? $row->{"{$field}_min"}; $next["{$field}_max"]=$data["{$field}Max"] ?? $row->{"{$field}_max"}; }
        if (! $this->ordered($next)) return response()->json(['error'=>'Each Water minimum must be less than or equal to its maximum.'],400);
        if (isset($data['name'])) $row->name=trim($data['name']);
        foreach ($next as $column=>$value) $row->{$column}=$value;
        $row->save();
        $this->refreshWaterEvaluations($row->id);
        return response()->json($this->waterJson($row));
    }

    public function deleteWater(int $id): JsonResponse
    {
        $row=QcWaterStandard::find($id); if (!$row) return response()->json(['error'=>'Water limit profile not found'],404);
        if ($row->is_default) return response()->json(['error'=>'The default Water limit profile cannot be deleted.'],409);
        foreach (\App\Models\QcRecord::where('test_type','Water')->get() as $record) if ((int) (($record->details ?? [])['waterStandardId'] ?? 0)===$id) return response()->json(['error'=>'This Water limit profile is linked to one or more records and cannot be deleted.'],409);
        $row->delete(); return response()->json(null,204);
    }

    public function sieves(): JsonResponse
    {
        return response()->json(QcSieveStandard::with(['material','sieveSize'])->orderBy('test_type')->orderBy('material_reference_item_id')->orderBy('sieve_size_reference_item_id')->get()->map(fn ($row)=>$this->sieveJson($row)));
    }

    public function createSieve(Request $request): JsonResponse
    {
        $data=$request->validate(['testType'=>['required',Rule::in(['Sand Sieve','Aggregate Sieve'])],'materialReferenceItemId'=>['required','integer','min:1'],'sieveSizeReferenceItemId'=>['required','integer','min:1'],'standardReference'=>['required','string','min:1'],'measurementType'=>['required',Rule::in(['percentage','amount'])],'minimum'=>['nullable','numeric'],'maximum'=>['nullable','numeric'],'unit'=>['sometimes','string']]);
        if (($error=$this->sieveLimitError($data['minimum']??null,$data['maximum']??null))!==null) return response()->json(['error'=>$error],400);
        $material=$this->referenceInCategory($data['materialReferenceItemId'],'materials'); $sieve=$this->referenceInCategory($data['sieveSizeReferenceItemId'],'sieveSizes');
        if (!$material || !$sieve) return response()->json(['error'=>'Choose a material and sieve size from Reference Data.'],400);
        $exists=QcSieveStandard::where('test_type',$data['testType'])->where('material_reference_item_id',$material->id)->where('sieve_size_reference_item_id',$sieve->id)->where('measurement_type',$data['measurementType'])->exists();
        if($exists) return response()->json(['error'=>'A sieve standard already exists for this material and sieve size.'],409);
        $row=QcSieveStandard::create(['test_type'=>$data['testType'],'material_reference_item_id'=>$material->id,'sieve_size_reference_item_id'=>$sieve->id,'standard_reference'=>trim($data['standardReference']),'measurement_type'=>$data['measurementType'],'minimum'=>$data['minimum']??null,'maximum'=>$data['maximum']??null,'unit'=>trim($data['unit']??'%')]);
        return response()->json($this->sieveJson($row->load(['material','sieveSize'])),201);
    }

    public function updateSieve(Request $request,int $id):JsonResponse
    {
        $row=QcSieveStandard::with(['material','sieveSize'])->find($id);if(!$row)return response()->json(['error'=>'Sieve standard not found'],404);
        $data=$request->validate(['testType'=>['sometimes',Rule::in(['Sand Sieve','Aggregate Sieve'])],'materialReferenceItemId'=>['sometimes','integer','min:1'],'sieveSizeReferenceItemId'=>['sometimes','integer','min:1'],'standardReference'=>['sometimes','string','min:1'],'measurementType'=>['sometimes',Rule::in(['percentage','amount'])],'minimum'=>['sometimes','nullable','numeric'],'maximum'=>['sometimes','nullable','numeric'],'unit'=>['sometimes','string']]);
        $min=array_key_exists('minimum',$data)?$data['minimum']:$row->minimum;$max=array_key_exists('maximum',$data)?$data['maximum']:$row->maximum;
        if(($error=$this->sieveLimitError($min,$max))!==null)return response()->json(['error'=>$error],400);
        $material=$this->referenceInCategory($data['materialReferenceItemId']??$row->material_reference_item_id,'materials');$sieve=$this->referenceInCategory($data['sieveSizeReferenceItemId']??$row->sieve_size_reference_item_id,'sieveSizes');
        if(!$material||!$sieve)return response()->json(['error'=>'Choose a material and sieve size from Reference Data.'],400);
        $row->fill(['test_type'=>$data['testType']??$row->test_type,'material_reference_item_id'=>$material->id,'sieve_size_reference_item_id'=>$sieve->id,'standard_reference'=>isset($data['standardReference'])?trim($data['standardReference']):$row->standard_reference,'measurement_type'=>$data['measurementType']??$row->measurement_type,'minimum'=>$min,'maximum'=>$max,'unit'=>isset($data['unit'])?trim($data['unit']):$row->unit]);
        if(QcSieveStandard::where('test_type',$row->test_type)->where('material_reference_item_id',$material->id)->where('sieve_size_reference_item_id',$sieve->id)->where('measurement_type',$row->measurement_type)->where('id','<>',$id)->exists())return response()->json(['error'=>'A sieve standard already exists for this material and sieve size.'],409);
        $row->save();return response()->json($this->sieveJson($row->load(['material','sieveSize'])));
    }

    public function deleteSieve(int $id):JsonResponse
    {
        $row=QcSieveStandard::find($id);if(!$row)return response()->json(['error'=>'Sieve standard not found'],404);$row->delete();return response()->json(null,204);
    }

    private function strengthJson($row):array{return ['id'=>$row->id,'testType'=>$row->test_type,'material'=>$row->material,'blockType'=>$row->block_type,'blockSize'=>$row->block_size,'cubeAge'=>$row->cube_age===null?null:(int)$row->cube_age,'kerbClass'=>$row->kerb_class===null?null:(float)$row->kerb_class,'kerbMarking'=>$row->kerb_marking,'bsStandard'=>$row->bs_standard,'requiredStrength'=>(float)$row->required_strength,'minimumIndividualStrength'=>$row->minimum_individual_strength===null?null:(float)$row->minimum_individual_strength,'waterAbsorptionLimit'=>$row->water_absorption_limit===null?null:(float)$row->water_absorption_limit,'dammamAverageStrength'=>$row->dammam_average_strength===null?null:(float)$row->dammam_average_strength,'dammamMinimumStrength'=>$row->dammam_minimum_strength===null?null:(float)$row->dammam_minimum_strength,'strengthUnit'=>$row->strength_unit];}
    private function strengthFields(array $d):array{return ['test_type'=>$d['testType'],'material'=>$d['material'],'block_type'=>$d['block_type'],'block_size'=>$d['block_size'],'cube_age'=>$d['cube_age'],'kerb_class'=>$d['kerb_class'],'kerb_marking'=>$d['kerb_marking'],'bs_standard'=>$d['bs_standard'],'required_strength'=>$d['required_strength'],'minimum_individual_strength'=>$d['minimum_individual_strength'],'water_absorption_limit'=>$d['water_absorption_limit'],'dammam_average_strength'=>$d['dammam_average_strength'],'dammam_minimum_strength'=>$d['dammam_minimum_strength'],'strength_unit'=>$d['strength_unit']];}
    private function refreshEvaluations(array $types):void
    {
        $calculator=app(QcCalculationService::class);
        foreach(\App\Models\QcRecord::whereIn('test_type',array_unique($types))->get() as $record){
            $details=$record->details??[];
            $evaluated=$record->test_type==='Water'?$calculator->evaluateWater($details,QcWaterStandard::where('is_default',true)->first()):$calculator->evaluateStrength($record->test_type,$record->material,$record->location,$details,QcStrengthStandard::orderBy('id')->get(),QcShapeFactor::all());
            if($evaluated['status']!==null){$record->details=$evaluated['details'];$record->status=$evaluated['status'];$record->save();}
        }
    }
    private function refreshWaterEvaluations(?int $onlyStandardId = null): void
    {
        $defaults = app(\App\Services\QcDefaultDataService::class);
        $default = $defaults->ensureWaterStandard();
        $calculator = app(QcCalculationService::class);
        foreach (\App\Models\QcRecord::where('test_type', 'Water')->get() as $record) {
            $details = $record->details ?? [];
            $selectedId = isset($details['waterStandardId']) ? (int) $details['waterStandardId'] : null;
            if ($onlyStandardId !== null && $selectedId !== $onlyStandardId && ($selectedId !== null || $default?->id !== $onlyStandardId)) continue;
            $standard = $selectedId ? QcWaterStandard::find($selectedId) : $default;
            $evaluated = $calculator->evaluateWater($details, $standard);
            $record->details = $evaluated['details']; $record->status = $evaluated['status']; $record->save();
        }
    }
    private function waterJson($row):array{return ['id'=>$row->id,'name'=>$row->name,'phMin'=>(float)$row->ph_min,'phMax'=>(float)$row->ph_max,'chlorideMin'=>(float)$row->chloride_min,'chlorideMax'=>(float)$row->chloride_max,'tdsMin'=>(float)$row->tds_min,'tdsMax'=>(float)$row->tds_max,'so3Min'=>(float)$row->so3_min,'so3Max'=>(float)$row->so3_max,'isDefault'=>(bool)$row->is_default];}
    private function waterRules(bool $sometimes=false):array{$rule=$sometimes?['sometimes','numeric']:['required','numeric'];$rules=[];foreach(['ph','chloride','tds','so3'] as $key){$rules["{$key}Min"]=$rule;$rules["{$key}Max"]=$rule;}return $rules;}
    private function ordered(array $d):bool{foreach(['ph','chloride','tds','so3'] as $field){$min=$d["{$field}_min"]??$d["{$field}Min"]??null;$max=$d["{$field}_max"]??$d["{$field}Max"]??null;if($min===null||$max===null||$min>$max)return false;}return true;}
    private function sieveJson($row):array{return ['id'=>$row->id,'testType'=>$row->test_type,'materialReferenceItemId'=>$row->material_reference_item_id,'material'=>$row->material?->value??'','sieveSizeReferenceItemId'=>$row->sieve_size_reference_item_id,'sieveSize'=>$row->sieveSize?->value??'','standardReference'=>$row->standard_reference,'measurementType'=>$row->measurement_type,'minimum'=>$row->minimum===null?null:(float)$row->minimum,'maximum'=>$row->maximum===null?null:(float)$row->maximum,'unit'=>$row->unit];}
    private function sieveLimitError($min,$max):?string{if($min===null&&$max===null)return 'At least one acceptance limit is required';if($min!==null&&$max!==null&&$min>$max)return 'The minimum limit cannot exceed the maximum limit';return null;}
    private function referenceInCategory(int $id,string $key):?QcReferenceItem{return QcReferenceItem::whereKey($id)->whereHas('category',fn($query)=>$query->where('key',$key))->first();}
}

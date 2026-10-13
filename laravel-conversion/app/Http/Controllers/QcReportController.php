<?php

namespace App\Http\Controllers;

use App\Models\QcReportLayout;
use App\Models\QcReportTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class QcReportController extends Controller
{
    private const TYPES = ['Ready Mix', 'Blocks', 'Paving Blocks', 'Sand Sieve', 'Aggregate Sieve', 'Water', 'Flakiness & Elongation', 'RMX Trial', 'Precast', 'Kerb Stone'];

    public function layouts(): JsonResponse
    {
        $this->ensureLayouts();
        return response()->json(QcReportLayout::orderBy('test_type')->get()->map(fn ($row) => ['id'=>$row->id,'testType'=>$row->test_type,'name'=>$row->name,'config'=>$row->config]));
    }

    public function updateLayout(Request $request, int $id): JsonResponse
    {
        $layout = QcReportLayout::find($id);
        if (! $layout) return response()->json(['error'=>'Report layout not found'],404);
        $data = $request->validate(['name'=>['sometimes','string','min:1','max:160'],'config'=>['sometimes','array']]);
        if (isset($data['name'])) $layout->name=trim($data['name']);
        if (isset($data['config'])) {
            $error=$this->layoutError($data['config']);
            if($error)return response()->json(['error'=>$error],400);
            $layout->config=$data['config'];
        }
        $layout->save();
        return response()->json(['id'=>$layout->id,'testType'=>$layout->test_type,'name'=>$layout->name,'config'=>$layout->config]);
    }

    public function templates(Request $request): JsonResponse
    {
        $request->validate(['testType'=>['sometimes',Rule::in(self::TYPES)]]);
        $this->ensureLayouts();
        $query=QcReportTemplate::query();
        if($request->query('testType'))$query->where('test_type',$request->query('testType'));
        return response()->json($query->orderBy('test_type')->orderBy('name')->get()->map(fn($row)=>$this->templateJson($row)));
    }

    public function createTemplate(Request $request): JsonResponse
    {
        $this->ensureDefaultLayouts();
        $data=$request->validate(['testType'=>['required',Rule::in(self::TYPES)],'name'=>['required','string','min:1','max:160'],'description'=>['nullable','string','max:1000'],'isDefault'=>['sometimes','boolean'],'design'=>['required','array']]);
        if($error=$this->designError($data['design']))return response()->json(['error'=>$error],400);
        $template=DB::transaction(function()use($data){
            if($data['isDefault']??false)QcReportTemplate::where('test_type',$data['testType'])->update(['is_default'=>false]);
            return QcReportTemplate::create(['test_type'=>$data['testType'],'name'=>trim($data['name']),'description'=>$data['description']??null,'is_default'=>$data['isDefault']??false,'version'=>1,'design'=>$data['design'],'history'=>[]]);
        });
        return response()->json($this->templateJson($template),201);
    }

    public function updateTemplate(Request $request,int $id):JsonResponse
    {
        $this->ensureDefaultLayouts();
        $row=QcReportTemplate::find($id);if(!$row)return response()->json(['error'=>'Report template not found'],404);
        $data=$request->validate(['name'=>['sometimes','string','min:1','max:160'],'description'=>['sometimes','nullable','string','max:1000'],'design'=>['sometimes','array']]);
        if(isset($data['design'])&&($error=$this->designError($data['design'])))return response()->json(['error'=>$error],400);
        if(isset($data['name']))$row->name=trim($data['name']);
        if(array_key_exists('description',$data))$row->description=$data['description'];
        if(isset($data['design'])){
            $history=$row->history??[];$history[]=['version'=>$row->version,'design'=>$row->design,'createdAt'=>$row->updated_at?->toISOString()];
            $row->history=$history;$row->design=$data['design'];$row->version++;
        }
        $row->save();return response()->json($this->templateJson($row));
    }

    public function deleteTemplate(int $id):JsonResponse
    {
        $row=QcReportTemplate::find($id);if(!$row)return response()->json(['error'=>'Report template not found'],404);
        if(QcReportTemplate::where('test_type',$row->test_type)->count()<=1)return response()->json(['error'=>'The only template for a report type cannot be deleted.'],400);
        if($row->is_default)return response()->json(['error'=>'The default template cannot be deleted.'],409);
        $row->delete();return response()->json(null,204);
    }

    public function duplicateTemplate(Request $request,int $id):JsonResponse
    {
        $this->ensureDefaultLayouts();
        $row=QcReportTemplate::find($id);if(!$row)return response()->json(['error'=>'Report template not found'],404);
        $data=$request->validate(['name'=>['sometimes','string','max:160'],'description'=>['sometimes','nullable','string','max:1000'],'design'=>['sometimes','array']]);
        $design=$data['design']??$row->design;if($error=$this->designError($design))return response()->json(['error'=>$error],400);
        $copy=QcReportTemplate::create(['test_type'=>$row->test_type,'name'=>trim($data['name']??"{$row->name} copy")?: "{$row->name} copy",'description'=>array_key_exists('description',$data)?$data['description']:$row->description,'is_default'=>false,'version'=>1,'design'=>$design,'history'=>[]]);
        return response()->json($this->templateJson($copy),201);
    }

    public function setDefault(int $id):JsonResponse
    {
        $row=QcReportTemplate::find($id);if(!$row)return response()->json(['error'=>'Report template not found'],404);
        DB::transaction(function () use ($row): void {
            QcReportTemplate::where('test_type',$row->test_type)->update(['is_default'=>false]);
            $row->is_default=true;
            $row->save();
        });
        return response()->json($this->templateJson($row));
    }

    public function versions(int $id):JsonResponse
    {
        $row=QcReportTemplate::find($id);if(!$row)return response()->json(['error'=>'Report template not found'],404);
        return response()->json(array_values(array_map(fn($entry)=>['version'=>(int)($entry['version']??0),'createdAt'=>$entry['createdAt']??null],$row->history??[])));
    }

    public function restore(int $id,int $version):JsonResponse
    {
        $row=QcReportTemplate::find($id);if(!$row)return response()->json(['error'=>'Report template not found'],404);
        $target=collect($row->history??[])->firstWhere('version',$version);
        if(!$target||!is_array($target['design']??null))return response()->json(['error'=>'Report template version not found'],404);
        if($error=$this->designError($target['design']))return response()->json(['error'=>$error],400);
        $history=$row->history??[];$history[]=['version'=>$row->version,'design'=>$row->design,'createdAt'=>$row->updated_at?->toISOString()];
        $row->history=$history;$row->design=$target['design'];$row->version++;$row->save();
        return response()->json($this->templateJson($row));
    }

    public function ensureDefaultLayouts():void
    {
        foreach(self::TYPES as $type)QcReportLayout::firstOrCreate(['test_type'=>$type],['name'=>"{$type} report",'config'=>$this->defaultLayout($type)]);
        foreach(QcReportLayout::all() as $layout){
            if(QcReportTemplate::where('test_type',$layout->test_type)->exists())continue;
            QcReportTemplate::create(['test_type'=>$layout->test_type,'name'=>'Default','is_default'=>true,'version'=>1,'design'=>['schemaVersion'=>1,'layout'=>$layout->config,'page'=>['pageSize'=>'A4','orientation'=>'portrait','widthMm'=>210,'heightMm'=>297,'marginTopMm'=>14,'marginRightMm'=>14,'marginBottomMm'=>14,'marginLeftMm'=>14,'showHeader'=>true,'showFooter'=>true,'headerHeightMm'=>24,'footerHeightMm'=>18],'objects'=>[]],'history'=>[]]);
        }
    }

    private function ensureLayouts():void { $this->ensureDefaultLayouts(); }

    private function defaultLayout(string $type):array
    {
        $definitions = [
            'Ready Mix' => ['Readymix Cube Test Report', 'readyMixResults', [
                ['testingDate','Testing Date',18],['age','Cube Age',12],['weight','Cube Weight (g)',16],['load','Load (kN)',16],['strength','Strength (N/mm²)',19],['absorption','Water Absorption (%)',19],
            ]],
            'Blocks' => ['Block Compression Test', 'blockCompression', [
                ['no','No.',7],['length','Length (mm)',10],['width','Width (mm)',10],['height','Height (mm)',10],['load','Load (kN)',10],['water','Water (N/mm2)',12],['airDry','Air Dry (N/mm2)',12],['normalized','Normalized (N/mm2)',13],['density','Density (kg/m3)',13],['wetWeight','Wet Weight (kg)',13],
            ]],
            'Paving Blocks' => ['Paving Block Test Report', 'pavingResults', [
                ['no','No.',7],['age','Test Age',9],['length','Length (mm)',10],['width','Width (mm)',10],['height','Height (mm)',10],['dryWeight','Dry Weight',10],['wetWeight','Wet Weight',10],['load','Load (kN)',10],['strength','Calculated Strength',14],
            ]],
            'Sand Sieve' => ['Sand Sieve Test Report', 'sieveResults', [
                ['no','No.',6],['size','Sieve / Pore Size',17],['returned','Mass Retained (g)',13],['retained','Retained (%)',9],['passing','Amount Passing (g)',11],['percentage','Passing (%)',8],['lower','Lower Limit',12],['upper','Upper Limit',12],['remarks','Remarks',18],
            ]],
            'Aggregate Sieve' => ['Aggregate Sieve Test Report', 'sieveResults', [
                ['no','No.',6],['size','Sieve / Pore Size',17],['returned','Mass Retained (g)',13],['retained','Retained (%)',9],['passing','Amount Passing (g)',11],['percentage','Passing (%)',8],['lower','Lower Limit',12],['upper','Upper Limit',12],['remarks','Remarks',18],
            ]],
            'Water' => ['Water Test Report', 'waterDetails', [
                ['source','Source',20],['ph','pH',20],['tds','TDS',20],['chloride','Chloride',20],['sulphate','Sulphate',20],
            ]],
            'Flakiness & Elongation' => ['Flakiness & Elongation Test Report', 'flakinessDetails', [
                ['observation1','Observation 1',50],['observation2','Observation 2',50],
            ]],
            'RMX Trial' => ['RMX Trial Report', 'rmxTrialDetails', [
                ['observation1','Observation 1',50],['observation2','Observation 2',50],
            ]],
            'Precast' => ['Precast Test Report', 'precastDetails', [
                ['sampleDate','Casting Date',14],['sampleNo','Sample No.',14],['precastMouldNo','Precast Mould No.',14],['jobNo','Job No.',12],['customerName','Customer Name',18],['material','Product Type',12],['cubeSize','Cube Size (mm)',14],['location','Testing Location',16],['compactionType','Compaction',16],['testedBy','Tested By',14],
            ]],
            'Kerb Stone' => ['Kerb Stone Test Report', 'kerbStoneDetails', [
                ['testingDate','Testing Date',20],['age','Age (days)',16],['kerbType','Kerb Type',20],['averageStrength','Avg. Strength',16],['minimumStrength','Min. Strength',14],['maximumStrength','Max. Strength',14],
            ]],
        ];
        [$title,$group,$columns] = $definitions[$type] ?? $definitions['Water'];
        $labelledSections = [
            ['header','Header'],['standard','Standard'],['results','Results'],['remarks','Remarks'],['signatures','Signatures'],
        ];
        if ($type === 'Blocks') array_splice($labelledSections, 2, 0, [['context','Block details']]);
        $sections = [];
        foreach ($labelledSections as $order => [$key,$label]) $sections[] = ['key'=>$key,'label'=>$label,'visible'=>true,'order'=>$order];
        $columnRows = [];
        foreach ($columns as $order => [$key,$label,$width]) $columnRows[] = ['key'=>$key,'label'=>$label,'visible'=>true,'order'=>$order,'width'=>$width];
        return [
            'title'=>$title,'fontFamily'=>'Arial','fontSize'=>11,'textColor'=>'#1f2937','accentColor'=>'#be0055',
            'paperPadding'=>14,'sections'=>$sections,'columns'=>[$group=>$columnRows],
        ];
    }

    private function layoutError(array $config):?string
    {
        if (! is_string($config['title'] ?? null) || trim($config['title']) === '') return 'A report title is required.';
        if (! in_array($config['fontFamily'] ?? null, ['Arial','Calibri','Times New Roman','Helvetica'], true)) return 'Invalid report font family.';
        if(isset($config['fontSize'])&&(!is_numeric($config['fontSize'])||$config['fontSize']<8||$config['fontSize']>24))return 'Report font size must be between 8 and 24.';
        if (! isset($config['fontSize']) || ! is_numeric($config['fontSize'])) return 'Report font size must be between 8 and 24.';
        foreach(['textColor','accentColor'] as $key)if(isset($config[$key])&&!preg_match('/^#[0-9a-fA-F]{6}$/',$config[$key]))return "Invalid {$key}.";
        foreach(['textColor','accentColor'] as $key)if(!isset($config[$key]))return "Invalid {$key}.";
        if(isset($config['paperPadding'])&&(!is_numeric($config['paperPadding'])||$config['paperPadding']<5||$config['paperPadding']>30))return 'Report paper padding must be between 5 and 30.';
        if (! isset($config['paperPadding']) || ! is_numeric($config['paperPadding'])) return 'Report paper padding must be between 5 and 30.';
        if (! is_array($config['sections'] ?? null) || ! is_array($config['columns'] ?? null)) return 'Report sections and columns are required.';
        $fonts = ['Arial','Calibri','Times New Roman','Helvetica'];
        foreach ($config['sections'] as $section) {
            if (!is_array($section) || !is_string($section['key']??null) || trim($section['key'])==='' || !is_string($section['label']??null) || trim($section['label'])==='' || !is_bool($section['visible']??null) || !is_numeric($section['order']??null) || $section['order']<0) return 'Invalid report section.';
            if (isset($section['fontFamily']) && !in_array($section['fontFamily'],$fonts,true)) return 'Invalid report section font.';
            if (isset($section['fontSize']) && (!is_numeric($section['fontSize'])||$section['fontSize']<8||$section['fontSize']>24)) return 'Invalid report section font size.';
            foreach(['textColor','backgroundColor','borderColor'] as $key) if(isset($section[$key])&&!preg_match('/^#[0-9a-fA-F]{6}$/',(string)$section[$key])) return "Invalid report section {$key}.";
            if (isset($section['bold'])&&!is_bool($section['bold'])) return 'Invalid report section bold flag.';
            if (isset($section['borderStyle'])&&!in_array($section['borderStyle'],['none','solid','dashed','dotted'],true)) return 'Invalid report section border style.';
            if (isset($section['borderWidth'])&&(!is_numeric($section['borderWidth'])||$section['borderWidth']<0||$section['borderWidth']>4)) return 'Invalid report section border width.';
        }
        foreach ($config['columns'] as $group => $columns) {
            if (!is_string($group) || !is_array($columns)) return 'Report table columns are not allowed.';
            foreach ($columns as $column) if (!is_array($column) || !is_string($column['key']??null) || trim($column['key'])==='' || !is_string($column['label']??null) || trim($column['label'])==='' || !is_bool($column['visible']??null) || !is_numeric($column['order']??null) || $column['order']<0 || !is_numeric($column['width']??null) || $column['width']<1 || $column['width']>100) return 'Invalid report table column.';
        }
        if (isset($config['elements'])) {
            if (!is_array($config['elements']) || count($config['elements'])>40) return 'Invalid report layout elements.';
            foreach ($config['elements'] as $element) {
                if (!is_array($element) || !is_string($element['key']??null) || trim($element['key'])==='' || mb_strlen($element['key'])>80 || !in_array($element['type']??null,['text','divider'],true) || !is_string($element['sectionKey']??null) || trim($element['sectionKey'])==='' || mb_strlen($element['sectionKey'])>80 || !in_array($element['placement']??null,['before','after'],true) || !is_numeric($element['order']??null) || $element['order']<0) return 'Invalid report layout element.';
                if (isset($element['content']) && (!is_string($element['content'])||mb_strlen($element['content'])>500)) return 'Invalid report layout element content.';
                if (isset($element['fontFamily'])&&!in_array($element['fontFamily'],$fonts,true)) return 'Invalid report layout element font.';
                if (isset($element['fontSize'])&&(!is_numeric($element['fontSize'])||$element['fontSize']<8||$element['fontSize']>24)) return 'Invalid report layout element font size.';
                if (isset($element['color'])&&!preg_match('/^#[0-9a-fA-F]{6}$/',(string)$element['color'])) return 'Invalid report layout element color.';
                if (isset($element['bold'])&&!is_bool($element['bold'])) return 'Invalid report layout element bold flag.';
                if (isset($element['width'])&&(!is_numeric($element['width'])||$element['width']<10||$element['width']>100)) return 'Invalid report layout element width.';
                if (isset($element['lineStyle'])&&!in_array($element['lineStyle'],['solid','dashed','dotted'],true)) return 'Invalid report layout element line style.';
            }
        }
        return null;
    }

    private function designError(array $design):?string
    {
        if(!in_array($design['schemaVersion']??null,[1,2],true)||!is_array($design['objects']??null)||!is_array($design['layout']??null)||!is_array($design['layout']['columns']??null))return 'Unsupported report template design.';
        if ($error = $this->layoutError($design['layout'])) return $error;
        if(count($design['objects'])>200)return 'A report template can contain at most 200 objects.';
        $fieldKeys = ['REPORT_TITLE','REPORT_NUMBER','REPORT_DATE','SAMPLE_DATE','SUPPLIER','SAMPLE_DESCRIPTION','PROJECT','TEST_METHOD','TEST_RESULT','SIEVE_SIZE','AMOUNT_RETAINED','AMOUNT_PASSING','PERCENT_PASSING','RETAINED_PERCENT','LOWER_LIMIT','UPPER_LIMIT','REMARKS','COMPANY_NAME','SAMPLE_NUMBER','MATERIAL','LOCATION','TESTED_BY','REVIEWED_BY','record.recordNo','record.sampleDate','record.location','record.material','record.status','record.testedBy','record.reviewedBy','record.createdAt','report.title'];
        foreach (['customerName','customerLocation','projectName','otherDetails','castedBy','sampleNumber','slump','temperature','compactionType','testingDate','age','weight','load','strength','absorption','blockSize','blockAge','machine','sampleType','conditioningMethod','preparationMethod','shapeFactor','blockType','no','length','width','height','water','airDry','normalized','density','wetWeight','pavingBlockSize','correctionFactor','dryWeight','waterAbsorption','size','returned','retained','passing','percentage','lower','upper','remarks','sampleAge','supplier','materialCondition','siltBefore','siltAfter','silverNitrateContent','firstChlorideTitrationPoint','secondChlorideTitrationPoint','crucibleWeight','crucibleAshWeight','source','ph','tds','chloride','sulphate','sampleDate','location','material','testedBy','observation1','observation2','sampleNo','precastMouldNo','jobNo','cubeSize','averageStrength1Day','averageStrength7Days','averageStrength28Days','kerbType','averageStrength','minimumStrength','maximumStrength'] as $key) $fieldKeys[] = "details.{$key}";
        $tableKeys = ['readyMixDetails','readyMixResults','blockDetails','blockCompression','pavingDetails','pavingResults','sieveSampleDetails','sieveResults','sieveChemicalDetails','waterDetails','genericContext','flakinessDetails','rmxTrialDetails','precastDetails','precastResults','kerbStoneDetails'];
        $columnKeys = ['customerName','customerLocation','projectName','otherDetails','castedBy','sampleNumber','slump','temperature','compactionType','testingDate','age','weight','load','strength','absorption','blockSize','blockAge','machine','sampleType','conditioningMethod','preparationMethod','shapeFactor','blockType','no','length','width','height','water','airDry','normalized','density','wetWeight','pavingBlockSize','correctionFactor','dryWeight','waterAbsorption','size','returned','retained','passing','percentage','lower','upper','remarks','sampleAge','supplier','materialCondition','siltBefore','siltAfter','silverNitrateContent','firstChlorideTitrationPoint','secondChlorideTitrationPoint','crucibleWeight','crucibleAshWeight','source','ph','tds','chloride','sulphate','sampleDate','location','material','testedBy','observation1','observation2','sampleNo','precastMouldNo','jobNo','cubeSize','averageStrength1Day','averageStrength7Days','averageStrength28Days','kerbType','averageStrength','minimumStrength','maximumStrength'];
        $ids=[]; $objectsById=[];
        foreach($design['objects'] as $object){
            if(!is_array($object)||!is_string($object['id']??null)||trim($object['id'])===''||in_array($object['id'],$ids,true))return 'Report template object IDs must be unique.';
            $ids[]=$object['id'];
            $objectsById[$object['id']]=$object;
            if(in_array($object['type']??null,['dynamicField','tableCell'],true)&&isset($object['fieldKey'])&&!in_array($object['fieldKey'],$fieldKeys,true))return 'Dynamic field is not allowed.';
            if(($object['type']??null)==='dynamicField'&&!in_array($object['fieldKey']??null,$fieldKeys,true))return 'Dynamic field is not allowed.';
            if(($object['type']??null)==='table'&&!in_array($object['tableKey']??null,$tableKeys,true))return 'Report table is not allowed.';
            if(($object['type']??null)==='image'&&(!is_string($object['objectPath']??null)||!preg_match('#^/objects/uploads/[A-Za-z0-9._/-]+$#',$object['objectPath'])||str_contains($object['objectPath'],'..')))return 'Image objects must reference a private uploaded object.';
            if(isset($object['content'])&&is_string($object['content'])){
                if(preg_match('/\{\{(?![A-Za-z_][A-Za-z0-9_.]*\}\})/',$object['content']))return 'Template text contains an invalid dynamic field.';
                preg_match_all('/\{\{([A-Za-z_][A-Za-z0-9_.]*)\}\}/',$object['content'],$matches);
                if(count(array_diff($matches[1],$fieldKeys)))return 'Template text contains an unknown dynamic field.';
            }
            if(isset($object['formula'])&&is_string($object['formula'])){
                preg_match_all('/\{\{([A-Za-z_][A-Za-z0-9_.]*)\}\}/',$object['formula'],$matches);
                if(count(array_diff($matches[1],$fieldKeys)))return 'Formula contains an unknown dynamic field.';
                if(preg_match('/[^\w\s.,+\-*\/%()={}]/',$object['formula'])||preg_match('/\{\{(?![A-Za-z_][A-Za-z0-9_.]*\}\})/',$object['formula'])||substr_count($object['formula'],'(')!==substr_count($object['formula'],')'))return 'Formula contains unsupported syntax.';
                preg_match_all('/\b([A-Za-z]+)\s*\(/',$object['formula'],$functions);
                if(count(array_diff(array_map('strtoupper',$functions[1]),['SUM','AVERAGE','MIN','MAX','ROUND','ABS'])))return 'Formula contains unsupported syntax.';
            }
        }
        foreach ($objectsById as $item) {
            if (!array_key_exists('parentId',$item)) continue;
            $parentId=$item['parentId'];
            if (!is_string($parentId)||!isset($objectsById[$parentId])||$parentId===$item['id']) return 'Report template object parent is invalid.';
            $parent=$objectsById[$parentId];
            $validParent=($item['type']??null)==='tableRow'
                ? ($parent['type']??null)==='table'
                : (($item['type']??null)==='tableCell'
                    ? ($parent['type']??null)==='tableRow'
                    : (($item['type']??null)==='section'
                        ? false
                        : (($item['type']??null)==='table'
                            ? in_array($parent['type']??null,['section','group'],true)
                            : in_array($parent['type']??null,['section','group'],true))));
            if (!$validParent) return 'Report template object parent type is invalid.';
            $visited=[$item['id']=>true]; $current=$parent;
            while (true) {
                $currentId=$current['id']??null;
                if (!is_string($currentId)||isset($visited[$currentId])) return 'Report template object hierarchy contains a cycle.';
                $visited[$currentId]=true;
                $next=$current['parentId']??null;
                if (!is_string($next)) break;
                if (!isset($objectsById[$next])) return 'Report template object parent is invalid.';
                $current=$objectsById[$next];
            }
            if (($item['type']??null)==='tableCell'&&isset($item['columnIndex'])&&(!is_numeric($item['columnIndex'])||(float)$item['columnIndex']<0||(float)$item['columnIndex']>100||(float)$item['columnIndex']!==floor((float)$item['columnIndex']))) return 'Table cell column index is invalid.';
        }
        $columnKeys=array_values(array_map(fn ($key)=>substr($key,8),array_filter($fieldKeys,fn ($key)=>str_starts_with($key,'details.'))));
        foreach($design['layout']['columns'] as $group=>$columns){if(!in_array($group,$tableKeys,true))return 'Report table columns are not allowed.';foreach($columns as $column)if(!in_array($column['key']??null,$columnKeys,true))return 'Report table field is not allowed.';}
        return null;
    }

    private function templateJson($row):array{return ['id'=>$row->id,'testType'=>$row->test_type,'name'=>$row->name,'description'=>$row->description,'isDefault'=>$row->is_default,'version'=>$row->version,'design'=>$row->design,'createdAt'=>$row->created_at?->toISOString(),'updatedAt'=>$row->updated_at?->toISOString()];}
}

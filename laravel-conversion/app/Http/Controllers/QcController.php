<?php

namespace App\Http\Controllers;

use App\Models\QcRecord;
use App\Models\QcReportLayout;
use App\Models\QcShapeFactor;
use App\Models\QcSieveStandard;
use App\Models\QcStrengthStandard;
use App\Models\QcWaterStandard;
use App\Models\EmployeeActivityEvent;
use App\Services\QcCalculationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class QcController extends Controller
{
    private const TYPES = ['Ready Mix', 'Blocks', 'Paving Blocks', 'Sand Sieve', 'Aggregate Sieve', 'Water', 'Flakiness & Elongation', 'RMX Trial', 'Precast', 'Kerb Stone'];
    private const STATUSES = ['Passed', 'Review', 'Failed', 'Waiting for results'];

    public function dashboard(Request $request, \App\Services\QcDefaultDataService $defaults): JsonResponse
    {
        $defaults->ensureStrengthStandards();
        $month = $request->query('month');
        if ($month !== null && ! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $month)) {
            return response()->json(['error' => 'month must use YYYY-MM format'], 400);
        }
        $base = QcRecord::query();
        $currentMonthStart = CarbonImmutable::parse(($month ?? now()->format('Y-m')).'-01')->startOfMonth();
        $currentMonthEnd = $currentMonthStart->addMonth();
        $records = (clone $base)->get();
        $monthly = $records->filter(fn ($record) => $record->sample_date->toDateString() >= $currentMonthStart->toDateString() && $record->sample_date->toDateString() < $currentMonthEnd->toDateString());
        $byType = $records->groupBy('test_type')->map(fn ($group, $testType) => ['testType' => $testType, 'count' => $group->count()])->values()->sortByDesc('count')->values();
        return response()->json([
            'totalRecords' => $records->count(),
            'passedRecords' => $records->where('status', 'Passed')->count(),
            'reviewRecords' => $records->where('status', 'Review')->count(),
            'failedRecords' => $records->where('status', 'Failed')->count(),
            'recordsThisMonth' => $monthly->count(),
            'passedRecordsThisMonth' => $monthly->where('status', 'Passed')->count(),
            'reviewRecordsThisMonth' => $monthly->where('status', 'Review')->count(),
            'failedRecordsThisMonth' => $monthly->where('status', 'Failed')->count(),
            // Complaint records are migrated in the separate complaints conversion.
            'totalComplaints' => 0, 'solvedComplaints' => 0, 'openComplaints' => 0,
            'byType' => $byType,
            'recentRecords' => $this->serializeRecords($base->latest('created_at')->limit(6)->get()),
        ]);
    }

    public function index(Request $request, \App\Services\QcDefaultDataService $defaults): JsonResponse
    {
        $defaults->ensureStrengthStandards();
        $validated = $request->validate([
            'testType' => ['sometimes', Rule::in(self::TYPES)],
            'search' => ['sometimes', 'string'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ]);
        if (! isset($validated['testType']) || $validated['testType'] === 'Water') app(\App\Services\QcDefaultDataService::class)->ensureWaterStandard();
        $query = QcRecord::query();
        if (isset($validated['testType'])) $query->where('test_type', $validated['testType']);
        if (! empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(fn ($q) => $q->where('record_no', 'ilike', "%{$search}%")
                ->orWhere('location', 'ilike', "%{$search}%")
                ->orWhere('material', 'ilike', "%{$search}%")
                ->orWhere('tested_by', 'ilike', "%{$search}%")
                ->orWhereRaw('details::text ilike ?', ["%{$search}%"]));
        }
        $records = $query->orderByDesc('sample_date')->orderByDesc('id')->limit($validated['limit'] ?? 50)->get();
        return response()->json($this->serializeRecords($records));
    }

    public function show(int $id, \App\Services\QcDefaultDataService $defaults): JsonResponse
    {
        $defaults->ensureStrengthStandards();
        $record = QcRecord::find($id);
        return $record ? response()->json($this->serializeRecord($record)) : response()->json(['error' => 'Record not found'], 404);
    }

    public function store(Request $request, QcCalculationService $calculator): JsonResponse
    {
        $data = $request->validate([
            'testType' => ['required', Rule::in(self::TYPES)], 'sampleDate' => ['required', 'date'],
            'location' => ['required', 'string', 'min:1'], 'material' => ['required', 'string', 'min:1'],
            'status' => ['required', Rule::in(self::STATUSES)], 'testedBy' => ['required', 'string', 'min:1'],
            'reviewedBy' => ['nullable', 'string'], 'remarks' => ['nullable', 'string'], 'details' => ['required', 'array'],
        ]);
        $details = $data['details'];
        $dateResult = $this->deriveTestingDate($data['testType'], $data['sampleDate'], $details);
        if ($dateResult['error']) return response()->json(['error' => $dateResult['error']], 400);
        $details = $dateResult['details'];
        if (array_key_exists('reviewedBy', $data) && ! $this->isAdministrator($request)) return response()->json(['error' => 'Only administrators can set Approved By.'], 403);
        $evaluated = $this->evaluate($calculator, $data['testType'], $data['material'], $data['location'], $details);
        $record = QcRecord::create([
            'record_no' => $this->nextRecordNumber($data['testType']), 'test_type' => $data['testType'],
            'sample_date' => CarbonImmutable::parse($data['sampleDate'])->toDateString(), 'location' => $data['location'],
            'material' => $data['material'], 'status' => $evaluated['status'] ?? $data['status'],
            'tested_by' => $data['testedBy'], 'reviewed_by' => $data['reviewedBy'] ?? null,
            'remarks' => $data['remarks'] ?? null, 'details' => $evaluated['details'],
        ]);
        return response()->json($this->serializeRecord($record), 201);
    }

    public function update(Request $request, int $id, QcCalculationService $calculator): JsonResponse
    {
        $record = QcRecord::find($id);
        if (! $record) return response()->json(['error' => 'Record not found'], 404);
        $data = $request->validate([
            'testType' => ['sometimes', Rule::in(self::TYPES)], 'sampleDate' => ['sometimes', 'date'],
            'location' => ['sometimes', 'string', 'min:1'], 'material' => ['sometimes', 'string', 'min:1'],
            'status' => ['sometimes', Rule::in(self::STATUSES)], 'testedBy' => ['sometimes', 'string', 'min:1'],
            'reviewedBy' => ['sometimes', 'nullable', 'string'], 'remarks' => ['sometimes', 'nullable', 'string'],
            'details' => ['sometimes', 'array'],
        ]);
        $testType = $data['testType'] ?? $record->test_type;
        $sampleDate = isset($data['sampleDate']) ? CarbonImmutable::parse($data['sampleDate'])->toDateString() : $record->sample_date->toDateString();
        $details = $data['details'] ?? $record->details;
        $dateResult = $this->deriveTestingDate($testType, $sampleDate, $details);
        if ($dateResult['error'] && (isset($data['details']) || isset($data['sampleDate']) || isset($data['testType']))) return response()->json(['error' => $dateResult['error']], 400);
        $details = $dateResult['details'];
        if (array_key_exists('reviewedBy', $data) && ! $this->isAdministrator($request)) return response()->json(['error' => 'Only administrators can set Approved By.'], 403);
        $material = $data['material'] ?? $record->material;
        $location = $data['location'] ?? $record->location;
        $evaluated = $this->evaluate($calculator, $testType, $material, $location, $details);
        $record->fill([
            'test_type' => $testType, 'sample_date' => $sampleDate, 'location' => $location,
            'material' => $material, 'status' => $evaluated['status'] ?? ($data['status'] ?? $record->status),
            'tested_by' => $data['testedBy'] ?? $record->tested_by,
            'reviewed_by' => array_key_exists('reviewedBy', $data) ? $data['reviewedBy'] : $record->reviewed_by,
            'remarks' => array_key_exists('remarks', $data) ? $data['remarks'] : $record->remarks,
            'details' => $evaluated['details'],
        ]);
        $record->save();
        return response()->json($this->serializeRecord($record));
    }

    public function destroy(int $id): JsonResponse
    {
        $record = QcRecord::find($id);
        if (! $record) return response()->json(['error' => 'Record not found'], 404);
        $record->delete();
        return response()->json(null, 204);
    }

    public function report(int $id, QcCalculationService $calculator): JsonResponse
    {
        app(\App\Services\QcDefaultDataService::class)->ensureStrengthStandards();
        app(QcReportController::class)->ensureDefaultLayouts();
        $record = QcRecord::find($id);
        if (! $record) return response()->json(['error' => 'Record not found'], 404);
        $evaluated = $this->evaluate($calculator, $record->test_type, $record->material, $record->location, $record->details ?? []);
        $layout = QcReportLayout::where('test_type', $record->test_type)->first();
        if (! $layout) return response()->json(['error' => 'Report layout could not be initialized.'], 500);
        return response()->json([
            'record' => $this->serializeRecord($record, $evaluated),
            'companyName' => 'AL MANARATAIN',
            'companySubtitle' => 'Al Manaratain Company & Ali Shaab Group W.L.L',
            'layout' => ['id' => $layout->id, 'testType' => $record->test_type, 'name' => $layout->name, 'config' => $layout->config],
        ]);
    }

    public function previewAgeBackfill(): JsonResponse
    {
        $eligible = []; $manual = [];
        foreach (QcRecord::whereIn('test_type', ['Blocks', 'Paving Blocks', 'Sand Sieve', 'Aggregate Sieve'])->orderBy('sample_date')->orderBy('id')->get() as $record) {
            $details = $record->details ?? [];
            $key = in_array($record->test_type, ['Blocks', 'Paving Blocks'], true) ? 'blockAge' : 'sampleAge';
            $sampleDate = $record->sample_date->toDateString();
            $testingDate = is_string($details['testingDate'] ?? null) ? $details['testingDate'] : null;
            $ageText = trim((string) ($details[$key] ?? ''));
            $issue = fn (string $reason) => ['id' => $record->id, 'recordNo' => $record->record_no, 'testType' => $record->test_type, 'sampleDate' => $sampleDate, 'testingDate' => $testingDate, 'reason' => $reason];
            $rowAgesMatch = function (int $age) use ($details): bool {
                foreach (is_array($details['testRows'] ?? null) ? $details['testRows'] : [] as $row) {
                    if (! is_array($row) || ! array_key_exists('sampleAge', $row) || trim((string) $row['sampleAge']) === '') continue;
                    if (! preg_match('/^\d+$/', trim((string) $row['sampleAge'])) || (int) $row['sampleAge'] !== $age) return false;
                }
                return true;
            };
            if ($ageText !== '') {
                $savedAge = preg_match('/^\d+$/', $ageText) ? (int) $ageText : null;
                $matches = $savedAge !== null && $testingDate !== null
                    && preg_match('/^\d{4}-\d{2}-\d{2}$/', $testingDate)
                    && CarbonImmutable::canBeCreatedFromFormat($testingDate, 'Y-m-d')
                    && CarbonImmutable::parse($sampleDate)->addDays($savedAge)->toDateString() === $testingDate
                    && $rowAgesMatch($savedAge);
                if (! $matches) $manual[] = $issue('An age is already saved, but it is invalid or does not match the saved Testing Date.');
                continue;
            }
            if (! $testingDate || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $testingDate) || ! CarbonImmutable::canBeCreatedFromFormat($testingDate, 'Y-m-d')) {
                $manual[] = $issue('Sample Date or saved Testing Date is missing or invalid.');
                continue;
            }
            $testing = CarbonImmutable::parse($testingDate);
            if ($testing->lt(CarbonImmutable::parse($sampleDate))) {
                $manual[] = $issue('Testing Date is earlier than Sample Date or the date interval is invalid.');
                continue;
            }
            $age = (int) CarbonImmutable::parse($sampleDate)->diffInDays($testing);
            if (! $rowAgesMatch($age)) {
                $manual[] = $issue('Test rows contain age values that conflict with the date interval.');
                continue;
            }
            if (CarbonImmutable::parse($sampleDate)->addDays($age)->toDateString() !== $testingDate) {
                $manual[] = $issue('The derived age does not reproduce the saved Testing Date.');
                continue;
            }
            $eligible[] = ['id' => $record->id, 'recordNo' => $record->record_no, 'testType' => $record->test_type, 'sampleDate' => $sampleDate, 'testingDate' => $testingDate, 'age' => $age];
        }
        return response()->json(['eligible' => $eligible, 'manualReview' => $manual]);
    }

    public function applyAgeBackfill(Request $request): JsonResponse
    {
        $data = $request->validate(['candidates' => ['required', 'array', 'min:1'], 'candidates.*.id' => ['required', 'integer', 'min:1'], 'candidates.*.recordNo' => ['required', 'string'], 'candidates.*.testType' => ['required', Rule::in(self::TYPES)], 'candidates.*.sampleDate' => ['required', 'date_format:Y-m-d'], 'candidates.*.testingDate' => ['required', 'date_format:Y-m-d'], 'candidates.*.age' => ['required', 'integer', 'min:0']]);
        $ids = array_column($data['candidates'], 'id');
        if (count(array_unique($ids)) !== count($ids) || collect($data['candidates'])->contains(fn ($candidate) => $candidate['id'] > 9007199254740991 || $candidate['age'] > 9007199254740991)) return response()->json(['error' => 'Candidates must contain unique record IDs and whole-day ages.'], 400);
        $user = $request->user();
        $userId = (string) ($user?->getAuthIdentifier() ?? $user?->id ?? '');
        if (! str_starts_with($userId, 'employee:') || trim(substr($userId, strlen('employee:'))) === '') {
            return response()->json(['error' => 'An employee identity is required to audit historical date corrections.'], 403);
        }
        $employeeId = trim(substr($userId, strlen('employee:')));
        $employeeName = $this->employeeActivityName($user, $employeeId);
        $sessionFingerprint = $request->hasSession()
            ? hash('sha256', $request->session()->getId())
            : null;
        $applied = 0; $skipped = [];
        DB::transaction(function () use ($data, $employeeId, $employeeName, $sessionFingerprint, $request, &$applied, &$skipped): void {
            foreach ($data['candidates'] as $candidate) {
                $record = QcRecord::lockForUpdate()->find($candidate['id']);
                $issue = fn ($reason) => ['id' => $candidate['id'], 'recordNo' => $candidate['recordNo'], 'testType' => $candidate['testType'], 'sampleDate' => $candidate['sampleDate'], 'testingDate' => $candidate['testingDate'], 'reason' => $reason];
                if (! $record) { $skipped[] = $issue('Record no longer exists. Run a new preview before applying.'); continue; }
                $key = in_array($record->test_type, ['Blocks', 'Paving Blocks'], true) ? 'blockAge' : (in_array($record->test_type, ['Sand Sieve', 'Aggregate Sieve'], true) ? 'sampleAge' : null);
                $details = $record->details ?? [];
                $rowAgesMatch = true;
                foreach (is_array($details['testRows'] ?? null) ? $details['testRows'] : [] as $row) {
                    if (! is_array($row) || ! array_key_exists('sampleAge', $row) || trim((string) $row['sampleAge']) === '') continue;
                    if (! preg_match('/^\d+$/', trim((string) $row['sampleAge'])) || (int) $row['sampleAge'] !== (int) $candidate['age']) { $rowAgesMatch = false; break; }
                }
                if (! $key || $record->test_type !== $candidate['testType'] || ! $rowAgesMatch || trim((string) ($details[$key] ?? '')) !== '' || $record->record_no !== $candidate['recordNo'] || $record->sample_date->toDateString() !== $candidate['sampleDate'] || ($details['testingDate'] ?? null) !== $candidate['testingDate'] || $candidate['testingDate'] !== CarbonImmutable::parse($candidate['sampleDate'])->addDays($candidate['age'])->toDateString()) {
                    $skipped[] = $issue('Record changed after preview. Run a new preview before applying.'); continue;
                }
                $oldTestingDate = $details['testingDate'] ?? null;
                $oldAgeValue = $details[$key] ?? null;
                $details[$key] = (string) $candidate['age'];
                $record->details = $details;
                $record->save();
                EmployeeActivityEvent::create([
                    'employee_id' => $employeeId,
                    'employee_name' => $employeeName,
                    'session_fingerprint' => $sessionFingerprint,
                    'action' => 'updated',
                    'entity_type' => 'QC record',
                    'entity_id' => (string) $record->id,
                    'summary' => "Backfilled historical age for QC record #{$record->id} ({$record->record_no})",
                    'details' => [
                        'submitted' => [
                            'operation' => 'historical age backfill',
                            'recordId' => $record->id,
                            'recordNo' => $record->record_no,
                            'testType' => $record->test_type,
                            'sampleDate' => $record->sample_date->toDateString(),
                            'oldTestingDate' => $oldTestingDate,
                            'oldAgeValue' => $oldAgeValue,
                            'newTestingDate' => $details['testingDate'] ?? null,
                            'ageField' => $key,
                            'newAgeValue' => $details[$key],
                        ],
                        'path' => $request->path(),
                    ],
                ]);
                $applied++;
            }
        });
        return response()->json(['applied' => $applied, 'skipped' => $skipped]);
    }

    private function employeeActivityName(?object $user, string $fallback): string
    {
        foreach (['display_name', 'displayName', 'name', 'full_name', 'fullName'] as $key) {
            $value = data_get($user, $key);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        $firstName = trim((string) (data_get($user, 'first_name') ?? data_get($user, 'firstName') ?? ''));
        $lastName = trim((string) (data_get($user, 'last_name') ?? data_get($user, 'lastName') ?? ''));
        return trim($firstName.' '.$lastName) ?: $fallback;
    }

    private function evaluate(QcCalculationService $calculator, string $testType, string $material, string $location, array $details): array
    {
        if ($testType === 'Water') {
            $default = app(\App\Services\QcDefaultDataService::class)->ensureWaterStandard();
            $id = $details['waterStandardId'] ?? null;
            $standard = $id ? QcWaterStandard::find($id) : $default;
            return $calculator->evaluateWater($details, $standard);
        }
        app(\App\Services\QcDefaultDataService::class)->ensureStrengthStandards();
        if (in_array($testType, ['Sand Sieve', 'Aggregate Sieve'], true)) return $this->evaluateSieve($testType, $material, $details);
        return $calculator->evaluateStrength($testType, $material, $location, $details, QcStrengthStandard::orderBy('id')->get(), QcShapeFactor::all());
    }

    private function evaluateSieve(string $testType, string $material, array $details): array
    {
        $sourceRows = is_array($details['sieveRows'] ?? null) ? $details['sieveRows'] : [];
        $calculated = QcCalculationService::sieveRows($sourceRows);
        $rows = $calculated['rows'];
        $sampleWeight = $calculated['sampleWeight'];
        $standards = QcSieveStandard::with(['material', 'sieveSize'])->where('test_type', $testType)->get();
        $materialId = (int) ($details['materialReferenceItemId'] ?? 0);
        $applicable = $standards->filter(fn ($item) => $materialId > 0 ? $item->material_reference_item_id === $materialId : strcasecmp($item->material?->value ?? '', $material) === 0);
        $criteria = []; $bad = false; $incomplete = count($rows) === 0 || $applicable->isEmpty() || $sampleWeight <= 0;
        foreach ($applicable as $standard) {
            $row = collect($rows)->first(fn ($candidate) => is_array($candidate) && ((int) ($candidate['sieveSizeReferenceItemId'] ?? 0) === $standard->sieve_size_reference_item_id || ((int) ($candidate['sieveSizeReferenceItemId'] ?? 0) === 0 && (string) ($candidate['sieveSize'] ?? '') === $standard->sieveSize?->value)));
            $measured = $standard->measurement_type === 'percentage'
                ? QcCalculationService::number($row['passingPercentage'] ?? null)
                : QcCalculationService::number($row['passingAmount'] ?? null);
            $validLimits = ($standard->minimum !== null || $standard->maximum !== null) && ($standard->minimum === null || $standard->maximum === null || $standard->minimum <= $standard->maximum);
            $within = $measured !== null && $validLimits ? (($standard->minimum === null || $measured >= $standard->minimum) && ($standard->maximum === null || $measured <= $standard->maximum)) : null;
            if ($within === false) $bad = true;
            if (! $row || $within === null) $incomplete = true;
            $criteria[] = ['standardId'=>$standard->id,'sieveSize'=>$standard->sieveSize?->value ?? '', 'measurementType'=>$standard->measurement_type,'measuredValue'=>$measured,'minimum'=>$standard->minimum,'maximum'=>$standard->maximum,'unit'=>$standard->unit,'withinLimits'=>$within,'rowNo'=>$row['rowNo'] ?? null];
        }
        $details['sieveRows'] = $rows; $details['sampleWeight'] = $sampleWeight;
        $status = $bad ? 'Failed' : ($incomplete ? 'Review' : 'Passed');
        $details['sieveEvaluation'] = ['type' => 'sieve', 'status' => $status, 'standardReference' => $applicable->pluck('standard_reference')->unique()->implode(', ') ?: null, 'reason' => $incomplete ? ($applicable->isEmpty() ? 'No matching sieve standards were configured for this material.' : 'Complete measurements are required for every configured sieve.') : ($bad ? 'At least one sieve measurement is outside the configured acceptance limit.' : null), 'criteria' => $criteria];
        return ['details' => $details, 'status' => $status];
    }

    private function isAdministrator(Request $request): bool
    {
        $user = $request->user();
        return (bool) ($user?->is_admin ?? $user?->isAdmin ?? false) || strtolower((string) ($user?->role ?? '')) === 'administrator';
    }

    private function deriveTestingDate(string $type, string $sampleDate, array $details): array
    {
        $key = in_array($type, ['Blocks', 'Paving Blocks'], true) ? 'blockAge' : (in_array($type, ['Sand Sieve', 'Aggregate Sieve'], true) ? 'sampleAge' : null);
        if (! $key) return ['details' => $details, 'error' => null];
        $ageText = trim((string) ($details[$key] ?? ''));
        if ($ageText === '' || ! ctype_digit($ageText)) return ['details' => $details, 'error' => 'A valid whole-day age (zero or more) is required.'];
        $testingDate = CarbonImmutable::parse($sampleDate)->addDays((int) $ageText)->toDateString();
        return ['details' => array_merge($details, ['testingDate' => $testingDate]), 'error' => null];
    }

    private function nextRecordNumber(string $type): string
    {
        $prefix = strtoupper(substr(preg_replace('/[^A-Z]/i', '', $type), 0, 3));
        return sprintf('%s-%s-%06d', $prefix, now()->format('Y'), random_int(0, 999999));
    }

    private function serializeRecords($records): array
    {
        return $records->map(fn ($record) => $this->serializeRecord($record))->all();
    }

    private function serializeRecord(QcRecord $record, ?array $evaluation = null): array
    {
        if ($evaluation === null && $record->test_type === 'Kerb Stone') $evaluation = $this->evaluate(app(QcCalculationService::class), $record->test_type, $record->material, $record->location, $record->details ?? []);
        $details = $evaluation['details'] ?? $record->details ?? [];
        return ['id' => $record->id, 'recordNo' => $record->record_no, 'testType' => $record->test_type, 'sampleDate' => $record->sample_date?->toDateString(), 'location' => $record->location, 'material' => $record->material, 'status' => $evaluation['status'] ?? $record->status, 'testedBy' => $record->tested_by, 'createdBy' => null, 'reviewedBy' => $record->reviewed_by, 'remarks' => $record->remarks, 'details' => $details, 'createdAt' => $record->created_at?->toISOString()];
    }

}

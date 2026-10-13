<?php

namespace Tests\Feature;

use App\Models\QcRecord;
use App\Models\QcStrengthStandard;
use App\Models\EmployeeActivityEvent;
use App\Models\EmployeeAccess;
use App\Models\EmployeeDirectoryEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QcApiContractsTest extends TestCase
{
    use RefreshDatabase;

    public function test_reference_and_lookup_responses_keep_the_source_shapes(): void
    {
        $this->asAdministrator();
        $reference = $this->getJson('/api/qc/reference-data')->assertOk()->assertJsonStructure([
            'categories' => [['id', 'key', 'label', 'items' => [['id', 'categoryId', 'value']]]],
        ]);
        self::assertNotContains('factories', array_column($reference->json('categories'), 'key'));
        self::assertNotContains('plants', array_column($reference->json('categories'), 'key'));

        $lookups = $this->getJson('/api/qc/lookups')->assertOk()->assertJsonStructure([
            'factories', 'plants', 'employees', 'suppliers', 'materials', 'locations',
            'blockTypes', 'blockSizes', 'mixStrengths', 'customers', 'customerLocations', 'sieveSizes',
        ]);
        self::assertContains('20 N OPC', $lookups->json('mixStrengths'));
        $plantCategory = collect($reference->json('categories'))->firstWhere('key', 'readyMixPlantLocations');
        self::assertContains('ELBA', array_column($plantCategory['items'], 'value'));
    }

    public function test_default_standards_and_shape_factors_are_reconciled_without_filling_unapproved_shape_values(): void
    {
        $this->asAdministrator();
        $strengths = $this->getJson('/api/qc/strength-standards')->assertOk()->json();
        self::assertCount(28, array_filter($strengths, fn ($row) => $row['testType'] === 'Ready Mix'));
        self::assertContains('Plain Block', array_column(array_filter($strengths, fn ($row) => $row['testType'] === 'Blocks'), 'blockType'));

        $water = $this->getJson('/api/qc/water-standards')->assertOk()->json();
        $default = collect($water)->firstWhere('isDefault', true);
        self::assertSame(4.5, $default['phMin']);
        self::assertSame(400, (int) $default['so3Min']);

        $shapes = $this->getJson('/api/qc/shape-factors')->assertOk()->json();
        self::assertNotEmpty($shapes);
        self::assertNull(collect($shapes)->firstWhere('blockSize', '8"')['shapeFactor']);
    }

    public function test_report_route_returns_a_product_specific_default_print_layout(): void
    {
        $this->asAdministrator();
        $record = $this->postJson('/api/qc/records', [
            'testType' => 'Water', 'sampleDate' => '2026-01-03', 'location' => 'Hidd',
            'material' => 'Water', 'status' => 'Waiting for results', 'testedBy' => 'QC technician',
            'details' => ['ph' => 7, 'chloride' => 100, 'tds' => 1000, 'so3' => 500],
        ])->assertCreated()->assertJsonPath('status', 'Passed');

        $report = $this->getJson('/api/qc/reports/'.$record->json('id'))->assertOk();
        self::assertSame('Water Test Report', $report->json('layout.config.title'));
        self::assertSame('waterDetails', array_key_first($report->json('layout.config.columns')));
    }

    public function test_custom_report_layout_survives_reads_and_is_used_by_print_reports(): void
    {
        $this->asAdministrator();
        $layout = collect($this->getJson('/api/qc/report-layouts')->assertOk()->json())
            ->firstWhere('testType', 'Water');
        self::assertNotNull($layout);
        $config = $layout['config'];
        $config['title'] = 'Water Report — Client Edition';
        $config['accentColor'] = '#176B87';

        $this->patchJson('/api/qc/report-layouts/'.$layout['id'], ['name' => 'Client Water Layout', 'config' => $config])
            ->assertOk()
            ->assertJsonPath('name', 'Client Water Layout')
            ->assertJsonPath('config.title', 'Water Report — Client Edition')
            ->assertJsonPath('config.accentColor', '#176B87');
        $this->getJson('/api/qc/report-layouts')->assertOk()
            ->assertJsonPath('0.testType', 'Aggregate Sieve');
        $reloaded = collect($this->getJson('/api/qc/report-layouts')->assertOk()->json())->firstWhere('id', $layout['id']);
        self::assertSame('Water Report — Client Edition', $reloaded['config']['title']);

        $record = $this->postJson('/api/qc/records', [
            'testType' => 'Water', 'sampleDate' => '2026-05-12', 'location' => 'Hidd',
            'material' => 'Water', 'status' => 'Waiting for results', 'testedBy' => 'QC technician',
            'details' => ['ph' => 7, 'chloride' => 100, 'tds' => 1000, 'so3' => 500],
        ])->assertCreated();
        $this->getJson('/api/qc/reports/'.$record->json('id'))->assertOk()
            ->assertJsonPath('layout.name', 'Client Water Layout')
            ->assertJsonPath('layout.config.title', 'Water Report — Client Edition');
    }

    public function test_custom_report_template_lifecycle_preserves_design_history_and_defaults(): void
    {
        $this->asAdministrator();
        $designV1 = $this->validReportTemplateDesign('Water certificate v1');
        $created = $this->postJson('/api/qc/report-templates', [
            'testType' => 'Water', 'name' => 'Client certificate', 'description' => 'Client print design',
            'isDefault' => false, 'design' => $designV1,
        ])->assertCreated()
            ->assertJsonPath('name', 'Client certificate')
            ->assertJsonPath('version', 1)
            ->assertJsonPath('design.layout.title', 'Water certificate v1');
        $templateId = $created->json('id');

        $duplicate = $this->postJson('/api/qc/report-templates/'.$templateId.'/duplicate', [
            'name' => 'Client certificate copy',
        ])->assertCreated()
            ->assertJsonPath('name', 'Client certificate copy')
            ->assertJsonPath('version', 1)
            ->assertJsonPath('isDefault', false);
        self::assertSame($designV1, $duplicate->json('design'));
        $this->getJson('/api/qc/report-templates/'.$duplicate->json('id').'/versions')
            ->assertOk()->assertExactJson([]);

        $designV2 = $this->validReportTemplateDesign('Water certificate v2');
        $this->patchJson('/api/qc/report-templates/'.$templateId, ['design' => $designV2])
            ->assertOk()
            ->assertJsonPath('version', 2)
            ->assertJsonPath('design.layout.title', 'Water certificate v2');
        $versions = $this->getJson('/api/qc/report-templates/'.$templateId.'/versions')
            ->assertOk()->assertJsonCount(1);
        $versions->assertJsonPath('0.version', 1);
        self::assertIsString($versions->json('0.createdAt'));

        $duplicateId = $duplicate->json('id');
        $this->patchJson('/api/qc/report-templates/'.$duplicateId.'/default', [])
            ->assertOk()->assertJsonPath('isDefault', true);
        $listed = collect($this->getJson('/api/qc/report-templates?testType=Water')->assertOk()->json());
        self::assertTrue($listed->firstWhere('id', $duplicateId)['isDefault']);
        self::assertFalse($listed->firstWhere('id', $templateId)['isDefault']);

        $restored = $this->postJson('/api/qc/report-templates/'.$templateId.'/restore/1', [])
            ->assertOk()
            ->assertJsonPath('version', 3)
            ->assertJsonPath('design.layout.title', 'Water certificate v1');
        self::assertSame($designV1, $restored->json('design'));
        $persisted = collect($this->getJson('/api/qc/report-templates?testType=Water')->assertOk()->json())
            ->firstWhere('id', $templateId);
        self::assertSame($designV1, $persisted['design']);
        $this->getJson('/api/qc/report-templates/'.$templateId.'/versions')
            ->assertOk()->assertJsonCount(2);
        self::assertTrue(collect($this->getJson('/api/qc/report-templates')->assertOk()->json())
            ->firstWhere('id', $duplicateId)['isDefault']);
    }

    public function test_report_template_rejects_unknown_fields_invalid_formulas_and_unsafe_images(): void
    {
        $this->asAdministrator();
        $cases = [
            [
                'design' => array_merge($this->validReportTemplateDesign('Unknown field'), [
                    'objects' => [['id' => 'unknown-field', 'type' => 'dynamicField', 'fieldKey' => 'details.internalSecret']],
                ]),
                'error' => 'Dynamic field is not allowed.',
            ],
            [
                'design' => array_merge($this->validReportTemplateDesign('Invalid formula'), [
                    'objects' => [['id' => 'invalid-formula', 'type' => 'formula', 'formula' => 'window.alert(1)']],
                ]),
                'error' => 'Formula contains unsupported syntax.',
            ],
            [
                'design' => array_merge($this->validReportTemplateDesign('Unsafe image'), [
                    'objects' => [['id' => 'unsafe-image', 'type' => 'image', 'objectPath' => '/objects/uploads/../private/secret.png']],
                ]),
                'error' => 'Image objects must reference a private uploaded object.',
            ],
        ];

        foreach ($cases as $index => $case) {
            $this->postJson('/api/qc/report-templates', [
                'testType' => 'Water', 'name' => 'Invalid design '.$index, 'design' => $case['design'],
            ])->assertBadRequest()->assertJsonPath('error', $case['error']);
        }
    }

    public function test_water_standard_edits_recalculate_existing_water_records(): void
    {
        $this->asAdministrator();
        $record = $this->postJson('/api/qc/records', [
            'testType' => 'Water', 'sampleDate' => '2026-02-10', 'location' => 'Hidd',
            'material' => 'Water', 'status' => 'Waiting for results', 'testedBy' => 'QC technician',
            'details' => ['ph' => 7, 'chloride' => 100, 'tds' => 1000, 'so3' => 500],
        ])->assertCreated()->assertJsonPath('status', 'Passed');
        $default = collect($this->getJson('/api/qc/water-standards')->assertOk()->json())->firstWhere('isDefault', true);

        $this->patchJson('/api/qc/water-standards/'.$default['id'], ['so3Min' => 550])
            ->assertOk()->assertJsonPath('so3Min', 550);
        self::assertSame('Failed', $this->getJson('/api/qc/records/'.$record->json('id'))->assertOk()->json('status'));
    }

    public function test_daily_ready_mix_results_filter_and_summarize_cube_strengths(): void
    {
        $this->asAdministrator();
        $this->makeReadyMixRecord('RMX-DAILY-01', '2026-04-01', 'EASTERN Hidd', 'S-100', '30 N OPC', [
            ['testAge' => 7, 'calculatedStrength' => '30'],
            ['testAge' => 7, 'calculatedStrength' => '34'],
            ['testAge' => 28, 'calculatedStrength' => '40'],
        ]);
        $this->makeReadyMixRecord('RMX-DAILY-02', '2026-04-01', 'EASTERN Aker', 'S-101', '30 N OPC', [
            ['testAge' => 7, 'strength' => 42],
            ['testAge' => 7, 'strength' => 46],
        ]);
        $this->makeReadyMixRecord('RMX-DAILY-03', '2026-04-01', 'Hidd', 'H-200', '30 N OPC', [
            ['testAge' => 7, 'strength' => 60],
        ]);
        $this->makeReadyMixRecord('RMX-DAILY-04', '2026-04-01', 'Hidd', 'S-102', '45 N OPC', [
            ['testAge' => 7, 'strength' => 70],
        ]);

        $url = '/api/qc/daily-ready-mix-results?'.http_build_query([
            'testingDate' => '2026-04-08',
            'referenceType' => 'site',
            'mixDesign' => ' 30 n opc ',
        ]);
        $response = $this->getJson($url)->assertOk();
        $response->assertJsonPath('testingDate', '2026-04-08T00:00:00.000Z')
            ->assertJsonPath('referenceType', 'site')
            ->assertJsonPath('mixDesign', '30 n opc')
            ->assertJsonPath('averageStrength', 38)
            ->assertJsonPath('minimumStrength', 32)
            ->assertJsonPath('maximumStrength', 44)
            ->assertJsonPath('mixes.0.recordCount', 2)
            ->assertJsonPath('mixes.0.averageStrength', 38)
            ->assertJsonPath('mixes.0.sevenDay.averageStrength', 38)
            ->assertJsonPath('locations.0.location', 'EASTERN')
            ->assertJsonPath('locations.0.recordCount', 2)
            ->assertJsonPath('records.0.cubeAge', 7)
            ->assertJsonPath('records.0.sampleDate', '2026-04-01T00:00:00.000Z');

        $empty = $this->getJson('/api/qc/daily-ready-mix-results?'.http_build_query([
            'testingDate' => '2026-04-08', 'referenceType' => 'site', 'mixDesign' => 'no matching design',
        ]))->assertOk();
        $empty->assertJsonPath('records', [])
            ->assertJsonPath('mixes', [])
            ->assertJsonPath('averageStrength', null);

        $this->getJson('/api/qc/daily-ready-mix-results?testingDate=2026-02-30&referenceType=site')
            ->assertBadRequest()
            ->assertJsonPath('error', 'testingDate must be a valid YYYY-MM-DD date');

        $twentyEightDay = $this->getJson('/api/qc/daily-ready-mix-results?'.http_build_query([
            'testingDate' => '2026-04-29', 'referenceType' => 'site', 'mixDesign' => '30 N OPC',
        ]))->assertOk();
        $twentyEightDay->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.cubeAge', 28)
            ->assertJsonPath('records.0.strengths', [40]);
    }

    public function test_kerbstone_strength_refresh_paginates_audits_and_ignores_other_kerb_types(): void
    {
        $this->asAdministrator('employee:321');
        QcStrengthStandard::create([
            'test_type' => 'Kerb Stone', 'material' => 'Kerbstone', 'block_type' => 'Road kerb',
            'bs_standard' => 'BS EN 1340 : 2003', 'required_strength' => 5,
            'minimum_individual_strength' => 4, 'water_absorption_limit' => 6.5,
            'strength_unit' => 'MPa',
        ]);
        QcStrengthStandard::create([
            'test_type' => 'Kerb Stone', 'material' => 'Kerbstone', 'block_type' => 'Edge kerb',
            'bs_standard' => 'BS EN 1340 : 2003', 'required_strength' => 3.5,
            'minimum_individual_strength' => 2.8, 'water_absorption_limit' => 6.5,
            'strength_unit' => 'MPa',
        ]);
        $roadKerb = QcRecord::create([
            'record_no' => 'KERB-REFRESH-01', 'test_type' => 'Kerb Stone', 'sample_date' => '2026-03-01',
            'location' => 'Hidd', 'material' => 'Kerbstone', 'status' => 'Review',
            'tested_by' => 'QC technician', 'details' => [
                'kerbType' => 'Road kerb',
                'strengthEvaluation' => ['status' => 'Failed', 'averageStrength' => 0],
                'testRows' => [[
                    'failureLoad' => 5000, 'spanLength' => 300, 'weight' => 1000, 'wetWeight' => 1040,
                ]],
            ],
        ]);
        $edgeKerb = QcRecord::create([
            'record_no' => 'KERB-REFRESH-02', 'test_type' => 'Kerb Stone', 'sample_date' => '2026-03-01',
            'location' => 'Hidd', 'material' => 'Kerbstone', 'status' => 'Review',
            'tested_by' => 'QC technician', 'details' => [
                'kerbType' => 'Edge kerb', 'testRows' => [[
                    'failureLoad' => 100, 'spanLength' => 300, 'weight' => 1000, 'wetWeight' => 1000,
                ]],
            ],
        ]);
        for ($index = 3; $index <= 251; $index++) {
            QcRecord::create([
                'record_no' => sprintf('KERB-REFRESH-%02d', $index), 'test_type' => 'Kerb Stone',
                'sample_date' => '2026-03-01', 'location' => 'Hidd', 'material' => 'Kerbstone',
                'status' => 'Review', 'tested_by' => 'QC technician',
                'details' => ['kerbType' => 'Decorative kerb', 'testRows' => []],
            ]);
        }

        $firstPage = $this->postJson('/api/qc/records/kerbstone-strength-refresh', ['afterId' => 0])
            ->assertOk()
            ->assertJsonPath('scanned', 250)
            ->assertJsonPath('refreshed', 2)
            ->assertJsonPath('ignored', 248)
            ->assertJsonPath('skipped', 0)
            ->assertJsonPath('hasMore', true)
            ->assertJsonPath('nextAfterId', 250);
        self::assertSame(2, EmployeeActivityEvent::query()->count());
        self::assertSame('Passed', $roadKerb->fresh()->status);
        self::assertNotSame('0', (string) $roadKerb->fresh()->details['testRows'][0]['bendingStrength']);
        self::assertSame('Passed', $edgeKerb->fresh()->status);
        self::assertSame('321', EmployeeActivityEvent::query()->where('entity_id', (string) $roadKerb->id)->sole()->employee_id);
        self::assertSame('historical Kerb Stone strength refresh', EmployeeActivityEvent::query()->where('entity_id', (string) $roadKerb->id)->sole()->details['submitted']['operation']);

        $this->postJson('/api/qc/records/kerbstone-strength-refresh', ['afterId' => $firstPage->json('nextAfterId')])
            ->assertOk()
            ->assertJsonPath('scanned', 1)
            ->assertJsonPath('refreshed', 0)
            ->assertJsonPath('ignored', 1)
            ->assertJsonPath('hasMore', false)
            ->assertJsonPath('nextAfterId', null);
    }

    public function test_kerbstone_strength_refresh_rejects_bad_cursor_and_non_administrators(): void
    {
        $this->asAdministrator();
        $this->postJson('/api/qc/records/kerbstone-strength-refresh', ['afterId' => '2'])
            ->assertBadRequest()
            ->assertJsonPath('error', 'afterId must be a non-negative whole record ID.');

        $this->asAdministrator('employee:222', 'technician');
        $this->postJson('/api/qc/records/kerbstone-strength-refresh', ['afterId' => 0])->assertForbidden();
    }

    public function test_age_backfill_preview_and_apply_require_a_fresh_matching_candidate(): void
    {
        $this->asAdministrator('employee:999');
        self::assertSame('employee:999', $this->app['auth']->user()?->getAuthIdentifier());
        $record = QcRecord::create([
            'record_no' => 'BLK-2026-TEST01', 'test_type' => 'Blocks', 'sample_date' => '2026-01-01',
            'location' => 'Hidd', 'material' => 'Concrete Block', 'status' => 'Review',
            'tested_by' => 'QC technician', 'details' => [
                'blockAge' => '', 'testingDate' => '2026-01-08', 'testRows' => [['sampleAge' => '']],
            ],
        ]);
        $preview = $this->postJson('/api/qc/records/age-backfill/preview', [])->assertOk();
        $candidate = collect($preview->json('eligible'))->firstWhere('id', $record->id);
        self::assertSame(7, $candidate['age']);

        $apply = $this->postJson('/api/qc/records/age-backfill/apply', ['candidates' => [$candidate]]);
        self::assertSame(200, $apply->status(), $apply->getContent());
        $apply->assertJsonPath('applied', 1)->assertJsonPath('skipped', []);
        self::assertSame('7', $record->fresh()->details['blockAge']);

        $event = EmployeeActivityEvent::query()->sole();
        self::assertSame('999', $event->employee_id);
        self::assertSame('999', $event->employee_name);
        self::assertSame('updated', $event->action);
        self::assertSame('QC record', $event->entity_type);
        self::assertSame((string) $record->id, $event->entity_id);
        self::assertSame('Backfilled historical age for QC record #'.$record->id.' (BLK-2026-TEST01)', $event->summary);
        self::assertSame('historical age backfill', $event->details['submitted']['operation']);
        self::assertSame('', $event->details['submitted']['oldAgeValue']);
        self::assertSame('7', $event->details['submitted']['newAgeValue']);
        self::assertSame('2026-01-08', $event->details['submitted']['newTestingDate']);
    }

    public function test_stale_age_backfill_candidate_is_skipped_without_an_activity_event(): void
    {
        $this->asAdministrator('employee:999');
        $record = QcRecord::create([
            'record_no' => 'BLK-2026-STALE1', 'test_type' => 'Blocks', 'sample_date' => '2026-01-01',
            'location' => 'Hidd', 'material' => 'Concrete Block', 'status' => 'Review',
            'tested_by' => 'QC technician', 'details' => [
                'blockAge' => '', 'testingDate' => '2026-01-08', 'testRows' => [['sampleAge' => '']],
            ],
        ]);
        $candidate = collect($this->postJson('/api/qc/records/age-backfill/preview', [])->assertOk()->json('eligible'))
            ->firstWhere('id', $record->id);
        self::assertNotNull($candidate);

        $record->details = array_merge($record->details, ['blockAge' => '6']);
        $record->save();

        $this->postJson('/api/qc/records/age-backfill/apply', ['candidates' => [$candidate]])
            ->assertOk()
            ->assertJsonPath('applied', 0)
            ->assertJsonCount(1, 'skipped');
        self::assertSame('6', $record->fresh()->details['blockAge']);
        self::assertSame(0, EmployeeActivityEvent::query()->count());
    }

    private function makeReadyMixRecord(string $recordNo, string $sampleDate, string $location, string $reference, string $mixDesign, array $testRows): QcRecord
    {
        return QcRecord::create([
            'record_no' => $recordNo, 'test_type' => 'Ready Mix', 'sample_date' => $sampleDate,
            'location' => $location, 'material' => $mixDesign, 'status' => 'Review',
            'tested_by' => 'QC technician', 'details' => [
                'referenceNumber' => $reference, 'designStrength' => $mixDesign, 'testRows' => $testRows,
            ],
        ]);
    }

    private function validReportTemplateDesign(string $title): array
    {
        return [
            'schemaVersion' => 1,
            'layout' => [
                'title' => $title, 'fontFamily' => 'Arial', 'fontSize' => 11,
                'textColor' => '#1f2937', 'accentColor' => '#be0055', 'paperPadding' => 14,
                'sections' => [['key' => 'header', 'label' => 'Header', 'visible' => true, 'order' => 0]],
                'columns' => ['waterDetails' => [
                    ['key' => 'ph', 'label' => 'pH', 'visible' => true, 'order' => 0, 'width' => 100],
                ]],
            ],
            'page' => [
                'pageSize' => 'A4', 'orientation' => 'portrait', 'widthMm' => 210, 'heightMm' => 297,
                'marginTopMm' => 14, 'marginRightMm' => 14, 'marginBottomMm' => 14, 'marginLeftMm' => 14,
                'showHeader' => true, 'showFooter' => true, 'headerHeightMm' => 24, 'footerHeightMm' => 18,
            ],
            'objects' => [],
        ];
    }

    private function asAdministrator(string $id = 'employee:100', string $role = 'administrator'): void
    {
        $employeeId = substr($id, strlen('employee:'));
        EmployeeDirectoryEntry::query()->updateOrCreate(
            ['employee_id' => $employeeId],
            ['name' => 'Test Administrator', 'active' => true],
        );
        EmployeeAccess::query()->updateOrCreate(
            ['employee_id' => $employeeId],
            [
                'active' => true,
                'administrator' => $role === 'administrator',
                'role' => $role,
            ],
        );
        $user = User::query()->updateOrCreate(
            ['id' => $id],
            ['first_name' => null, 'last_name' => null],
        );
        $this->actingAs($user, 'api');
    }
}

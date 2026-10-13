<?php

namespace Tests\Feature;

use App\Models\QcRecord;
use Illuminate\Foundation\Auth\User as Authenticatable;
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
    }

    private function asAdministrator(string $id = 'employee:100'): void
    {
        $user = new class extends Authenticatable {
            protected $table = 'users';
            protected $guarded = [];
        };
        $user->setIncrementing(false);
        $user->setKeyType('string');
        $user->forceFill(['id' => $id, 'role' => 'administrator']);
        $this->actingAs($user, 'api');
    }
}

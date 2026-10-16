<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class QcSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_qc_schema_is_additive_and_contains_the_required_record_and_reporting_tables(): void
    {
        foreach ([
            'qc_records', 'qc_reference_categories', 'qc_reference_items', 'qc_strength_standards',
            'qc_sieve_standards', 'qc_water_standards', 'qc_shape_factors', 'qc_report_layouts',
            'qc_report_templates', 'employee_activity_events',
        ] as $table) {
            self::assertTrue(Schema::hasTable($table), "Expected {$table} to exist after migration.");
        }

        self::assertTrue(Schema::hasColumns('qc_records', ['record_no', 'test_type', 'sample_date', 'status', 'details']));
        self::assertTrue(Schema::hasColumns('qc_report_templates', ['design', 'history', 'version', 'is_default']));
        self::assertTrue(Schema::hasColumns('employee_activity_events', [
            'employee_id', 'employee_name', 'session_fingerprint', 'action', 'entity_type',
            'entity_id', 'summary', 'details', 'occurred_at',
        ]));
    }
}

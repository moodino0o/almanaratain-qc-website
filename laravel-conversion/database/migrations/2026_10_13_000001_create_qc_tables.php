<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('qc_records')) {
            Schema::create('qc_records', function (Blueprint $table): void {
                $table->id();
                $table->string('record_no')->unique();
                $table->string('test_type');
                $table->date('sample_date');
                $table->string('location');
                $table->string('material');
                $table->string('status');
                $table->string('tested_by');
                $table->string('reviewed_by')->nullable();
                $table->text('remarks')->nullable();
                $table->jsonb('details')->default('{}');
                $table->timestampsTz();
                $table->index(['test_type', 'sample_date']);
                $table->index(['status', 'sample_date']);
            });
        }

        if (! Schema::hasTable('qc_reference_categories')) {
            Schema::create('qc_reference_categories', function (Blueprint $table): void {
                $table->id();
                $table->string('key')->unique();
                $table->string('label');
                $table->timestampsTz();
            });
        }

        if (! Schema::hasTable('qc_reference_items')) {
            Schema::create('qc_reference_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('category_id')->constrained('qc_reference_categories')->cascadeOnDelete();
                $table->string('value');
                $table->timestampsTz();
                $table->unique(['category_id', 'value'], 'qc_reference_items_category_value_unique');
            });
        }

        if (! Schema::hasTable('qc_strength_standards')) {
            Schema::create('qc_strength_standards', function (Blueprint $table): void {
                $table->id();
                $table->string('test_type');
                $table->string('material');
                $table->string('block_type')->nullable();
                $table->string('block_size')->nullable();
                $table->unsignedSmallInteger('cube_age')->nullable();
                $table->decimal('kerb_class', 10, 2)->nullable();
                $table->string('kerb_marking')->nullable();
                $table->string('bs_standard');
                $table->decimal('required_strength', 10, 2);
                $table->decimal('minimum_individual_strength', 10, 2)->nullable();
                $table->decimal('water_absorption_limit', 10, 2)->nullable();
                $table->decimal('dammam_average_strength', 10, 2)->nullable();
                $table->decimal('dammam_minimum_strength', 10, 2)->nullable();
                $table->string('strength_unit')->default('N/mm²');
                $table->timestampsTz();
                $table->index(['test_type', 'material']);
            });
        }

        if (! Schema::hasTable('qc_sieve_standards')) {
            Schema::create('qc_sieve_standards', function (Blueprint $table): void {
                $table->id();
                $table->string('test_type');
                $table->foreignId('material_reference_item_id')->constrained('qc_reference_items')->restrictOnDelete();
                $table->foreignId('sieve_size_reference_item_id')->constrained('qc_reference_items')->restrictOnDelete();
                $table->string('standard_reference');
                $table->string('measurement_type');
                $table->decimal('minimum', 10, 3)->nullable();
                $table->decimal('maximum', 10, 3)->nullable();
                $table->string('unit')->default('%');
                $table->timestampsTz();
                $table->unique(['test_type', 'material_reference_item_id', 'sieve_size_reference_item_id', 'measurement_type'], 'qc_sieve_standards_rule_unique');
            });
        }

        if (! Schema::hasTable('qc_water_standards')) {
            Schema::create('qc_water_standards', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                foreach (['ph', 'chloride', 'tds', 'so3'] as $field) {
                    $table->decimal("{$field}_min", 10, 2);
                    $table->decimal("{$field}_max", 10, 2);
                }
                $table->boolean('is_default')->default(false);
                $table->timestampsTz();
            });
        }

        if (! Schema::hasTable('qc_shape_factors')) {
            Schema::create('qc_shape_factors', function (Blueprint $table): void {
                $table->id();
                $table->string('block_type')->nullable();
                $table->string('block_size')->nullable()->unique();
                $table->decimal('shape_factor', 10, 3)->nullable();
                $table->decimal('correction_factor', 10, 3)->nullable();
                $table->timestampsTz();
            });
        }

        if (! Schema::hasTable('qc_report_layouts')) {
            Schema::create('qc_report_layouts', function (Blueprint $table): void {
                $table->id();
                $table->string('test_type')->unique();
                $table->string('name');
                $table->jsonb('config')->default('{}');
                $table->timestampsTz();
            });
        }

        if (! Schema::hasTable('qc_report_templates')) {
            Schema::create('qc_report_templates', function (Blueprint $table): void {
                $table->id();
                $table->string('test_type');
                $table->string('name');
                $table->text('description')->nullable();
                $table->boolean('is_default')->default(false);
                $table->unsignedInteger('version')->default(1);
                $table->jsonb('design');
                $table->jsonb('history')->default('[]');
                $table->timestampsTz();
                $table->index(['test_type', 'is_default']);
            });
        }
    }

    public function down(): void
    {
        // Deliberately non-destructive: these tables may hold migrated QC history.
    }
};

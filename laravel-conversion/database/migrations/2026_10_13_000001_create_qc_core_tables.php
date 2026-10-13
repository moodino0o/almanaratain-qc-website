<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('qc_records', function (Blueprint $table): void {
            $table->increments('id');
            $table->text('record_no')->unique();
            $table->text('test_type');
            $table->date('sample_date');
            $table->text('location');
            $table->text('material');
            $table->text('status');
            $table->text('tested_by');
            $table->text('reviewed_by')->nullable();
            $table->text('remarks')->nullable();
            $table->jsonb('details')->default('{}');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('qc_reference_categories', function (Blueprint $table): void {
            $table->increments('id');
            $table->text('key')->unique();
            $table->text('label');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('qc_reference_items', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('category_id');
            $table->text('value');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->foreign('category_id')
                ->references('id')
                ->on('qc_reference_categories')
                ->cascadeOnDelete();
            $table->unique(
                ['category_id', 'value'],
                'qc_reference_items_category_value_unique',
            );
        });

        Schema::create('complaints', function (Blueprint $table): void {
            $table->increments('id');
            $table->text('complaint_no')->unique();
            $table->text('customer_name');
            $table->date('delivery_date');
            $table->text('complaint_type');
            $table->text('material_type');
            $table->text('details');
            $table->text('solution')->default('');
            $table->text('recommendation')->default('');
            $table->text('qc_reviewer_name')->nullable();
            $table->date('review_date')->nullable();
            $table->text('status')->default('open');
            $table->jsonb('picture_paths')->default('[]');
            $table->text('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('employee_directory', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('employee_id', 64)->unique();
            $table->string('name', 255);
            $table->string('password_hash', 255)->nullable();
            $table->boolean('active')->default(true);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->index('active', 'employee_directory_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_directory');
        Schema::dropIfExists('complaints');
        Schema::dropIfExists('qc_reference_items');
        Schema::dropIfExists('qc_reference_categories');
        Schema::dropIfExists('qc_records');
    }
};

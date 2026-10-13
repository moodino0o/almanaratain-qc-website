<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('employee_activity_events')) {
            return;
        }

        Schema::create('employee_activity_events', function (Blueprint $table): void {
            $table->increments('id');
            $table->text('employee_id');
            $table->text('employee_name');
            $table->text('session_fingerprint')->nullable();
            $table->timestampTz('occurred_at')->useCurrent();
            $table->text('action');
            $table->text('entity_type');
            $table->text('entity_id')->nullable();
            $table->text('summary');
            $table->jsonb('details')->default('{}');
            $table->index('occurred_at', 'employee_activity_events_occurred_idx');
            $table->index(
                ['employee_id', 'occurred_at'],
                'employee_activity_events_employee_occurred_idx',
            );
        });
    }

    public function down(): void
    {
        // Activity history is audit data; rolling back a migration must not erase it.
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employee_access')) {
            Schema::create('employee_access', function (Blueprint $table): void {
                $table->increments('id');
                $table->string('employee_id', 64)->unique();
                $table->boolean('active')->default(true);
                $table->boolean('administrator')->default(false);
                $table->string('role', 32)->default('technician');
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('updated_at')->useCurrent();
                $table->index('active', 'employee_access_active_idx');
            });
        }
        if (Schema::hasTable('employee_directory')) {
            $now = now();
            foreach (DB::table('employee_directory')->where('active', true)->get(['employee_id']) as $employee) {
                DB::table('employee_access')->insertOrIgnore([
                    'employee_id' => $employee->employee_id,
                    'active' => true,
                    'administrator' => false,
                    'role' => 'technician',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->string('id')->primary();
                $table->string('email')->nullable()->unique();
                $table->string('first_name')->nullable();
                $table->string('last_name')->nullable();
                $table->string('profile_image_url')->nullable();
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('updated_at')->useCurrent();
            });
        }

        if (! Schema::hasTable('employee_sessions')) {
            Schema::create('employee_sessions', function (Blueprint $table): void {
                $table->string('token_hash', 64)->primary();
                $table->string('user_id')->index();
                $table->timestampTz('expires_at')->index();
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('updated_at')->useCurrent();
            });
        }

        if (! Schema::hasTable('employee_activity_sessions')) {
            Schema::create('employee_activity_sessions', function (Blueprint $table): void {
                $table->string('session_fingerprint', 64)->primary();
                $table->string('employee_id', 120);
                $table->string('employee_name', 200);
                $table->timestampTz('started_at')->useCurrent();
                $table->timestampTz('last_seen_at')->useCurrent();
                $table->timestampTz('expires_at');
                $table->timestampTz('ended_at')->nullable();
                $table->string('end_reason', 32)->nullable();
                $table->index('started_at', 'employee_activity_sessions_started_idx');
                $table->index(['employee_id', 'started_at'], 'employee_activity_sessions_employee_started_idx');
            });
        }

        if (! Schema::hasTable('employee_activity_events')) {
            Schema::create('employee_activity_events', function (Blueprint $table): void {
                $table->increments('id');
                $table->string('employee_id', 120);
                $table->string('employee_name', 200);
                $table->string('session_fingerprint', 64)->nullable();
                $table->timestampTz('occurred_at')->useCurrent();
                $table->string('action', 32);
                $table->string('entity_type', 120);
                $table->text('entity_id')->nullable();
                $table->text('summary');
                $table->json('details')->default('{}');
                $table->index('occurred_at', 'employee_activity_events_occurred_idx');
                $table->index(['employee_id', 'occurred_at'], 'employee_activity_events_employee_occurred_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_activity_events');
        Schema::dropIfExists('employee_activity_sessions');
        Schema::dropIfExists('employee_sessions');
        Schema::dropIfExists('employee_access');
        Schema::dropIfExists('users');
    }
};

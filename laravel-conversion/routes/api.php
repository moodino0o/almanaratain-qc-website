<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\ComplaintController;
use App\Http\Controllers\EmployeesController;
use App\Http\Controllers\QcController;
use App\Http\Controllers\QcReferenceController;
use App\Http\Controllers\QcReportController;
use App\Http\Controllers\QcStandardsController;
use App\Http\Controllers\StorageController;
use Illuminate\Support\Facades\Route;

Route::get('/healthz', HealthController::class);

Route::post('/employee-login', [AuthController::class, 'login']);
Route::get('/auth/user', [AuthController::class, 'user'])->middleware('employee.session');
Route::get('/logout', [AuthController::class, 'logout'])->middleware('employee.session');
Route::post('/mobile-auth/logout', [AuthController::class, 'logout'])->middleware('employee.session');

Route::middleware(['employee.session', 'employee.auth'])->group(function (): void {
    Route::get('/complaints', [ComplaintController::class, 'index']);
    Route::get('/complaints/{id}', [ComplaintController::class, 'show'])->whereNumber('id');
    Route::get('/archive', [ArchiveController::class, 'index']);
    Route::get('/archive/documents/{id}', [ArchiveController::class, 'show'])->whereNumber('id');
    Route::get('/archive/documents/{id}/content', [ArchiveController::class, 'content'])->whereNumber('id');
    Route::get('/archive/documents/{id}/download', [ArchiveController::class, 'download'])->whereNumber('id');
    Route::get('/storage/objects/{objectPath}', [StorageController::class, 'privateObject'])->where('objectPath', '.*');
});

Route::middleware(['employee.session', 'employee.auth', 'complaint.editor'])->group(function (): void {
    Route::post('/complaints', [ComplaintController::class, 'store']);
    Route::patch('/complaints/{id}', [ComplaintController::class, 'update'])->whereNumber('id');
    Route::delete('/complaints/{id}', [ComplaintController::class, 'destroy'])->whereNumber('id');
});

Route::middleware(['employee.session', 'employee.auth', 'qc.role:administrator'])->group(function (): void {
    Route::post('/archive/documents', [ArchiveController::class, 'store']);
    Route::patch('/archive/documents/{id}', [ArchiveController::class, 'update'])->whereNumber('id');
});

Route::delete('/archive/documents/{id}', [ArchiveController::class, 'destroy'])
    ->middleware(['employee.session', 'employee.auth'])
    ->whereNumber('id');
Route::post('/storage/uploads/request-url', [StorageController::class, 'requestUploadUrl'])
    ->middleware(['employee.session', 'employee.auth']);
Route::get('/storage/public-objects/{filePath}', [StorageController::class, 'publicObject'])
    ->where('filePath', '.*');

Route::prefix('auth/employee-access')
    ->middleware(['employee.session', 'employee.auth', 'qc.role:administrator'])
    ->group(function (): void {
        Route::get('/', [AuthController::class, 'employeeAccessIndex']);
        Route::post('/', [AuthController::class, 'createEmployeeAccess']);
        Route::patch('/{id}', [AuthController::class, 'updateEmployeeAccess'])->whereNumber('id');
        Route::delete('/{id}', [AuthController::class, 'deleteEmployeeAccess'])->whereNumber('id');
    });

Route::prefix('employees')
    ->middleware(['employee.session', 'employee.auth', 'qc.role:administrator'])
    ->group(function (): void {
        Route::get('/', [EmployeesController::class, 'index']);
        Route::post('/', [EmployeesController::class, 'store']);
        Route::patch('/{id}', [EmployeesController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [EmployeesController::class, 'destroy'])->whereNumber('id');
    });

Route::prefix('qc')->middleware(['employee.session', 'employee.auth'])->group(function (): void {
    Route::get('/dashboard', [QcController::class, 'dashboard']);
    Route::get('/daily-ready-mix-results', [QcController::class, 'dailyReadyMixResults']);
    Route::get('/lookups', [QcReferenceController::class, 'lookups']);
    Route::get('/reference-data', [QcReferenceController::class, 'index']);
    Route::get('/records', [QcController::class, 'index']);
    Route::get('/records/{id}', [QcController::class, 'show'])->whereNumber('id');
    Route::get('/reports/{id}', [QcController::class, 'report'])->whereNumber('id');
    Route::get('/strength-standards', [QcStandardsController::class, 'strengths']);
    Route::get('/shape-factors', [QcStandardsController::class, 'shapes']);
    Route::get('/water-standards', [QcStandardsController::class, 'waters']);
    Route::get('/sieve-standards', [QcStandardsController::class, 'sieves']);
    Route::get('/report-layouts', [QcReportController::class, 'layouts']);
    Route::get('/report-templates', [QcReportController::class, 'templates']);
    Route::get('/report-templates/{id}/versions', [QcReportController::class, 'versions'])->whereNumber('id');

    Route::middleware('qc.role:editor')->group(function (): void {
        Route::post('/records', [QcController::class, 'store']);
        Route::patch('/records/{id}', [QcController::class, 'update'])->whereNumber('id');
        Route::delete('/records/{id}', [QcController::class, 'destroy'])->whereNumber('id');
    });

    Route::post('/reference-data/categories/{categoryId}/items', [QcReferenceController::class, 'createItem'])->whereNumber('categoryId');

    Route::middleware('qc.role:administrator')->group(function (): void {
        Route::post('/records/kerbstone-strength-refresh', [QcController::class, 'refreshKerbstoneStrength']);
        Route::post('/records/age-backfill/preview', [QcController::class, 'previewAgeBackfill']);
        Route::post('/records/age-backfill/apply', [QcController::class, 'applyAgeBackfill']);
        Route::post('/reference-data/categories', [QcReferenceController::class, 'createCategory']);
        Route::patch('/reference-data/categories/{id}', [QcReferenceController::class, 'updateCategory'])->whereNumber('id');
        Route::delete('/reference-data/categories/{id}', [QcReferenceController::class, 'deleteCategory'])->whereNumber('id');
        Route::patch('/reference-data/items/{id}', [QcReferenceController::class, 'updateItem'])->whereNumber('id');
        Route::delete('/reference-data/items/{id}', [QcReferenceController::class, 'deleteItem'])->whereNumber('id');
        Route::post('/strength-standards', [QcStandardsController::class, 'createStrength']);
        Route::patch('/strength-standards/{id}', [QcStandardsController::class, 'updateStrength'])->whereNumber('id');
        Route::delete('/strength-standards/{id}', [QcStandardsController::class, 'deleteStrength'])->whereNumber('id');
        Route::post('/shape-factors', [QcStandardsController::class, 'createShape']);
        Route::patch('/shape-factors/{id}', [QcStandardsController::class, 'updateShape'])->whereNumber('id');
        Route::delete('/shape-factors/{id}', [QcStandardsController::class, 'deleteShape'])->whereNumber('id');
        Route::post('/water-standards', [QcStandardsController::class, 'createWater']);
        Route::patch('/water-standards/{id}', [QcStandardsController::class, 'updateWater'])->whereNumber('id');
        Route::delete('/water-standards/{id}', [QcStandardsController::class, 'deleteWater'])->whereNumber('id');
        Route::post('/sieve-standards', [QcStandardsController::class, 'createSieve']);
        Route::patch('/sieve-standards/{id}', [QcStandardsController::class, 'updateSieve'])->whereNumber('id');
        Route::delete('/sieve-standards/{id}', [QcStandardsController::class, 'deleteSieve'])->whereNumber('id');
        Route::patch('/report-layouts/{id}', [QcReportController::class, 'updateLayout'])->whereNumber('id');
        Route::post('/report-templates', [QcReportController::class, 'createTemplate']);
        Route::patch('/report-templates/{id}', [QcReportController::class, 'updateTemplate'])->whereNumber('id');
        Route::delete('/report-templates/{id}', [QcReportController::class, 'deleteTemplate'])->whereNumber('id');
        Route::post('/report-templates/{id}/duplicate', [QcReportController::class, 'duplicateTemplate'])->whereNumber('id');
        Route::patch('/report-templates/{id}/default', [QcReportController::class, 'setDefault'])->whereNumber('id');
        Route::post('/report-templates/{id}/restore/{version}', [QcReportController::class, 'restore'])->whereNumber('id')->whereNumber('version');
    });
});

<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\QcController;
use App\Http\Controllers\QcReferenceController;
use App\Http\Controllers\QcReportController;
use App\Http\Controllers\QcStandardsController;
use Illuminate\Support\Facades\Route;

Route::get('/healthz', HealthController::class);

Route::prefix('qc')->middleware('auth')->group(function (): void {
    Route::get('/dashboard', [QcController::class, 'dashboard']);
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

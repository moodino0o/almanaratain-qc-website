<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('/healthz', HealthController::class);

// Application routes are added by conversion phase in FEATURE_MAP.md.

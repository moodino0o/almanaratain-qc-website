<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class HealthController
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'application' => 'al-manaratain-qc-laravel-conversion',
        ]);
    }
}

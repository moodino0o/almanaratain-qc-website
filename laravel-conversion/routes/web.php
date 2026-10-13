<?php

use Illuminate\Support\Facades\Route;

$spa = static function () {
    $index = public_path('frontend/index.html');

    abort_unless(is_file($index), 503, 'The QC frontend has not been built.');

    return response(file_get_contents($index), 200, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
};

Route::get('/', $spa);
Route::get('/{path}', $spa)->where('path', '^(?!api(?:/|$)).*');

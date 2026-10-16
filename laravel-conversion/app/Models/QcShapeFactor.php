<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QcShapeFactor extends Model
{
    protected $table = 'qc_shape_factors';
    protected $fillable = ['block_type', 'block_size', 'shape_factor', 'correction_factor'];
    protected function casts(): array
    {
        return ['shape_factor' => 'float', 'correction_factor' => 'float'];
    }
}

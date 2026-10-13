<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QcWaterStandard extends Model
{
    protected $table = 'qc_water_standards';
    protected $fillable = ['name', 'ph_min', 'ph_max', 'chloride_min', 'chloride_max', 'tds_min', 'tds_max', 'so3_min', 'so3_max', 'is_default'];
    protected function casts(): array
    {
        return ['ph_min' => 'float', 'ph_max' => 'float', 'chloride_min' => 'float', 'chloride_max' => 'float', 'tds_min' => 'float', 'tds_max' => 'float', 'so3_min' => 'float', 'so3_max' => 'float', 'is_default' => 'boolean'];
    }
}

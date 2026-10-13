<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QcStrengthStandard extends Model
{
    protected $table = 'qc_strength_standards';
    protected $fillable = ['test_type', 'material', 'block_type', 'block_size', 'cube_age', 'kerb_class', 'kerb_marking', 'bs_standard', 'required_strength', 'minimum_individual_strength', 'water_absorption_limit', 'dammam_average_strength', 'dammam_minimum_strength', 'strength_unit'];
    protected function casts(): array
    {
        return ['required_strength' => 'float', 'minimum_individual_strength' => 'float', 'water_absorption_limit' => 'float', 'dammam_average_strength' => 'float', 'dammam_minimum_strength' => 'float'];
    }
}

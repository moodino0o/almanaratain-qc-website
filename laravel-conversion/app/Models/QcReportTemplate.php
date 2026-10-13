<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QcReportTemplate extends Model
{
    protected $table = 'qc_report_templates';
    protected $fillable = ['test_type', 'name', 'description', 'is_default', 'version', 'design', 'history'];
    protected function casts(): array
    {
        return ['is_default' => 'boolean', 'version' => 'integer', 'design' => 'array', 'history' => 'array'];
    }
}

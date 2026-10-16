<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QcRecord extends Model
{
    protected $table = 'qc_records';

    protected $fillable = [
        'record_no',
        'test_type',
        'sample_date',
        'location',
        'material',
        'status',
        'tested_by',
        'reviewed_by',
        'remarks',
        'details',
    ];

    protected function casts(): array
    {
        return [
            'sample_date' => 'date:Y-m-d',
            'details' => 'array',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}

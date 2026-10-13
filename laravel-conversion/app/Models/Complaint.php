<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Complaint extends Model
{
    protected $fillable = [
        'complaint_no',
        'customer_name',
        'delivery_date',
        'complaint_type',
        'material_type',
        'details',
        'solution',
        'recommendation',
        'qc_reviewer_name',
        'review_date',
        'status',
        'picture_paths',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'delivery_date' => 'date:Y-m-d',
            'review_date' => 'date:Y-m-d',
            'picture_paths' => 'array',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}

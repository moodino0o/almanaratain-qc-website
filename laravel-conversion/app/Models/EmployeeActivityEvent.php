<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeActivityEvent extends Model
{
    public const CREATED_AT = 'occurred_at';
    public const UPDATED_AT = null;

    protected $table = 'employee_activity_events';

    protected $fillable = [
        'employee_id',
        'employee_name',
        'session_fingerprint',
        'occurred_at',
        'action',
        'entity_type',
        'entity_id',
        'summary',
        'details',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'immutable_datetime',
            'details' => 'array',
        ];
    }
}

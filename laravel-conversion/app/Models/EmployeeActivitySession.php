<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeActivitySession extends Model
{
    protected $table = 'employee_activity_sessions';

    protected $primaryKey = 'session_fingerprint';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'session_fingerprint', 'employee_id', 'employee_name', 'started_at',
        'last_seen_at', 'expires_at', 'ended_at', 'end_reason',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'immutable_datetime',
            'last_seen_at' => 'immutable_datetime',
            'expires_at' => 'immutable_datetime',
            'ended_at' => 'immutable_datetime',
        ];
    }
}

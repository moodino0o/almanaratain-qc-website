<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeSession extends Model
{
    protected $table = 'employee_sessions';

    protected $primaryKey = 'token_hash';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['token_hash', 'user_id', 'expires_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}

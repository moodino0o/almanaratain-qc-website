<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class QcRoleMiddleware
{
    public function handle(Request $request, Closure $next, string $required): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }
        $role = strtolower((string) ($user->role ?? ''));
        $employeeId = is_string($user->id ?? null) && str_starts_with($user->id, 'employee:')
            ? trim(substr($user->id, strlen('employee:')))
            : '';
        $administrator = (bool) ($user->is_admin ?? $user->isAdmin ?? false) ||
            $role === 'administrator' ||
            ($employeeId !== '' && isset(\App\Services\EmployeeAccessService::configuredAdministrators()[$employeeId]));
        $allowed = $required === 'administrator'
            ? $administrator
            : ($administrator || in_array($role, ['technician', 'managerial'], true));
        return $allowed ? $next($request) : response()->json(['error' => 'Forbidden'], 403);
    }
}

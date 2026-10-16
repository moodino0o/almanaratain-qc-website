<?php

namespace App\Http\Middleware;

use App\Models\EmployeeAccess;
use App\Models\EmployeeDirectoryEntry;
use App\Models\User;
use App\Services\EmployeeAccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EmployeeAuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $employeeId = EmployeeAccessService::employeeId($user);
        $employee = $employeeId
            ? EmployeeDirectoryEntry::query()->where('employee_id', $employeeId)->where('active', true)->first()
            : null;
        $access = $employeeId
            ? EmployeeAccess::query()->where('employee_id', $employeeId)->where('active', true)->first()
            : null;

        if (! $user || ! $employee || ! $access) {
            return response()->json([
                'code' => $user ? 'EMPLOYEE_ACCESS_REQUIRED' : null,
                'error' => $user
                    ? 'Your account is authenticated but has not been approved for QC access.'
                    : 'Authentication required.',
            ], $user ? 403 : 401);
        }

        $role = EmployeeAccessService::role($user, $access);
        $user->setAttribute('role', $role);
        $user->setAttribute('is_admin', $role === 'administrator');
        $request->setUserResolver(static fn () => $user);

        return $next($request);
    }
}

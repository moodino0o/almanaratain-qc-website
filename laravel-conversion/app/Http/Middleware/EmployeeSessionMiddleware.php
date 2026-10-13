<?php

namespace App\Http\Middleware;

use App\Models\EmployeeAccess;
use App\Models\EmployeeActivitySession;
use App\Models\EmployeeDirectoryEntry;
use App\Models\EmployeeSession;
use App\Models\User;
use App\Services\EmployeeAccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EmployeeSessionMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->sessionToken($request);
        if ($token === null || $token === '') {
            return $next($request);
        }

        $fingerprint = hash('sha256', $token);
        $session = EmployeeSession::query()->find($fingerprint);
        if (! $session) {
            return $this->continueWithClearedCookie($request, $next);
        }

        if ($session->expires_at->isPast()) {
            $this->closeSession($session, 'expired');

            return $this->continueWithClearedCookie($request, $next);
        }

        $user = User::query()->find($session->user_id);
        $employeeId = EmployeeAccessService::employeeId($user);
        $employee = $employeeId
            ? EmployeeDirectoryEntry::query()->where('employee_id', $employeeId)->where('active', true)->first()
            : null;
        $access = $employeeId
            ? EmployeeAccess::query()->where('employee_id', $employeeId)->where('active', true)->first()
            : null;

        if (! $user || ! $employee) {
            $this->closeSession($session, 'revoked');

            return $this->continueWithClearedCookie($request, $next);
        }

        $role = EmployeeAccessService::role($user, $access);
        $user->setAttribute('role', $role);
        $user->setAttribute('is_admin', $role === 'administrator');
        $request->setUserResolver(static fn () => $user);

        EmployeeActivitySession::query()
            ->whereKey($fingerprint)
            ->whereNull('ended_at')
            ->update(['last_seen_at' => now()]);

        return $next($request);
    }

    public static function sessionToken(Request $request): ?string
    {
        $authorization = $request->header('Authorization');
        if (is_string($authorization) && str_starts_with($authorization, 'Bearer ')) {
            return substr($authorization, 7);
        }

        $cookie = $request->cookie('sid');

        return is_string($cookie) ? $cookie : null;
    }

    public static function closeSession(EmployeeSession $session, string $reason): void
    {
        $session->delete();
        EmployeeActivitySession::query()
            ->whereKey($session->token_hash)
            ->whereNull('ended_at')
            ->update(['ended_at' => now(), 'end_reason' => $reason]);
    }

    private function continueWithClearedCookie(Request $request, Closure $next): Response
    {
        return $next($request)->withCookie(cookie()->forget('sid', '/'));
    }
}

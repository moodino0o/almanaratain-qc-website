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
        $administrator = (bool) ($user->is_admin ?? $user->isAdmin ?? false) || $role === 'administrator';
        $allowed = $required === 'administrator'
            ? $administrator
            : ($administrator || in_array($role, ['technician', 'managerial'], true));
        return $allowed ? $next($request) : response()->json(['error' => 'Forbidden'], 403);
    }
}

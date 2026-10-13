<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ComplaintEditorMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $role = (string) ($request->user()?->role ?? '');
        if (! in_array($role, ['managerial', 'administrator'], true)) {
            return response()->json([
                'code' => 'ROLE_ACCESS_REQUIRED',
                'error' => 'Your role does not allow this action.',
            ], $request->user() ? 403 : 401);
        }

        return $next($request);
    }
}

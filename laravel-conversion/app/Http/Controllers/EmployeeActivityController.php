<?php

namespace App\Http\Controllers;

use App\Models\EmployeeActivityEvent;
use App\Models\EmployeeActivitySession;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $start = CarbonImmutable::createFromFormat('Y-m-d', $validated['from'], 'Asia/Riyadh')->startOfDay()->utc();
        $end = CarbonImmutable::createFromFormat('Y-m-d', $validated['to'], 'Asia/Riyadh')->addDay()->startOfDay()->utc();
        $sessions = EmployeeActivitySession::query()
            ->where('started_at', '>=', $start)
            ->where('started_at', '<', $end)
            ->orderByDesc('started_at')
            ->get();
        $changes = EmployeeActivityEvent::query()
            ->where('occurred_at', '>=', $start)
            ->where('occurred_at', '<', $end)
            ->orderByDesc('occurred_at')
            ->get();

        $days = [];
        $ensureDay = static function (string $employeeId, string $employeeName, CarbonImmutable $timestamp) use (&$days): array {
            $date = $timestamp->setTimezone('Asia/Riyadh')->format('Y-m-d');
            $key = $employeeId.'|'.$date;
            if (! isset($days[$key])) {
                $days[$key] = [
                    'employeeId' => $employeeId,
                    'employeeName' => $employeeName,
                    'date' => $date,
                    'loginCount' => 0,
                    'sessions' => [],
                    'loginAttempts' => [],
                    'changes' => [],
                ];
            }

            return [$key, $date];
        };

        $now = CarbonImmutable::now();
        foreach ($sessions as $session) {
            [$key] = $ensureDay($session->employee_id, $session->employee_name, $session->started_at);
            $inferredExpired = $session->ended_at === null && $session->expires_at->lt($now);
            $reason = in_array($session->end_reason, ['logout', 'expired', 'revoked'], true)
                ? $session->end_reason
                : ($inferredExpired ? 'expired' : null);
            $endedAt = $session->ended_at ?? ($inferredExpired ? $session->expires_at : null);
            $days[$key]['sessions'][] = [
                'startedAt' => $session->started_at->toISOString(),
                'lastSeenAt' => $session->last_seen_at->toISOString(),
                'expiresAt' => $session->expires_at->toISOString(),
                'endedAt' => $endedAt?->toISOString(),
                'endReason' => $reason,
            ];
            $days[$key]['loginCount']++;
        }

        foreach ($changes as $change) {
            [$key] = $ensureDay($change->employee_id, $change->employee_name, $change->occurred_at);
            $details = is_array($change->details) ? $change->details : [];
            if ($change->entity_type === 'Login attempt') {
                $days[$key]['loginAttempts'][] = [
                    'occurredAt' => $change->occurred_at->toISOString(),
                    'ipAddress' => is_string($details['ipAddress'] ?? null) ? $details['ipAddress'] : 'Unknown',
                    'location' => is_string($details['location'] ?? null) ? $details['location'] : 'Unavailable',
                    'outcome' => ($details['outcome'] ?? null) === 'success' ? 'success' : 'failure',
                ];
                continue;
            }
            $days[$key]['changes'][] = [
                'id' => $change->id,
                'occurredAt' => $change->occurred_at->toISOString(),
                'action' => $change->action,
                'entityType' => $change->entity_type,
                'entityId' => $change->entity_id,
                'summary' => $change->summary,
                'details' => $details,
            ];
        }

        $records = array_values($days);
        foreach ($records as &$day) {
            usort($day['sessions'], static fn (array $a, array $b): int => strcmp($a['startedAt'], $b['startedAt']));
            usort($day['changes'], static fn (array $a, array $b): int => strcmp($b['occurredAt'], $a['occurredAt']));
            usort($day['loginAttempts'], static fn (array $a, array $b): int => strcmp($b['occurredAt'], $a['occurredAt']));
        }
        unset($day);
        usort($records, static fn (array $a, array $b): int =>
            strcmp($b['date'], $a['date']) ?: strcmp($a['employeeName'], $b['employeeName'])
        );

        return response()->json(['records' => $records]);
    }
}

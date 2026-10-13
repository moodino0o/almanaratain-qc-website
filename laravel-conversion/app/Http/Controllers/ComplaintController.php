<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ComplaintController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'string'],
            'complaintType' => ['sometimes', 'string'],
            'materialType' => ['sometimes', 'string'],
        ]);
        $query = Complaint::query();
        if (! empty($filters['complaintType'])) {
            $query->where('complaint_type', $filters['complaintType']);
        }
        if (! empty($filters['materialType'])) {
            $query->where('material_type', $filters['materialType']);
        }
        if (! empty($filters['search'])) {
            $search = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $filters['search']).'%';
            $query->where(function (Builder $nested) use ($search): void {
                foreach (['complaint_no', 'customer_name', 'complaint_type', 'material_type', 'details', 'solution', 'recommendation'] as $column) {
                    $nested->orWhereRaw('LOWER("'.$column.'") LIKE LOWER(?)', [$search]);
                }
            });
        }

        return response()->json($query->orderByDesc('delivery_date')->orderByDesc('id')->get()->map(
            fn (Complaint $complaint): array => $this->present($complaint),
        )->values());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, true);
        $data['status'] = 'open';
        $complaint = Complaint::query()->create($data + [
            'complaint_no' => 'CMP-'.now()->format('Y').'-'.Str::upper(Str::random(8)),
            'status' => 'open',
            'created_by' => $request->user()->getAuthIdentifier(),
        ]);

        return response()->json($this->present($complaint), 201);
    }

    public function show(int $id): JsonResponse
    {
        $complaint = Complaint::query()->find($id);
        abort_unless($complaint, 404, 'Complaint not found.');

        return response()->json($this->present($complaint));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $complaint = Complaint::query()->find($id);
        abort_unless($complaint, 404, 'Complaint not found.');
        $data = $this->validated($request, false);
        if ($data === []) {
            return response()->json(['error' => 'Invalid complaint update.'], 400);
        }
        $complaint->fill($data)->save();

        return response()->json($this->present($complaint->refresh()));
    }

    public function destroy(int $id): JsonResponse
    {
        $complaint = Complaint::query()->find($id);
        abort_unless($complaint, 404, 'Complaint not found.');
        $complaint->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        $request->validate([
            'customerName' => [$required, 'string', 'min:1', 'max:255'],
            'deliveryDate' => [$required, 'date'],
            'complaintType' => [$required, 'string', 'min:1', 'max:255'],
            'materialType' => [$required, 'string', 'min:1', 'max:255'],
            'details' => [$required, 'string', 'min:1'],
            'solution' => ['sometimes', 'string'],
            'recommendation' => ['sometimes', 'string'],
            'qcReviewerName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'reviewDate' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', Rule::in(['open', 'complete'])],
            'picturePaths' => ['sometimes', 'array'],
            'picturePaths.*.objectPath' => ['required_with:picturePaths', 'string', 'regex:#^/objects/uploads/[A-Za-z0-9-]+$#'],
            'picturePaths.*.originalName' => ['required_with:picturePaths', 'string', 'min:1', 'max:255'],
            'picturePaths.*.mimeType' => ['required_with:picturePaths', 'string', 'min:1', 'max:255'],
            'picturePaths.*.size' => ['required_with:picturePaths', 'integer', 'min:1'],
        ], [], [
            'customerName' => 'customer name',
            'deliveryDate' => 'delivery date',
            'complaintType' => 'complaint type',
            'materialType' => 'material type',
        ]);

        return $this->normalizeInput($request, $creating);
    }

    private function normalizeInput(Request $request, bool $creating): array
    {
        $mapping = [
            'customerName' => 'customer_name',
            'deliveryDate' => 'delivery_date',
            'complaintType' => 'complaint_type',
            'materialType' => 'material_type',
            'qcReviewerName' => 'qc_reviewer_name',
            'reviewDate' => 'review_date',
            'picturePaths' => 'picture_paths',
        ];
        $data = [];
        foreach (['customerName', 'deliveryDate', 'complaintType', 'materialType', 'details', 'solution', 'recommendation', 'qcReviewerName', 'reviewDate', 'status', 'picturePaths'] as $field) {
            if ($request->exists($field)) {
                $value = $request->input($field);
                if (in_array($field, ['customerName', 'complaintType', 'materialType', 'details', 'solution', 'recommendation', 'qcReviewerName'], true) && is_string($value)) {
                    $value = trim($value);
                }
                $data[$mapping[$field] ?? $field] = $value;
            } elseif ($creating && in_array($field, ['solution', 'recommendation', 'picturePaths'], true)) {
                $data[$mapping[$field] ?? $field] = $field === 'picturePaths' ? [] : '';
            }
        }

        return $data;
    }

    private function present(Complaint $complaint): array
    {
        return [
            'id' => $complaint->id,
            'complaintNo' => $complaint->complaint_no,
            'customerName' => $complaint->customer_name,
            'deliveryDate' => $complaint->delivery_date?->format('Y-m-d'),
            'complaintType' => $complaint->complaint_type,
            'materialType' => $complaint->material_type,
            'details' => $complaint->details,
            'solution' => $complaint->solution,
            'recommendation' => $complaint->recommendation,
            'qcReviewerName' => $complaint->qc_reviewer_name,
            'reviewDate' => $complaint->review_date?->format('Y-m-d'),
            'status' => $complaint->status === 'complete' ? 'complete' : 'open',
            'picturePaths' => $complaint->picture_paths ?? [],
            'createdAt' => $complaint->created_at?->toISOString(),
            'updatedAt' => $complaint->updated_at?->toISOString(),
        ];
    }
}

<?php

namespace App\Http\Requests;

use App\Enums\TaskStatus;
use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Task::class);
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('assigned_to')) {
            $this->merge(['assigned_to' => $this->user()->id]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::enum(TaskStatus::class)],
            'assigned_to' => $this->assigneeRules(),
            'due_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return list<mixed>
     */
    protected function assigneeRules(): array
    {
        $rules = ['required', 'integer', 'exists:users,id'];

        if (! $this->user()->isAdmin()) {
            $rules[] = Rule::in([$this->user()->id]);
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'assigned_to.in' => 'You can only assign tasks to yourself.',
        ];
    }
}

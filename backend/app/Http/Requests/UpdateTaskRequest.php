<?php

namespace App\Http\Requests;

class UpdateTaskRequest extends StoreTaskRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('task'));
    }

    protected function prepareForValidation(): void {}

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return array_map(
            fn (array $rules) => ['sometimes', ...$rules],
            parent::rules(),
        );
    }
}

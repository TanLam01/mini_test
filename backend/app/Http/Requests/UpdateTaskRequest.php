<?php

namespace App\Http\Requests;

class UpdateTaskRequest extends StoreTaskRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('task'));
    }

    protected function prepareForValidation(): void
    {
        // Không kế thừa việc tự gán assigned_to của Store: update thiếu field này nghĩa là giữ nguyên người được giao.
    }

    /**
     * Cho phép cập nhật từng phần: field nào gửi lên mới được validate theo rule của Store.
     *
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

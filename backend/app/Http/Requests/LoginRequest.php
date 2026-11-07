<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // not_regex chặn CRLF vì rule `email` của Laravel 11 có lỗ hổng CRLF injection (CVE-2026-48019), chưa có bản vá cho 11.x.
            'email' => ['required', 'string', 'email', 'not_regex:/[\r\n]/', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }
}

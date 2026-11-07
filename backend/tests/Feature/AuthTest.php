<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const SPA_ORIGIN = 'http://localhost:5173';

    public function test_csrf_cookie_endpoint_issues_xsrf_token(): void
    {
        $this->withHeader('Origin', self::SPA_ORIGIN)
            ->get('/sanctum/csrf-cookie')
            ->assertNoContent()
            ->assertCookie('XSRF-TOKEN');
    }

    public function test_spa_can_login_with_session_cookie(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->withHeader('Origin', self::SPA_ORIGIN)
            ->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonMissingPath('token')
            ->assertJsonMissingPath('data.password');

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->withHeader('Origin', self::SPA_ORIGIN)
            ->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertGuest('web');
    }

    public function test_login_rejects_email_with_crlf(): void
    {
        $this->withHeader('Origin', self::SPA_ORIGIN)
            ->postJson('/api/login', ['email' => "jane@example.com\r\nBcc: x@example.com", 'password' => 'password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_login_from_non_spa_origin_is_rejected(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->withHeader('Origin', 'https://evil.example.com')
            ->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])
            ->assertBadRequest();

        $this->assertGuest('web');
    }

    public function test_me_returns_current_user(): void
    {
        $user = User::factory()->admin()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.role', 'admin');
    }

    public function test_logout_ends_the_session(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->withHeader('Origin', self::SPA_ORIGIN)
            ->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])
            ->assertOk();

        $this->withHeader('Origin', self::SPA_ORIGIN)->postJson('/api/logout')->assertNoContent();

        $this->assertGuest('web');
    }

    public function test_protected_routes_require_authentication(): void
    {
        $this->getJson('/api/tasks')->assertUnauthorized();
        $this->get('/api/tasks')->assertUnauthorized();
    }
}

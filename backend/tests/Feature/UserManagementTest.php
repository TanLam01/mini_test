<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_users(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
        User::factory()->count(2)->create();

        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonMissingPath('data.0.password');
    }

    public function test_admin_can_create_user_with_role(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->postJson('/api/users', [
            'name' => 'New Admin',
            'email' => 'new@example.com',
            'password' => 'secret123',
            'role' => 'admin',
        ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'admin');

        $this->assertDatabaseHas('users', ['email' => 'new@example.com', 'role' => 'admin']);
    }

    public function test_create_user_validates_input(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['email' => 'taken@example.com']));

        $this->postJson('/api/users', ['email' => 'taken@example.com', 'password' => 'short', 'role' => 'root'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password', 'role']);
    }

    public function test_regular_user_cannot_manage_users(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/users')->assertForbidden();
        $this->postJson('/api/users', ['name' => 'X', 'email' => 'x@example.com', 'password' => 'secret123', 'role' => 'admin'])
            ->assertForbidden();
    }
}

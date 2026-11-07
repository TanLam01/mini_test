<?php

namespace Tests\Feature;

use App\Enums\TaskStatus;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TaskIndexTest extends TestCase
{
    use RefreshDatabase;

    private User $alice;

    private User $bob;

    protected function setUp(): void
    {
        parent::setUp();

        $this->alice = User::factory()->create();
        $this->bob = User::factory()->create();
        Task::factory()->count(3)->for($this->alice, 'assignee')->create(['status' => TaskStatus::Todo]);
        Task::factory()->count(2)->for($this->bob, 'assignee')->create(['status' => TaskStatus::Done]);
    }

    public function test_admin_sees_all_tasks(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/tasks')
            ->assertOk()
            ->assertJsonPath('meta.total', 5)
            ->assertJsonStructure([
                'data' => [['id', 'title', 'description', 'status', 'assigned_to', 'assignee' => ['id', 'name'], 'due_date']],
                'links',
                'meta' => ['current_page', 'per_page', 'total', 'last_page'],
            ]);
    }

    public function test_user_sees_only_own_tasks(): void
    {
        Sanctum::actingAs($this->alice);

        $response = $this->getJson('/api/tasks')->assertOk()->assertJsonPath('meta.total', 3);

        $this->assertSame([$this->alice->id], $response->collect('data')->pluck('assigned_to')->unique()->values()->all());
    }

    public function test_user_cannot_list_other_users_tasks_via_filter(): void
    {
        Sanctum::actingAs($this->alice);

        $this->getJson("/api/tasks?assigned_to={$this->bob->id}")
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }

    public function test_admin_can_filter_by_status_and_assignee(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/tasks?status=done')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson("/api/tasks?assigned_to={$this->alice->id}")->assertOk()->assertJsonPath('meta.total', 3);
        $this->getJson("/api/tasks?status=done&assigned_to={$this->alice->id}")->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_search_by_title_treats_wildcards_literally(): void
    {
        Sanctum::actingAs($this->alice);
        Task::factory()->for($this->alice, 'assignee')->create(['title' => 'Fix 100% CPU bug']);

        $this->getJson('/api/tasks?search=100%25')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/tasks?search=%25')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_pagination_respects_per_page(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/tasks?per_page=2&page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 3);
    }

    public function test_invalid_filters_are_rejected(): void
    {
        Sanctum::actingAs($this->alice);

        $this->getJson('/api/tasks?status=archived&per_page=500')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status', 'per_page']);
    }
}

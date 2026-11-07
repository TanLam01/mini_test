<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TaskCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_creates_task_assigned_to_self_by_default(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/tasks', ['title' => 'Write tests', 'due_date' => '2026-12-01'])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Write tests')
            ->assertJsonPath('data.status', 'todo')
            ->assertJsonPath('data.assigned_to', $user->id)
            ->assertJsonPath('data.due_date', '2026-12-01');

        $this->assertDatabaseHas('tasks', ['title' => 'Write tests', 'assigned_to' => $user->id]);
    }

    public function test_store_validates_input(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/tasks', ['status' => 'archived', 'due_date' => '01/12/2026'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'status', 'due_date']);
    }

    public function test_user_cannot_assign_task_to_someone_else(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $other = User::factory()->create();

        $this->postJson('/api/tasks', ['title' => 'Sneaky', 'assigned_to' => $other->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('assigned_to');
    }

    public function test_admin_can_assign_task_to_anyone(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
        $member = User::factory()->create();

        $this->postJson('/api/tasks', ['title' => 'Delegated', 'status' => 'in_progress', 'assigned_to' => $member->id])
            ->assertCreated()
            ->assertJsonPath('data.assignee.id', $member->id)
            ->assertJsonPath('data.status', 'in_progress');
    }

    public function test_show_returns_404_for_missing_task(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/tasks/999')
            ->assertNotFound()
            ->assertExactJson(['message' => 'Resource not found.']);
    }

    public function test_user_can_view_update_and_delete_own_task(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->for($user, 'assignee')->create();
        Sanctum::actingAs($user);

        $this->getJson("/api/tasks/{$task->id}")->assertOk()->assertJsonPath('data.id', $task->id);

        $this->putJson("/api/tasks/{$task->id}", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('data.status', 'done')
            ->assertJsonPath('data.title', $task->title);

        $this->deleteJson("/api/tasks/{$task->id}")->assertNoContent();
        $this->assertSoftDeleted($task);
        $this->getJson("/api/tasks/{$task->id}")->assertNotFound();
    }

    public function test_user_cannot_access_other_users_task(): void
    {
        $task = Task::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/tasks/{$task->id}")->assertForbidden();
        $this->putJson("/api/tasks/{$task->id}", ['title' => 'Hijacked'])->assertForbidden();
        $this->deleteJson("/api/tasks/{$task->id}")->assertForbidden();

        $this->assertNotSoftDeleted($task);
        $this->assertDatabaseMissing('tasks', ['title' => 'Hijacked']);
    }

    public function test_user_cannot_reassign_own_task_to_someone_else(): void
    {
        $user = User::factory()->create();
        $task = Task::factory()->for($user, 'assignee')->create();
        Sanctum::actingAs($user);

        $this->putJson("/api/tasks/{$task->id}", ['assigned_to' => User::factory()->create()->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('assigned_to');
    }

    public function test_admin_can_manage_any_task(): void
    {
        $task = Task::factory()->create();
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->putJson("/api/tasks/{$task->id}", ['title' => 'Renamed'])->assertOk()->assertJsonPath('data.title', 'Renamed');
        $this->deleteJson("/api/tasks/{$task->id}")->assertNoContent();
        $this->assertSoftDeleted($task);
    }
}

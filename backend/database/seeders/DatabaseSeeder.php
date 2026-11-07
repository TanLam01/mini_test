<?php

namespace Database\Seeders;

use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::factory()->admin()->create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
        ]);

        $members = collect([
            ['name' => 'User One', 'email' => 'user1@example.com'],
            ['name' => 'User Two', 'email' => 'user2@example.com'],
        ])->map(fn (array $attributes) => User::factory()->create($attributes));

        $members->push($admin)->each(
            fn (User $user) => Task::factory()->count(20)->for($user, 'assignee')->create()
        );
    }
}

<?php

use App\Enums\TaskStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('status', TaskStatus::values())->default(TaskStatus::Todo->value);
            // Chặn xoá user còn task để không mất dữ liệu task một cách ngầm định.
            $table->foreignId('assigned_to')->constrained('users')->restrictOnDelete();
            $table->date('due_date')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Phục vụ query phổ biến nhất: user thường lọc task của mình theo status.
            $table->index(['assigned_to', 'status']);
            $table->index('status');
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};

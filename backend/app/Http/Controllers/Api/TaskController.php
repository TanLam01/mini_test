<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexTaskRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    public function index(IndexTaskRequest $request): AnonymousResourceCollection
    {
        $tasks = Task::query()
            ->visibleTo($request->user())
            ->filter($request->validated())
            ->with('assignee')
            ->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return TaskResource::collection($tasks);
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        $task = Task::create($request->validated());

        return (new TaskResource($task->load('assignee')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Task $task): TaskResource
    {
        Gate::authorize('view', $task);

        return new TaskResource($task->load('assignee'));
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource
    {
        $task->update($request->validated());

        return new TaskResource($task->load('assignee'));
    }

    public function destroy(Task $task): Response
    {
        Gate::authorize('delete', $task);

        $task->delete();

        return response()->noContent();
    }
}

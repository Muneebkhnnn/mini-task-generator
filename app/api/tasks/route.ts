import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import {
  createTaskSchema,
  deleteTaskSchema,
  updateTaskSchema,
  type TaskStatus,
} from "@/types/task";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TaskRow extends RowDataPacket {
  id: number;
  title: string;
  status: TaskStatus;
  created_at: string;
}

function validationError(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return NextResponse.json(
    {
      error: "Validation failed",
      issues: issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export async function GET() {
  try {
    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, title, status, created_at FROM tasks ORDER BY created_at DESC, id DESC",
    );

    return NextResponse.json({ tasks: rows }, { status: 200 });
  } catch (error) {
    console.error("GET /api/tasks failed:", error);

    return NextResponse.json(
      { error: "Unable to load tasks" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = createTaskSchema.safeParse(body);

    if (!result.success) {
      return validationError(result.error.issues);
    }

    const { title, status } = result.data;

    const [insertResult] = await db.execute<ResultSetHeader>(
      "INSERT INTO tasks (title, status) VALUES (?, ?)",
      [title, status],
    );

    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, title, status, created_at FROM tasks WHERE id = ?",
      [insertResult.insertId],
    );

    return NextResponse.json({ task: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks failed:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must contain valid JSON" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create task" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = updateTaskSchema.safeParse(body);

    if (!result.success) {
      return validationError(result.error.issues);
    }

    const { id, status } = result.data;

    const [updateResult] = await db.execute<ResultSetHeader>(
      "UPDATE tasks SET status = ? WHERE id = ?",
      [status, id],
    );

    if (updateResult.affectedRows === 0) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, title, status, created_at FROM tasks WHERE id = ?",
      [id],
    );

    return NextResponse.json({ task: rows[0] }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/tasks failed:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must contain valid JSON" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to update task" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body: unknown = await request.json();
    const result = deleteTaskSchema.safeParse(body);

    if (!result.success) {
      return validationError(result.error.issues);
    }

    const { id } = result.data;

    const [deleteResult] = await db.execute<ResultSetHeader>(
      "DELETE FROM tasks WHERE id = ?",
      [id],
    );

    if (deleteResult.affectedRows === 0) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/tasks failed:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must contain valid JSON" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to delete task" },
      { status: 500 },
    );
  }
}

import { handle, json } from "@/lib/api";
import { CommitCapReached, store } from "@/lib/store";
import { toISODate } from "@/lib/parse";
import { toInput } from "./_input";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  return handle(async () => (q?.trim() ? store.search(q.trim()) : store.allTasks()));
}

export async function POST(request: Request) {
  return handle(async () => {
    const raw = await json(request);
    const { dateOrder } = await store.getTrackingSettings();
    const { input, commit } = await toInput(raw, { dateOrder, fallback: undefined });
    const task = await store.addTask(input);
    if (!commit) return task;

    try {
      return (await store.commitTask(task.id, toISODate(new Date()))) ?? task;
    } catch (error) {
      if (error instanceof CommitCapReached) return { ...task, capReached: true };
      throw error;
    }
  }, 201);
}

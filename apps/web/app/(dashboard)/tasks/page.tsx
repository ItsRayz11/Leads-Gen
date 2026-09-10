import Link from "next/link";
import { listTasks, type TaskListRow } from "../../../lib/data/tasks";
import { TaskForm, TaskStatusToggle } from "../../../components/lead/task-form";
import { Badge, type BadgeProps } from "../../../components/ui/badge";
import { formatDate } from "../../../lib/utils";

const PRIORITY_VARIANT: Record<string, BadgeProps["variant"]> = {
  low: "outline",
  normal: "default",
  high: "warning",
  urgent: "destructive",
};

function linkedEntity(task: TaskListRow): { href: string; label: string } | null {
  if (task.lead) return { href: `/leads/${task.lead.id}`, label: task.lead.company?.name ?? task.lead.title };
  if (task.company) return { href: `/companies/${task.company.id}`, label: task.company.name };
  if (task.contact) return { href: `/contacts/${task.contact.id}`, label: task.contact.name ?? "Contact" };
  return null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function TaskSection({ title, tasks }: { title: string; tasks: TaskListRow[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} ({tasks.length})
      </h2>
      <div className="rounded-lg border border-border">
        {tasks.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          tasks.map((task) => {
            const entity = linkedEntity(task);
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0"
              >
                <TaskStatusToggle id={task.id} status={task.status} />
                <span className={task.status === "completed" ? "text-muted-foreground line-through" : ""}>
                  {task.title}
                </span>
                {entity && (
                  <Link href={entity.href} className="text-xs text-primary hover:underline">
                    {entity.label}
                  </Link>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">{formatDate(task.due_date)}</span>
                  )}
                  <Badge variant={PRIORITY_VARIANT[task.priority] ?? "default"}>{task.priority}</Badge>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default async function TasksPage() {
  const tasks = await listTasks();

  const today = startOfDay(new Date());
  const overdue: TaskListRow[] = [];
  const dueToday: TaskListRow[] = [];
  const upcoming: TaskListRow[] = [];
  const noDueDate: TaskListRow[] = [];
  const completed: TaskListRow[] = [];

  for (const task of tasks) {
    if (task.status === "completed") {
      completed.push(task);
      continue;
    }
    if (!task.due_date) {
      noDueDate.push(task);
      continue;
    }
    const due = startOfDay(new Date(task.due_date));
    if (due < today) overdue.push(task);
    else if (due.getTime() === today.getTime()) dueToday.push(task);
    else upcoming.push(task);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">{tasks.length} tasks across the workspace</p>
      </div>

      <div className="rounded-lg border border-border p-3">
        <TaskForm />
      </div>

      <TaskSection title="Overdue" tasks={overdue} />
      <TaskSection title="Today" tasks={dueToday} />
      <TaskSection title="Upcoming" tasks={upcoming} />
      <TaskSection title="No due date" tasks={noDueDate} />
      <TaskSection title="Completed" tasks={completed} />
    </div>
  );
}

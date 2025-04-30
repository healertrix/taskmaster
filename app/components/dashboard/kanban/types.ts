export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskType = 'task' | 'bug' | 'feature' | 'improvement';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  assignee: {
    name: string;
    avatar: string;
  };
  reporter: {
    name: string;
    avatar: string;
  };
  dueDate: string;
  createdAt: string;
  priority: TaskPriority;
  labels: string[];
  comments: number;
  attachments: number;
  progress: number;
  subtasks: {
    total: number;
    completed: number;
  };
}

export interface Column {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

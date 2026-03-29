export interface TodayTask {
  id: string;
  title: string;
  topicTitle: string | null;
  deadline: string | null;
  status: string;
  isCompleted: boolean;
  position: number;
}

export interface TodayMaterial {
  id: string;
  title: string;
  topicTitle: string;
  type: string;
  completedAmount: number;
  totalAmount: number;
  progressPercent: number;
}

export interface TodayResponse {
  date: string;
  tasks: TodayTask[];
  currentMaterial: TodayMaterial | null;
  reflection: string | null;
}

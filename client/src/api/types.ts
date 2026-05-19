export interface Meeting {
  _id: string;
  ownerId?: string;
  title: string;
  description?: string;
  category: string;
  startTime: string;
  endTime: string;
  status: string;
  waitingRoomEnabled?: boolean;
  hasConflict?: boolean;
  conflictCount?: number;
}

export interface Task {
  _id: string;
  title: string;
  status: string;
  deadline?: string;
}

export interface Invitation {
  _id: string;
  status: string;
  meetingId: string;
}

export interface Notification {
  _id: string;
  title: string;
  content: string;
  isRead: boolean;
}

export interface DashboardPayload {
  upcomingMeetings: Meeting[];
  invitations: Invitation[];
  tasks: Task[];
  notifications: Notification[];
  meetingHistory: Meeting[];
}

export interface CalendarPayload {
  view: "day" | "week" | "month";
  start: string;
  end: string;
  meetings: Meeting[];
}

export interface ParticipantState {
  socketId: string;
  userId: string;
  name: string;
  micOn: boolean;
  cameraOn: boolean;
}

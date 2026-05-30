export interface Meeting {
  _id: string;
  ownerId?: string | { _id: string; fullName: string; email: string };
  title: string;
  description?: string;
  category: string;
  startTime: string;
  endTime: string;
  status: string;
  privacyMode?: "public" | "private";
  waitingRoomEnabled?: boolean;
  recordingEnabled?: boolean;
  recordingUrl?: string;
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
  meetingId: string | Meeting;
}

export interface InvitationWithMeeting {
  _id: string;
  status: "pending" | "accepted" | "rejected" | "maybe";
  meetingId: Meeting;
  userId: { _id: string; fullName: string; email: string } | string;
}

export interface Notification {
  _id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt?: string;
}

export interface DashboardPayload {
  ongoingMeetings: Meeting[];
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
  raisedHand?: boolean;
  raisedHandTime?: string;
}

export interface MeetingMessage {
  _id: string;
  meetingId: string;
  senderUserId?: string;
  senderName: string;
  message?: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
  sticker?: string;
  isPinned?: boolean;
  createdAt: string;
}

export interface MeetingInvitationItem {
  _id: string;
  status: "pending" | "accepted" | "rejected" | "maybe";
  userId: { _id: string; fullName: string; email: string } | string;
}

export interface WaitingRequestItem {
  socketId: string;
  userId: string;
  name: string;
  micOn: boolean;
  cameraOn: boolean;
}

export interface MeetingDetailsPayload {
  meeting: Meeting;
  messages: MeetingMessage[];
  invitations: MeetingInvitationItem[];
  waitingRequests: WaitingRequestItem[];
}

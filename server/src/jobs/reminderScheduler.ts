import cron from "node-cron";
import { InvitationModel } from "../models/invitation.model";
import { MeetingModel } from "../models/meeting.model";
import { NotificationModel } from "../models/notification.model";
import { ReminderLogModel, type ReminderType } from "../models/reminder-log.model";

interface ReminderRule {
  type: ReminderType;
  offsetMinutes: number;
  title: string;
}

const reminderRules: ReminderRule[] = [
  { type: "one_day", offsetMinutes: 24 * 60, title: "Meeting in 1 day" },
  { type: "one_hour", offsetMinutes: 60, title: "Meeting in 1 hour" },
  { type: "fifteen_minutes", offsetMinutes: 15, title: "Meeting in 15 minutes" },
  { type: "start", offsetMinutes: 0, title: "Meeting started" },
];

const shouldTriggerReminder = (startTime: Date, now: Date, offsetMinutes: number): boolean => {
  const target = startTime.getTime() - offsetMinutes * 60_000;
  return Math.abs(target - now.getTime()) <= 60_000;
};

export const startReminderScheduler = (): void => {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60_000 + 60_000);

    const meetings = await MeetingModel.find({
      startTime: { $gte: new Date(now.getTime() - 61_000), $lte: horizon },
      status: { $in: ["scheduled", "live"] },
    });

    for (const meeting of meetings) {
      for (const rule of reminderRules) {
        if (!shouldTriggerReminder(meeting.startTime, now, rule.offsetMinutes)) {
          continue;
        }

        const acceptedInvitations = await InvitationModel.find({
          meetingId: meeting.id,
          status: "accepted",
        });

        const userIds = [meeting.ownerId.toString(), ...acceptedInvitations.map((item) => item.userId.toString())];

        for (const userId of userIds) {
          const alreadySent = await ReminderLogModel.findOne({
            meetingId: meeting.id,
            userId,
            reminderType: rule.type,
          });

          if (alreadySent) {
            continue;
          }

          await NotificationModel.create({
            userId,
            title: rule.title,
            content: `${meeting.title} starts at ${meeting.startTime.toISOString()}`,
            isRead: false,
          });

          await ReminderLogModel.create({
            meetingId: meeting.id,
            userId,
            reminderType: rule.type,
            sentAt: now,
          });
        }
      }
    }
  });
};

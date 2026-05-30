"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMeetingEmailInvitation = exports.getMailerTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
let transporter = null;
const getMailerTransporter = async () => {
    if (transporter) {
        return transporter;
    }
    try {
        const testAccount = await nodemailer_1.default.createTestAccount();
        transporter = nodemailer_1.default.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }
    catch {
        transporter = nodemailer_1.default.createTransport({
            jsonTransport: true
        });
    }
    return transporter;
};
exports.getMailerTransporter = getMailerTransporter;
const sendMeetingEmailInvitation = async (toEmail, meetingTitle, startTime, meetingId) => {
    try {
        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const meetingLink = `${clientUrl}/room/${meetingId}`;
        const mailerTransporter = await (0, exports.getMailerTransporter)();
        const mailOptions = {
            from: '"GG Meet" <no-reply@ggmeet.dev>',
            to: toEmail,
            subject: `Lời mời tham gia cuộc họp: ${meetingTitle}`,
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
          <h2>Bạn nhận được lời mời tham gia cuộc họp mới!</h2>
          <p><strong>Tiêu đề:</strong> ${meetingTitle}</p>
          <p><strong>Thời gian bắt đầu:</strong> ${new Date(startTime).toLocaleString()}</p>
          <p><strong>Link tham gia:</strong> <a href="${meetingLink}" target="_blank">${meetingLink}</a></p>
          <hr />
          <p style="font-size: 12px; color: #777;">Email này được gửi tự động từ hệ thống GG Meet.</p>
        </div>
      `,
        };
        const info = await mailerTransporter.sendMail(mailOptions);
        // eslint-disable-next-line no-console
        console.log(`[MAIL SENT] Message sent: ${info.messageId}`);
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        if (previewUrl) {
            // eslint-disable-next-line no-console
            console.log(`[MAIL PREVIEW] Preview URL: ${previewUrl}`);
        }
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("[MAIL ERROR] Failed to send email invitation:", error);
    }
};
exports.sendMeetingEmailInvitation = sendMeetingEmailInvitation;
//# sourceMappingURL=mailer.js.map
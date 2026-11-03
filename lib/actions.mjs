// Executes an approved reminder: email through Brevo and WhatsApp through SmartPing, both to the participant.
import { buildReminder } from "./messages.mjs";
import { sendEmail } from "./brevo.mjs";
import { sendWhatsAppReminder } from "./smartping.mjs";
import { config } from "./config.mjs";

export async function sendApprovedReminder(finding, participant, channels) {
  const reminder = buildReminder(finding, participant, config().companyName);
  const jobs = [];
  if (channels.includes("email")) {
    jobs.push(sendEmail({ to: { email: participant.email, name: participant.name }, subject: reminder.subject, html: reminder.html, text: reminder.text })
      .then(() => ({ channel: "email", ok: true, detail: `Sent to ${participant.email}` }))
      .catch((e) => ({ channel: "email", ok: false, detail: e.publicMessage || "Email could not be sent." })));
  }
  if (channels.includes("whatsapp")) {
    jobs.push(sendWhatsAppReminder({ destination: participant.phone, templateParams: reminder.whatsappParams })
      .then(() => ({ channel: "whatsapp", ok: true, detail: `Sent to ${participant.phone}` }))
      .catch((e) => ({ channel: "whatsapp", ok: false, detail: e.publicMessage || "WhatsApp message could not be sent." })));
  }
  return Promise.all(jobs);
}

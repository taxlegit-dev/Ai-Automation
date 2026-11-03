// All configuration comes from environment variables (set in Vercel). Read lazily so tests can set them.
const env = (k, d = "") => (process.env[k] ?? d).toString().trim();

export function config() {
  return {
    companyName: "Kalindi Industrial Components (Test)",
    sessionSecret: env("SESSION_SECRET"),
    sheet: { url: env("GOOGLE_SHEET_WEBHOOK_URL"), secret: env("GOOGLE_SHEET_SECRET") },
    brevo: { apiKey: env("BREVO_API_KEY"), senderEmail: env("BREVO_SENDER_EMAIL"), senderName: env("BREVO_SENDER_NAME") },
    smartping: {
      apiKey: env("SMARTPING_API_KEY"),
      endpoint: env("SMARTPING_ENDPOINT", "https://backend.api-wa.co/campaign/smartping/api/v2"),
      campaignName: env("SMARTPING_CAMPAIGN_NAME", "overdue"),
      userName: env("SMARTPING_USER_NAME", "Taxlegit 8514"),
      source: env("SMARTPING_SOURCE", "new-landing-page form"),
    },
  };
}

// Thrown when a required setting is missing. The message is safe to show to the participant.
export class ConfigError extends Error {
  constructor(message) { super(message); this.name = "ConfigError"; this.status = 503; this.publicMessage = message; }
}

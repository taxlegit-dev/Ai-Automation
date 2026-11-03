# FlowIQ Workshop Desktop

A separate workshop environment for FlowIQ. It runs on sample data from the Kalindi Industrial Components (Test) Tally export. It does not connect to Tally, and it does not touch the production FlowIQ automation.

Participants register once. They then open the desktop, which covers the five use cases (UC1–UC5), the Action Hub, and the MIS report.

## What is included

| Area | What it does |
|---|---|
| Registration (`index.html`) | Name, email, 10-digit phone, optional designation, consent. Saves a row to a Google Sheet. |
| Desktop (`desktop.html`) | Overview, UC1–UC5 findings with evidence, Action Hub, MIS report. |
| Action Hub | Reminders go out by email (Brevo) and WhatsApp (SmartPing) to the participant's registered details, only after approval. Other actions are approved and recorded. |
| MIS (`api/mis.mjs`) | Excel, PDF, or both, generated in code and emailed to the registered address only. |
| Sample data | `data/tally_import/` is a copy of the Kalindi test export. |

## Folder layout

```
index.html            registration page
desktop.html          workshop desktop
assets/               styles and browser scripts (no secrets)
api/                  Vercel serverless functions
lib/                  analysis, Tally parser, messaging, reports, validation
data/tally_import/    sample Tally XML export
apps-script/Code.gs   Google Apps Script for the registration sheet
test/                 automated tests (npm test)
vercel.json           function settings
.env.example          all environment variable names (no values)
```

## Part 1 – Local check (optional)

1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the values. Do not commit `.env.local`.
4. Run `npm test`. All tests should pass. They use mocked services, so no messages are sent.

## Part 2 – Google Sheet registration (you do this)

1. Create a Google Sheet. Rename the first tab to `Registrations`.
2. In row 1, type these headers exactly, in this order:

   `Timestamp` | `Name` | `Email` | `Phone` | `Designation`

3. Open **Extensions → Apps Script**. Delete any existing code and paste the contents of `apps-script/Code.gs`.
4. Open **Project Settings → Script Properties → Add script property**.
   - Property: `SHARED_SECRET`
   - Value: a long random text. It must be the same value you will later set as `GOOGLE_SHEET_SECRET` in Vercel.
5. Click **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorise when asked, then copy the **Web app URL**. This is `GOOGLE_SHEET_WEBHOOK_URL`.

Send that URL to whoever is configuring Vercel, or set it yourself in Part 4.

## Part 3 – Brevo and SmartPing setup (you do this)

**Brevo (email)**
1. In Brevo, create an API key (SMTP & API → API keys).
2. Verify your sender address under Senders & IP. The sender email must be verified, or Brevo will refuse the send.
3. Keep the key and the verified sender email and display name for Part 4.

**SmartPing (WhatsApp)**
1. Confirm the approved template "Payment reminder" is live on your account.
2. Keep your API key. The campaign name (`overdue`), user name (`Taxlegit 8514`), and source (`new-landing-page form`) are already set as defaults in `.env.example`. Change them only if your account differs.
3. The endpoint is `https://backend.api-wa.co/campaign/smartping/api/v2`.

The six template parameters are sent in this order:

| Template | Value sent |
|---|---|
| {{1}} Dear | Participant's name (the recipient) |
| {{2}} reminder from | Company name |
| {{3}} ₹ amount | Overdue amount for the customer's bills (the ₹ sign is in the template) |
| {{4}} bill(s) | Bill numbers |
| {{5}} due on | Due date of the oldest bill |
| {{6}} days overdue | Days overdue for the oldest bill |

## Part 4 – Vercel deployment (you do this)

1. Push this folder to a new GitHub repository (see Part 5).
2. In Vercel, click **Add New → Project** and import the repository. Framework preset: **Other**. Build command and output directory: leave empty.
3. Before the first deploy, add these under **Settings → Environment Variables** (Production and Preview):

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | yes | Random text, 32+ characters. Signs participant sessions. |
| `GOOGLE_SHEET_WEBHOOK_URL` | yes | Web app URL from Part 2 |
| `GOOGLE_SHEET_SECRET` | yes | Same value as `SHARED_SECRET` in Apps Script |
| `BREVO_API_KEY` | yes | From Part 3 |
| `BREVO_SENDER_EMAIL` | yes | Verified sender in Brevo |
| `BREVO_SENDER_NAME` | yes | Name shown to recipients, e.g. `FlowIQ Workshop` |
| `SMARTPING_API_KEY` | yes | From Part 3 |
| `SMARTPING_ENDPOINT` | no | Default is already correct |
| `SMARTPING_CAMPAIGN_NAME` | no | Default `overdue` |
| `SMARTPING_USER_NAME` | no | Default `Taxlegit 8514` |
| `SMARTPING_SOURCE` | no | Default `new-landing-page form` |

4. Click **Deploy**. The site opens at the Vercel URL. That URL is the single workshop link for participants.
5. Register once with your own details, then approve one reminder and send one MIS report to confirm delivery.

Nothing in this repository contains credentials. All keys are read from environment variables at run time.

## Part 5 – Put the code on GitHub

1. Create an empty repository on GitHub (for example `flowiq-workshop`). Private is recommended.
2. Unzip the ZIP, open a terminal in the folder, and run:
   ```
   git init
   git add .
   git commit -m "FlowIQ workshop desktop"
   git branch -M main
   git remote add origin https://github.com/<your-account>/flowiq-workshop.git
   git push -u origin main
   ```
3. Confirm that `.env.local` and `node_modules` are not in the repository. `.gitignore` excludes them.

## How it works

- Registration validates the form, writes the row to the sheet, and returns a signed token. The browser keeps that token. Email and phone are never asked again.
- The desktop sends the token with each request. The server reads the registered email and phone from the token, so reminders and reports go only to that participant.
- Reminders and MIS are sent only after an explicit click. Each participant can send at most 30 reminders and 10 MIS emails per hour, as a safeguard against accidental repeats.
- The analysis is recalculated from the sample Tally export on the server. Nothing is read from Tally.

## Known limits of this workshop

- UC5 late-payment checks find no exposure in this sample data, so UC5 shows early-payment decisions only.
- Tally write-back (credit limits, reversals) is shown as approved and recorded, but not posted.
- The participant rate limits are per server instance. They protect against accidental repeats, not against deliberate abuse.
- Registration data is kept in the Google Sheet. Decide before the workshop how long to keep it and who can access the sheet, in line with the Digital Personal Data Protection Act, 2023.

## Consent wording

The form asks for consent with this text: "I agree that FlowIQ may use my name, email address and phone number to send me payment reminders (email and WhatsApp) and MIS reports for this workshop only." Review it with your legal or compliance contact before the workshop.

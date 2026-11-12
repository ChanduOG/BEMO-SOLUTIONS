# Website leads automation (n8n)

One n8n workflow handles the whole intake:

```
Website form ──POST──▶  n8n webhook  ──▶ Leads Google Sheet
                             │         ──▶ email alert to you
                             │         ──▶ (optional) instant "we've got it" email to the lead
Operations OS ──sync──▶ same webhook  ──▶ returns the leads (only with the CRM key)
                                          → Intake Inbox: matched, tagged, reply task due in 1 business day
```

File: [`n8n-lead-webhook.json`](n8n-lead-webhook.json). Allow about 15 minutes.

## 0. Where n8n runs

You need an n8n instance that is reachable over the internet with **https**.

| Option | Cost | Notes |
|---|---|---|
| **n8n Cloud** (n8n.io) | Paid after the free trial | Easiest. Nothing to maintain. |
| A small VPS (Hetzner, DigitalOcean, etc.) with Docker | About the cost of the smallest server | Always on. You handle updates. |
| Free/cheap app hosts (Railway, Render, etc.) | Free–low | Free tiers often *sleep*. The first request after a nap can be slow, and the form waits up to 15 seconds. |
| Your own PC + a tunnel | Free | Only works while your PC is on, so not suitable for a live website. |

Whatever you pick, leads are only received while n8n is running. If n8n is down when someone submits, the website shows an error and offers your email address as a fallback.

## 1. Prepare the Google Sheet

1. Create a spreadsheet (for example **BEMO Leads**) with a tab named exactly **Leads**.
2. Put these headers in row 1, one per column, in this order:

   `submittedAt  name  email  company  phone  industry  interests  message  source  page  referrer  utm  status`

## 2. Import the workflow

1. In n8n: **Workflows › Create › ⋯ menu › Import from File**, then choose `n8n-lead-webhook.json`.
2. Open **Read & check request**. On the line `const CRM_KEY = 'PASTE-A-LONG-RANDOM-KEY-HERE';`, replace the placeholder with a long random secret (20+ characters).
   To generate one, run this in PowerShell and copy the result:
   ```powershell
   -join ((48..57)+(97..122) | Get-Random -Count 32 | % {[char]$_})
   ```
   Keep it somewhere safe. You'll paste it into the CRM in step 5.
3. **Save to Leads sheet** and **Read Leads sheet:** create or choose a *Google Sheets* credential, paste the sheet's URL into **Document**, and make sure **Sheet** is `Leads`.
4. **Email me the lead:** choose a *Gmail* credential. Change **To** if alerts should go somewhere other than 2psbuilds@gmail.com.
5. *(Optional)* **Thank the lead (optional)** is switched off. Right-click it › **Activate** to email every lead an instant acknowledgement from your Gmail. Choose the same Gmail credential.
6. **Save**, then switch the workflow to **Active** (top right).

## 3. Copy the Production URL

Open **Website & CRM requests** and copy the **Production URL**. It looks like `https://YOUR-N8N/webhook/bemo-lead`.

Don't use the *Test* URL (`/webhook-test/…`). It only works while the editor is listening, and the CRM will reject it.

## 4. Connect the website

In `index.html` (and `site/index.html` if you deploy from that folder), paste the URL into the form:

```html
<form class="lead-form" id="leadForm" novalidate
      data-endpoint="https://YOUR-N8N/webhook/bemo-lead"
```

Publish the site and submit a test enquiry. A row should appear in the sheet and the alert email should arrive. In n8n, **Executions** shows each run.

## 5. Connect the Operations OS (CRM)

1. Open the Operations OS and go to **Intake Inbox**. Click the **plug icon** next to *Sync website leads*.
2. Paste the **Production URL** and the **CRM key** from step 2, then click **Save & sync**.
3. From then on, new leads come in when you open the app, every 10 minutes while it's open, and whenever you click **Sync website leads**. Each lead is:
   - matched to an existing client by email or company name (or a new client is created),
   - tagged with its industry, interests and likely engagement (Assessment / Build & implement / Evolution partnership),
   - given a high-priority task to reply within one business day,
   - never duplicated, even though every sync reads the whole sheet.

## How the workflow decides what to do

| Request | Route | Response |
|---|---|---|
| Website lead with a name and valid email | Save to sheet → email you → (optional) thank the lead | `{"ok":true}` |
| Missing name or invalid email | — | `400 {"ok":false,…}`, and the website shows an error |
| Hidden honeypot field filled (bot) | — | `{"ok":true}`, nothing saved |
| CRM sync with the correct key | Read sheet → list | `{"ok":true,"leads":[…]}` (newest 500) |
| CRM sync with a wrong or missing key | — | `{"ok":false,"error":"Wrong or missing key"}` |

## Good to know

- **Why the form sends `text/plain`:** browsers send a "preflight" check before cross-site JSON requests, and n8n webhooks often don't answer it, so the request gets blocked. Plain text skips that check. The workflow reads the JSON either way, so no reverse proxy is needed.
- **Allowed Origins stays `*`:** the CRM runs from a local file, so its origin is `null`. Restricting origins would block the sync. The lead list is protected by the CRM key instead. Leave that key out of screenshots and shared copies of the workflow.
- **Formula safety and phone numbers:** the sheet is written in RAW mode, so `0821234567` keeps its leading zero and text like `=HYPERLINK(…)` is stored as plain text, not run as a formula.
- **Key leaked?** Change `CRM_KEY` in the workflow, save, and paste the new key into the CRM.
- **No n8n for a while?** The CRM's **Import** button still accepts the Leads sheet as CSV or a pasted lead email. The `apps-script/` folder is a hosting-free alternative that uses the same request format, so the website and CRM work with either.

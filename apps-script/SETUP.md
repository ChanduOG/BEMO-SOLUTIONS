# Website leads with Google Apps Script (no n8n needed)

This replaces the n8n workflow. Google runs it for free, so there's nothing to host.

```
Website form ──POST──▶ Apps Script ──▶ "Leads" Google Sheet  +  email alert to you
                             ▲
Operations OS (CRM) ──sync───┘   (needs the secret key, fetches new leads into the Intake Inbox)
```

Takes about 10 minutes. You need a Google account.

## 1. Create the sheet and paste the script

1. Go to <https://sheets.new> and name the spreadsheet **BEMO Leads**.
   (Already have a Leads sheet from the n8n setup? Open that one instead. The columns are the same.)
2. In the menu, open **Extensions › Apps Script**.
3. Delete everything in `Code.gs`, then paste in the full contents of [`Code.gs`](Code.gs) from this folder.
4. At the top, check `NOTIFY_EMAIL` is the address where you want lead alerts.
5. Click **Save** (the disk icon).

### "Sorry, unable to open the file at present" when opening Apps Script?

This Google Drive error almost always means **you're signed in to more than one Google account** in this browser.
The Apps Script editor opens under your *default* account, which doesn't own the sheet. Fix it one of these ways:

- **Easiest:** open an **Incognito/InPrivate window**, sign in with only the account that owns the sheet, open the sheet, then **Extensions › Apps Script**.
- **Or:** sign out of all accounts, sign back in with the sheet's account *first* (so it becomes the default), then add your other accounts again.
- **Or create the script on its own:** go to <https://script.google.com>, click **New project**, paste in `Code.gs`, and set `SHEET_ID` at the top
  to the long ID in the sheet's address (`https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`). Check that the account shown in the top-right corner is the one that owns the sheet.

If it still fails on a work (Google Workspace) account, your admin may have switched off Apps Script. Use a personal Gmail account instead.

## 2. Run setup once

1. In the toolbar's function dropdown, choose **setup**, then click **Run**.
2. Google will ask for permission: click **Review permissions**, choose your account, then **Advanced › Go to … (unsafe) › Allow**.
   The "unsafe" warning appears because it's your own unpublished script. It asks to edit this spreadsheet and send email as you.
3. Open **Execution log** at the bottom. Copy the long **CRM key** it printed. You'll need it in step 5.
   (Lost it? Run `setup` again; it prints the same key.)

## 3. Publish it as a web app

1. Click **Deploy › New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** Website leads
   - **Execute as:** Me
   - **Who has access:** Anyone  ← required so website visitors can submit the form
4. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

Open that URL in a browser. You should see `{"ok":true,"service":"BEMO website leads"}`.
"Anyone" can only *submit* leads. Reading leads back needs the secret key.

## 4. Connect the website

In the website's `index.html` (and `site/index.html` if you deploy from that folder), find the form and paste the URL:

```html
<form class="lead-form" id="leadForm" novalidate
      data-endpoint="https://script.google.com/macros/s/XXXXXXXX/exec"
```

Publish the site, submit a test enquiry, and check that a row appears in the sheet and the email arrives.

## 5. Connect the Operations OS (CRM)

1. Open the Operations OS, then go to **Intake Inbox › Website connection** (the plug icon next to *Sync website leads*).
2. Paste the **Web app URL** and the **CRM key**, then click **Save & sync**.
3. New website leads now come in when you open the app, every 10 minutes while it's open, and whenever you click **Sync website leads**.
   Leads that are already in the inbox are skipped, so you won't get duplicates.

## Changing the script later

After editing `Code.gs`, use **Deploy › Manage deployments › (pencil) Edit › Version: New version › Deploy**.
This keeps the same URL. A *New deployment* would give you a new URL that you'd have to paste everywhere again.

## Good to know

- **Limits:** a free Google account can send about 100 emails a day. If that runs out, leads are still saved and only the email alert is skipped.
- **Key leaked?** Run `rotateCrmKey` in the editor and paste the new key into the CRM.
- **Spam:** the form's hidden honeypot field stops simple bots in the browser, and the script rejects anything without a name and a valid email.
- **Formula safety:** text that starts with `=`, `+`, `-` or `@` is stored as plain text, so it can't run as a formula in your sheet.
- **Retiring n8n:** once this works, you no longer need `n8n-lead-webhook.json`.

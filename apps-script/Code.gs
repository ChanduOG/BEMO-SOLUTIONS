/**
 * BEMO website leads — Google Apps Script (replaces the n8n workflow, no hosting needed).
 *
 * What it does
 *   1. The website form POSTs each discovery-call request here.
 *      → the lead is checked, added to the "Leads" sheet and emailed to you.
 *   2. The Operations OS (CRM) POSTs {action:"list", key:"…"} here.
 *      → it gets the leads back so they appear in the Intake Inbox automatically.
 *
 * Setup: see SETUP.md in this folder. In short: paste this file into the Leads sheet's
 * Extensions › Apps Script, set NOTIFY_EMAIL, run setup() once, then Deploy › New deployment › Web app.
 */

/** Where new-lead alerts go. */
const NOTIFY_EMAIL = '2psbuilds@gmail.com';
/**
 * Leave empty when the script is opened from the sheet (Extensions › Apps Script).
 * If you created the script at script.google.com instead, paste the spreadsheet's ID here:
 * the long part of its URL between /d/ and /edit.
 */
const SHEET_ID = '';
/** Tab name inside the spreadsheet. */
const SHEET_NAME = 'Leads';
/** Column order — same as the old n8n sheet, so an existing Leads tab keeps working. */
const HEADERS = ['submittedAt', 'name', 'email', 'company', 'phone', 'industry', 'interests', 'message', 'source', 'page', 'referrer', 'utm', 'status'];
/** How many leads the CRM receives per sync (newest first). */
const MAX_LIST = 500;

/* ------------------------------------------------------------------ */
/* Run once from the editor: creates the Leads tab and the CRM key.    */
/* ------------------------------------------------------------------ */
function setup() {
  const sheet = getSheet_();
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('CRM_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    props.setProperty('CRM_KEY', key);
  }
  // Touch MailApp so the authorisation prompt includes email permission.
  MailApp.getRemainingDailyQuota();
  Logger.log('Leads tab ready: "%s" (%s rows).', sheet.getName(), Math.max(0, sheet.getLastRow() - 1));
  Logger.log('CRM key (paste into Operations OS › Intake Inbox › Website connection):');
  Logger.log(key);
}

/** Run from the editor if the key is ever exposed: makes a new one (update it in the CRM afterwards). */
function rotateCrmKey() {
  PropertiesService.getScriptProperties().deleteProperty('CRM_KEY');
  setup();
}

/* ------------------------------------------------------------------ */
/* Web app entry points                                                */
/* ------------------------------------------------------------------ */
function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Invalid request' });
  }
  if (body.action === 'list') return listLeads_(body);
  return saveLead_(body);
}

/** A plain visit to the URL just confirms it is live. Never returns lead data. */
function doGet() {
  return json_({ ok: true, service: 'BEMO website leads' });
}

/* ------------------------------------------------------------------ */
/* Website form → sheet + email                                        */
/* ------------------------------------------------------------------ */
function saveLead_(b) {
  const name = clean_(b.name, 120);
  const email = clean_(b.email, 160);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json_({ ok: false, error: 'Name and a valid email are required' });
  if (b.website) return json_({ ok: true }); // honeypot filled → bot; pretend success

  const lead = {
    submittedAt: isoOrNow_(b.submittedAt),
    name: name,
    email: email,
    company: clean_(b.company, 160),
    phone: clean_(b.phone, 40),
    industry: clean_(b.industry, 60),
    interests: (Array.isArray(b.interests) ? b.interests : String(b.interests || '').split(','))
      .map(function (s) { return clean_(s, 40); }).filter(String).join(', '),
    message: clean_(b.message, 4000),
    source: clean_(b.source, 80),
    page: clean_(b.page, 500),
    referrer: clean_(b.referrer, 500),
    utm: JSON.stringify(b.utm && typeof b.utm === 'object' ? b.utm : {}).slice(0, 500),
    status: 'New'
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();
    const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.appendRow(head.map(function (h) {
      const v = lead[h] !== undefined ? lead[h] : '';
      // Keep phone numbers as text so a leading 0 is not dropped.
      return h === 'phone' && v ? "'" + v : safeCell_(v);
    }));
  } finally {
    lock.releaseLock();
  }

  // The lead is saved even if the email fails (e.g. daily quota reached).
  try {
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: lead.email,
      subject: 'New website lead: ' + lead.name + (lead.company ? ' (' + lead.company + ')' : ''),
      body: [
        'New discovery call request from the website.',
        '',
        'Name: ' + lead.name,
        'Email: ' + lead.email,
        'Company: ' + lead.company,
        'Phone: ' + lead.phone,
        'Industry: ' + lead.industry,
        'Interested in: ' + lead.interests,
        '',
        "What's slowing them down:",
        lead.message,
        '',
        'Submitted: ' + lead.submittedAt,
        'Page: ' + lead.page,
        '',
        'The site promises a reply within one business day.'
      ].join('\n')
    });
  } catch (err) {
    console.error('Lead email failed: ' + err);
  }
  return json_({ ok: true });
}

/* ------------------------------------------------------------------ */
/* CRM sync: sheet → Operations OS                                     */
/* ------------------------------------------------------------------ */
function listLeads_(b) {
  const key = PropertiesService.getScriptProperties().getProperty('CRM_KEY');
  if (!key || String(b.key || '') !== key) return json_({ ok: false, error: 'Wrong or missing key' });

  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  const head = rows.shift().map(function (h) { return String(h).trim(); });
  const since = b.since ? new Date(b.since) : null;

  const leads = rows.map(function (r) {
    const o = {};
    head.forEach(function (h, i) {
      let v = r[i];
      if (v instanceof Date) v = v.toISOString();
      o[h] = typeof v === 'string' ? v.replace(/^'/, '') : v;
    });
    return o;
  }).filter(function (o) {
    if (!o.email && !o.name) return false;
    if (since && !isNaN(since) && o.submittedAt && new Date(o.submittedAt) <= since) return false;
    return true;
  });

  return json_({ ok: true, count: leads.length, leads: leads.slice(-MAX_LIST) });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function getSheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet found. Open this script from the sheet (Extensions › Apps Script) or set SHEET_ID at the top.');
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  return String(v === undefined || v === null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);
}

/** Stops a visitor typing "=HYPERLINK(...)" etc. from becoming a live formula in your sheet. */
function safeCell_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function isoOrNow_(v) {
  const d = v ? new Date(v) : new Date();
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

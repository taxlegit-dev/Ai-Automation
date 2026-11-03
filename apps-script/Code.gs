/**
 * FlowIQ Workshop - registration receiver (Google Apps Script web app).
 *
 * Sheet headers (row 1, in this order):
 *   Timestamp | Name | Email | Phone | Designation
 *
 * Setup: see README.md, section "Google Sheet registration".
 * The shared secret is stored in Script Properties as SHARED_SECRET and must equal
 * GOOGLE_SHEET_SECRET in Vercel.
 */
const SHEET_NAME = 'Registrations';

function doPost(e) {
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    const data = JSON.parse(e.postData.contents);
    if (!expected || data.secret !== expected) {
      return jsonReply_({ ok: false, error: 'unauthorised' });
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    sheet.appendRow([
      data.timestamp || '',
      data.name || '',
      data.email || '',
      "'" + (data.phone || ''),   // leading apostrophe keeps the number as text
      data.designation || ''
    ]);
    return jsonReply_({ ok: true });
  } catch (err) {
    return jsonReply_({ ok: false, error: String(err) });
  }
}

function jsonReply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

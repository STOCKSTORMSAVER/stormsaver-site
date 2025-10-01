/**
 * Stormsaver Stock Tracker – Apps Script
 * - Expose a Web App endpoint to update the LIVE COUNT for a given part at a given location.
 * - Also logs each change to a 'Transactions' sheet.
 *
 * SETUP (once):
 * 1) Paste this into Extensions → Apps Script in the Google Sheet.
 * 2) Rename your sheet tab for Location A to exactly 'LOCATION A' (or change TAB_NAME below).
 * 3) Deploy: Deploy → New Deployment → Type 'Web app' → Execute as 'Me' → Who has access: 'Anyone' (or your domain).
 * 4) Copy the Web App URL and paste into the website's WEB_APP_URL.
 */
const TAB_NAME = 'LOCATION A'; // Change per location
// Column indices (1-based) matching your sheet structure:
const COL_SSID     = 2;  // 'Stormsaver ID' e.g., C100017 (appears under column B in your export)
const COL_DESC     = 4;  // Description
const COL_LOCATION = 11; // Location code like A09 (column K)
const COL_S25      = 12; // '2025 COUNT (S25)' (column L)
const COL_LIVE     = 13; // 'LIVE COUNT' (column M)
const COL_MIN      = 14; // Min
const COL_ORDERQTY = 15; // Order Qty
const COL_LEADTIME = 16; // Lead Time

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const part = String(body.part || '').trim();
    const loc  = String(body.loc || '').trim();
    const delta = Number(body.delta || 0);

    if (!part || !loc || !delta) {
      return _json({ error: 'Missing part/loc/delta' }, 400);
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(TAB_NAME);
    if (!sh) return _json({ error: 'Tab not found: ' + TAB_NAME }, 404);

    const rng = sh.getDataRange();
    const values = rng.getValues(); // 2D array
    // Find the matching row for SSID & Location
    let targetRow = -1;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][COL_SSID-1]).trim() === part && String(values[r][COL_LOCATION-1]).trim().startsWith(loc)) {
        targetRow = r + 1; // convert to 1-based row
        break;
      }
    }
    if (targetRow === -1) return _json({ error: 'Part not found at location' }, 404);

    // Read current live, apply delta
    const live = Number(sh.getRange(targetRow, COL_LIVE).getValue() || 0);
    const updated = live + delta;
    sh.getRange(targetRow, COL_LIVE).setValue(updated);

    // Log the transaction
    const log = ss.getSheetByName('Transactions') || ss.insertSheet('Transactions');
    log.appendRow([new Date(), part, loc, delta, live, updated, Session.getActiveUser().getEmail()]);

    return _json({ message: 'OK', part, loc, delta, live_before: live, live_after: updated }, 200);
  } catch (err) {
    return _json({ error: String(err) }, 500);
  }
}

function _json(obj, code){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setContent(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

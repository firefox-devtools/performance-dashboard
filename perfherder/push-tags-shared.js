// Client ID and API key from the Developer Console
const CLIENT_ID = '778447735329-qn55s6h81trk72v1eeaje7f3be36dmvi.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDmrIPR027XAVDrT7cgpqU5IFLjdRzh7tQ';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

// Info about the google spreadsheet used to store changeset metadata
const SPREADSHEET_ID = "12Goo3vq-0X0_Ay-J6gfV56pUB8GC0Nl62I4p8G-UsEA";
const INSERT_RANGE = "Data!A1:C1";
const GET_RANGE = "Data!A:D";

/**
 * Load Google API script.
 */
let gApiLoadPromise;
async function loadGoogleAPI() {
  if ("gapi" in window) {
    return;
  }
  if (gApiLoadPromise) {
    return gApiLoadPromise;
  }
  gApiLoadPromise = new Promise(resolve => {
    var script = document.createElement('script');
    script.addEventListener("load", resolve, { once: true });
    script.src = "https://apis.google.com/js/api.js";
    document.head.appendChild(script);
  });
  return gApiLoadPromise;
}

/**
 *  Load the auth2 library and API client library, then,
 *  initializes the API client library and sets up sign-in state
 *  listeners.
 */
let gApiInitPromise;
async function initClient() {
  await loadGoogleAPI();
  if ("client" in gapi) {
    return;
  }
  if (gApiInitPromise) {
    return gApiInitPromise;
  }
  gApiInitPromise = new Promise(resolve => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
      }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSignInState);

        // Handle the initial sign-in state.
        let isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
        resolve();
      });
    });
  });
  return gApiInitPromise;
}

function updateSignInState() {
  for (let iframe of document.querySelectorAll("iframe")) {
    let win = iframe.contentWindow;
    if (typeof(win.updateSignInState)) {
      try {
        win.updateSignInState();
      } catch(e) {
        console.error(e);
      }
    }
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

async function loadPushTagsInternal() {
  await initClient();
  let response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: GET_RANGE,
  });
  var range = response.result;
  if (range.values.length > 0) {
    let tags = {};
    for (i = 0; i < range.values.length; i++) {
      var row = range.values[i];
      tags[row[0]] = {
        push_id: row[0],
        type: row[1],
        bug: row[2],
        message: row[3],
      }
    }
    return tags;
  } else {
    return {};
  }
}
let gPushTagsPromise;
function loadPushTags() {
  if (gPushTagsPromise) {
    return gPushTagsPromise;
  }
  gPushTagsPromise = loadPushTagsInternal();
  return gPushTagsPromise;
}

/**
 * Create a new row of DAMP push information in the spreadsheet
 */
function submitNewPushData({push_id, type, bug, message}) {
  let values = [[push_id, type, bug, message]];
  return gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: INSERT_RANGE,
    insertDataOption: "INSERT_ROWS",
    resource: JSON.stringify({ values }),
    valueInputOption: "USER_ENTERED",
  }).then(response => console.log("submit data success", response),
    error => console.error("submit data error", error));
}

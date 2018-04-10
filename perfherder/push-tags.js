/**
 * This file implements the form shown on right click against changeset circles.
 * And allows to retrive the "push tags". Some metadata about each push to help
 * understanding the evolution of each graph. These metadata is created via this form.
 *
 * This feature relies on google spreadsheets.
 * It requires OAuth authentification when pushing data, while it does not for reading.
 */

// Client ID and API key from the Developer Console
const CLIENT_ID = '778447735329-qn55s6h81trk72v1eeaje7f3be36dmvi.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDmrIPR027XAVDrT7cgpqU5IFLjdRzh7tQ';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

// List of flag types
const TAG_TYPES = ["devtools", "platform", "damp", "hardware"];

// Info about the google spreadsheet used to store changeset metadata
const SPREADSHEET_ID = "12Goo3vq-0X0_Ay-J6gfV56pUB8GC0Nl62I4p8G-UsEA";
const INSERT_RANGE = "Data!A1:C1";
const GET_RANGE = "Data!A:D";

/**
 * Create the DOM elements related to the popup displaying the metadata form
 */
let formPopup, formDiv, formSignin, formPushID;
function createFormPopup() {
  formPopup = d3.select("body").append("div")
    .attr("class", "form")
    .style("opacity", 0);

  formSignin = formPopup.append("button")
    .text("Sign in into Google Docs")
    .on("click", handleAuthClick);

  formDiv = formPopup.append("div");
  formDiv.append("label").text("Push ID:");
  formPushID = formDiv.append("span");
  formDiv.append("label").text("Bug number:");
  let formBug = formDiv.append("input").property("type", "text").property("size", "8");
  formDiv.append("label").text("Type:");
  let formType = formDiv.append("select");
  formType.selectAll("option")
    .data(TAG_TYPES)
    .enter()
    .append("option")
    .text(function(d) { return d; });
  formDiv.append("input")
    .property("type", "submit")
    .on("click", () => {
      submitNewPushData({
        push_id: formPushID.text(),
        type: formType.node().value,
        bug: formBug.node().value,
        message: "",
      });
      hideFormPopup();
    });
}

/**
 * React to click event happening while the popup is displayed
 */
function clickWhileFormIsVisible(event) {
  if (formPopup.node().contains(event.target)) {
    return;
  }
  hideFormPopup();
}

function hideFormPopup() {
  window.removeEventListener("mousedown", clickWhileFormIsVisible);
  formPopup.transition()
    .duration(500)
    .style("opacity", 0);
}

function updateSignInState() {
  let isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
  if (isSignedIn) {
    formSignin.style("display", "none");
    formDiv.style("display", "");
  } else {
    formSignin.style("display", "");
    formDiv.style("display", "none");
  }
}

function showFormPopup(circle, data) {
  // Force loading Google Doc API on popup show
  // In order to be ready when clicking on Sign-in button
  initClient();

  if (!formPopup) {
    createFormPopup();
  }
  window.addEventListener("mousedown", clickWhileFormIsVisible);

  updateSignInState();

  formPopup.transition()
     .duration(200)
     .style("opacity", 1);
  let x = 60 + parseInt(d3.select(circle).attr("cx"));
  let y = parseInt(d3.select(circle).attr("cy"));
  let tooltipWidth = 240;
  if (x + tooltipWidth > window.innerWidth) {
    x -= tooltipWidth + 20;
  }
  formPopup
     .style("left", x + "px")
     .style("top", y + "px");
  formPushID.text(data.push_id);
}

/**
 *  Load the auth2 library and API client library, then,
 *  initializes the API client library and sets up sign-in state
 *  listeners.
 */
let gDocInited = false;
function initClient() {
  if (gDocInited) {
    return Promise.resolve();
  }
  gDocInited = true;
  return new Promise(resolve => {
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
        console.log("google doc API initialized", "isSignedIn", isSignedIn);
        resolve();
      });
    });
  });
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

function loadPushTags() {
  return initClient().then(resolve => {
    return gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: GET_RANGE,
    }).then(function(response) {
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
        console.log("push tags", tags);
        return tags;
      } else {
        return {};
      }
    }, function(response) {
      console.log("error while fetching push tags", response);
      return {};
    });
  });
}

/**
 * Create a new row of DAMP push information in the spreadsheet
 */
function submitNewPushData({push_id, type, bug, message}) {
  let values = [[push_id, type, bug, message]];
  console.log("submit new data", values);
  return gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: INSERT_RANGE,
    insertDataOption: "INSERT_ROWS",
    resource: JSON.stringify({ values }),
    valueInputOption: "USER_ENTERED",
  }).then(response => console.log("submit data success", response),
    error => console.error("submit data error", error));
}

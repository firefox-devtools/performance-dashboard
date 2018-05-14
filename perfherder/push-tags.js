/**
 * This file implements the form shown on right click against changeset circles.
 * And allows to retrive the "push tags". Some metadata about each push to help
 * understanding the evolution of each graph. These metadata is created via this form.
 *
 * This feature relies on google spreadsheets.
 * It requires OAuth authentification when pushing data, while it does not for reading.
 */

// List of flag types
const TAG_TYPES = ["devtools", "platform", "damp", "hardware"];

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
  let isSignedIn = "gapi" in top ? top.gapi.auth2.getAuthInstance().isSignedIn.get() : false;
  if (isSignedIn) {
    formSignin.style("display", "none");
    formDiv.style("display", "");
  } else {
    formSignin.style("display", "");
    formDiv.style("display", "none");
  }
}

function showFormPopup(circle, data) {
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
 * Evaluate "push-tags-shared.js" into the parent document (if available, otherwise the current document).
 * That, to load Google API only once and fetch spreadsheet data also once.
 */
if (!top.document.getElementById("push-tags-shared")) {
  let script = top.document.createElement('script');
  script.id = "push-tags-shared";
  script.addEventListener("load", () => {
    window.handleAuthClick = top.handleAuthClick;
    window.loadPushTags = top.loadPushTags;
    window.submitNewPushData = top.submitNewPushData;
  }, { once: true });
  let rootURL = location.href.replace(/\/(tools|perfherder).+$/, "/");
  script.src = rootURL + "perfherder/push-tags-shared.js";
  top.document.head.appendChild(script);
} else {
  (async function () {
    let script = top.document.getElementById("push-tags-shared");
    if (!("loadPushTags" in top)) {
      await new Promise(resolve => {
        script.addEventListener("load", resolve, { once: true });
      });
    }
    window.handleAuthClick = top.handleAuthClick;
    window.submitNewPushData = top.submitNewPushData;
  })();
}

async function loadPushTags() {
  let script = top.document.getElementById("push-tags-shared");
  if (!("loadPushTags" in top)) {
    await new Promise(resolve => {
      script.addEventListener("load", resolve, { once: true });
    });
  }
  return top.loadPushTags();
}

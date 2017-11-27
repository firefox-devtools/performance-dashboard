function selectDays() {
  let days = document.getElementById("days").selectedOptions[0].value;
  pushState({
    days
  });
}
function updateFilterStddev() {
  let filterstddev = document.getElementById("filter-stddev").checked;
  pushState({
    filterstddev
  });
}
function pushState(newState) {
  let state = Object.assign(history.state || {}, newState);

  let u = new URL(window.location);
  let params = u.searchParams;
  for (let key in state) {
    params.set(key, state[key]);
  }

  history.replaceState(state, null, u.href);

  onStateUpdated();
}
function onStateUpdated() {
  let state = history.state;
  if (!state) {
    return;
  }
  
  let { days, filterstddev } = state;
  for (let iframe of document.querySelectorAll("iframe")) {
    let url = new URL(iframe.src);
    url.searchParams.set("days", days);
    url.searchParams.set("filterstddev", filterstddev);
    iframe.src = url.href;
  }
  let daysSelect = document.getElementById("days");
  restoreSelect(daysSelect, days);
  let filter = document.getElementById("filter-stddev");
  filter.checked = !!filterstddev;
}
window.addEventListener("DOMContentLoaded", function () {
  createStddevToggle();
  createDaysSelector();

  if (!history.state) {
    // Default values when you first open the page
    let state = {
      days: 14,
      filterstddev: true,
    };
    for (let [key, value] of new URL(window.location).searchParams.entries()) {
      state[key] = value;
    }
    pushState(state);
  } else {
    onStateUpdated();
  }
});

function createDaysSelector() {
  let select = document.createElement("select");
  select.id = "days";
  select.style.float = "right";
  select.onchange = selectDays;
  let options = {
    1: "day",
    2: "2 days",
    7: "one week",
    14: "two weeks",
    30: "month",
    60: "two monthes",
    90: "three monthes",
    365: "year"
  };
  for (let days in options) {
    let option = document.createElement("option");
    option.value = days;
    option.innerHTML = options[days];
    select.add(option);
  }
  let h1 = document.querySelector("h1");
  h1.parentNode.insertBefore(select, h1);
}
function createStddevToggle() {
  let label = document.createElement("label");
  label.style.float = "right";
  let toggle = document.createElement("input");
  toggle.id = "filter-stddev";
  toggle.type = "checkbox";
  toggle.onchange = updateFilterStddev;
  label.appendChild(toggle);
  label.appendChild(document.createTextNode("Filter out noise"));
  let h1 = document.querySelector("h1");
  h1.parentNode.insertBefore(label, h1);
}
// Select the <option> with given `value` for the given <`select`>
function restoreSelect(select, value = "") {
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value == value) {
      select.selectedIndex = i;
    }
  }
}

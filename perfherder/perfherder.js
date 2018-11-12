let PerfHerderTimings = {
  1: 86400, // last day
  2: 172800, // last 2 days
  7: 604800, // last week
  14: 1209600, // last two weeks
  30: 2592000, // last month
  60: 5184000, // last two months
  90: 7776000, // last three months
  365: 31536000, // last year
};
function buildTreeHerderURL({ interval, signature, framework }) {
  let url = "https://treeherder.mozilla.org/api/project/mozilla-central/performance/data/" +
    "?format=json&framework=" + framework + "&interval=" + interval + "&signatures=" + signature;
  return url;
}
async function getPushIdRevision(push_id, callback) {
  let url = "https://treeherder.mozilla.org/api/project/mozilla-central/resultset/" + push_id + "/";
  let { revision } = await fetchJSON(url);
  return revision;
}
async function getTooltip(metadata, to, from) {
  if (metadata) {
    let msg = `<br />${metadata.type}`;
    if (metadata.message) {
      msg += `: ${metadata.message}`;
    }
    if (metadata.bug) {
      msg += ` - <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=${metadata.bug}">Bug ${metadata.bug}</a>`;
    }
    return msg;
  }
  return `<div class="push-id">push id: ${to.push_id}</div>`;
}
async function getLink({ push_id: to_push_id }, { push_id: from_push_id }) {
  let from_revision = await getPushIdRevision(from_push_id);
  let to_revision = await getPushIdRevision(to_push_id);
  let url = "https://hg.mozilla.org/mozilla-central/pushloghtml?fromchange=" + from_revision + "&tochange=" + to_revision;
  return url;
}
async function fetchObsoleteTests(old_signatures, interval, data) {
  let oldestTime = new Date().getTime() - ( interval * 1000 );
  for (let { id, signature, framework, before } of old_signatures) {
    console.log("old signature", signature, "id", id, before > oldestTime);
    if (before > oldestTime) {
      let url = buildTreeHerderURL({ interval, signature, framework });
      let response = await fetchJSON(url);
      if (response && response[signature]) {
        data.push(...response[signature]);
      }
    }
  }
}

/**
 * Helper to ignore changesets with flags related to baseline changes
 * that should be ignored, like hardware changes, test changes leading to
 * increase/decrease of its runtime, ...
 *
 * A side effect of this method is that the value is completely arbitrar.
 * Only change percentage is meaningful.
 */
const FLAGS_TO_IGNORE = ["hardware", "damp"];
const BASELINE_VALUE = 1000;
function filterOutIgnoredFlags(data, pushTags) {
  let data2 = [];
  let lastFlattenValue = null;
  let lastRealValue = null;
  for (let d of data) {
    let value;
    if (lastFlattenValue === null) {
      value = BASELINE_VALUE;
    } else {
      let metadata = pushTags[d.push_id];
      if (metadata && FLAGS_TO_IGNORE.includes(metadata.type)) {
        value = lastFlattenValue;
      } else {
        let previous = lastRealValue;
        let current = d.value;
        let factor = ( current - previous ) / previous;
        value = lastFlattenValue + ( lastFlattenValue * factor );
      }
    }
    let copy = Object.assign({}, d);
    copy.value = value;
    data2.push(copy);
    lastFlattenValue = value;
    lastRealValue = d.value;
  }
  return data2;
}

function filterNoise(params, data) {
  // Compute standard deviation (i.e. the typical average difference between two points)
  let sumdev = 0;
  data.forEach((d, i) => {
    if (i > 0) {
      sumdev += Math.abs(d.value - data[i-1].value);
    }
  });
  let stddev = sumdev / data.length;
  console.log("stddev", stddev);

  // Then remove every point that is `maxstddev` times different compared to its
  // previous and next point
  let maxstddev = 3;
  if (params.has("maxstddev")) {
    maxstddev = parseInt(params.get("maxstddev"));
  }
  let filterstddev = false;
  if (params.has("filterstddev")) {
    filterstddev = params.get("filterstddev") == "true"
  }
  return data.filter((d, i) => {
    if (i > 0 && i < data.length -1) {
      let previous = data[i - 1].value;
      let next = data[i+1].value;
      let diffPrevious = Math.abs(d.value - previous);
      let diffNext = Math.abs(next - d.value);
      if (diffPrevious > maxstddev * stddev && diffNext > maxstddev * stddev) {
        if (filterstddev) {
          return false;
        } else {
          d.color = "lightgray";
          return true;
        }
      }
    }
    return true;
  });
}

async function loadPerfHerder({ interval, platform, ignoreFlags, params, test }) {
  let signatures = PerfHerderSignatures[test]
  if (!signatures) {
    throw new Error("Unable to find any DAMP test named '" + test + "'");
  }
  let signature = signatures.platforms[platform].signature;
  if (!signature) {
    throw new Error("Unable to find test '" + test + "' for platform '" + platform + "'");
  }
  let perfHerderId = signatures.platforms[platform].id;
  let framework = signatures.platforms[platform].framework;
  console.log("signature", signature, "id", perfHerderId, "framework", framework);
  let url = buildTreeHerderURL({ interval, signature, framework });

  document.getElementById("loading").style.display = "block";
  let data = [];

  let tagsRequest = loadPushTags();

  let { old_signatures } = signatures.platforms[platform];
  await fetchObsoleteTests(old_signatures, interval, data);

  let perfHerderRequest = fetchJSON(url);

  let response = await perfHerderRequest;

  data.push(...response[signature]);

  data.sort((d1, d2) => d1.push_timestamp > d2.push_timestamp);

  data = filterNoise(params, data);

  const pushTags = await tagsRequest;

  if (ignoreFlags) {
    data = filterOutIgnoredFlags(data, pushTags);
  }

  let i = 0;
  for (let d of data) {
    d.date = new Date(d.push_timestamp * 1000);
    let metadata = pushTags[d.push_id];
    d.getTooltip = getTooltip.bind(null, metadata, d, data[i - 1]);
    d.getLink = getLink.bind(null, d, data[i - 1]);
    if (metadata) {
      let isRegression = !data[i -1 ] ? true : d.value > data[i - 1].value;
      switch(metadata.type) {
        case "platform":
          d.fill = isRegression ? "orange" : "lightgreen";
          break;
        case "devtools":
          d.fill = isRegression ? "red" : "green";
          break;
        case "hardware":
          d.fill = isRegression ? "gray" : "lightgray";
          break;
        case "damp":
          d.fill = isRegression ? "blue" : "lightblue";
          break;
       }
    }
    i++;
  }

  console.log("perfherder data", data);
/*
  let settleData = null;
  if (PerfHerderSignatures[test + ".settle"]) {
    signatures = PerfHerderSignatures[test + ".settle"]
    signature = signatures.platforms[platform].signature;
    perfHerderId = signatures.platforms[platform].id;
    framework = signatures.platforms[platform].framework;
    console.log("signature settle", signature, "id", perfHerderId);
    url = buildTreeHerderURL({ interval, signature, framework });
    response = await fetchJSON(url);
    settleData = response[signature];
    console.log("settle perfherder data", settleData);

    settleData.forEach((d, i) => {
      d.date = new Date(d.push_timestamp * 1000);
      d.getTooltip = getTooltip.bind(null, d, data[i - 1]);
      d.getLink = getLink.bind(null, d, data[i - 1]);
    });
  }
  */

  document.getElementById("loading").style.display = "none";
  let g = graph(data, {
    displayAverageLine: true,
    //cummulativeData: settleData,
  });

  // Display a link to PerfHerder
  // With graph for the test with its current name and flags
  let series = ["series=mozilla-central," + perfHerderId + ",1," + framework]
  // But also any old, different one it may have had in the past
  for (let { id } of old_signatures) {
    series.push("series=mozilla-central," + id + ",1,1");
  }
  let perfHerderLink = "https://treeherder.mozilla.org/perf.html#/graphs?timerange=" + interval + "&" + series.join("&");
  g.append("a")
   .attr("xlink:href", perfHerderLink)
   .attr("target", "_blank")
   .append("text")
   .attr("x", 10)
   .attr("y", 10)
   .text("PerfHerder");
}

function update() {
  let params = new URL(window.location).searchParams;
  if (!params.get("test")) {
    return;
  }
  let interval = PerfHerderTimings[params.get("days") || 14];
  let platform = params.get("platform") || "windows7-32-opt";
  let ignoreFlags = params.get("ignore-flags") === "true";
  loadPerfHerder({
    interval,
    platform,
    ignoreFlags,
    params,
    test: params.get("test"),
  });
}

window.addEventListener("load", update);
window.addEventListener("resize", update);
window.addEventListener("popstate", update);

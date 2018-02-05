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
function buildTreeHerderURL({ interval, signature }) {
  let url = "https://treeherder.mozilla.org/api/project/mozilla-central/performance/data/" +
    "?format=json&framework=1&interval=" + interval + "&signatures=" + signature;
  return url;
}
async function getPushIdRevision(push_id, callback) {
  let url = "https://treeherder.mozilla.org/api/project/mozilla-central/resultset/" + push_id + "/";
  let { revision } = await fetchJSON(url);
  return revision;
}
async function getTooltip({ push_id: to_push_id }, { push_id: from_push_id }) {
  let from_revision = await getPushIdRevision(from_push_id);
  let to_revision = await getPushIdRevision(to_push_id);
  let url = "https://hg.mozilla.org/mozilla-central/pushloghtml?fromchange=" + from_revision + "&tochange=" + to_revision;
  return "<a href=\"" + url + "\" target=\"_blank\">" + to_revision.substr(0, 6) + "</a>";
}
async function getLink({ push_id: to_push_id }, { push_id: from_push_id }) {
  let from_revision = await getPushIdRevision(from_push_id);
  let to_revision = await getPushIdRevision(to_push_id);
  let url = "https://hg.mozilla.org/mozilla-central/pushloghtml?fromchange=" + from_revision + "&tochange=" + to_revision;
  return url;
}
async function loadPerfHerder({ interval, platform, test }) {
  let signatures = PerfHerderSignatures[test]
  if (!signatures) {
    throw new Error("Unable to find any DAMP test named '" + test + "'");
  }
  let signature = signatures.platforms[platform].signature;
  if (!signature) {
    throw new Error("Unable to find test '" + test + "' for platform '" + platform + "'");
  }
  let perfHerderId = signatures.platforms[platform].id;
  console.log("signature", signature, "id", perfHerderId);
  let url = buildTreeHerderURL({ interval, signature });

  document.getElementById("loading").style.display = "block";

  let response = await fetchJSON(url);
  let data = response[signature];
  console.log("perfherder data", data);

  data.forEach((d, i) => {
    d.date = new Date(d.push_timestamp * 1000);
    d.getTooltip = getTooltip.bind(null, d, data[i - 1]);
    d.getLink = getLink.bind(null, d, data[i - 1]);
  });

  document.getElementById("loading").style.display = "none";
  let g = graph(data, {
    displayAverageLine: true,
  });

  // Display a link to PerfHerder
  let perfHerderLink = "https://treeherder.mozilla.org/perf.html#/graphs?timerange=" + interval + "&series=mozilla-central," + perfHerderId+ ",1,1";
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
  loadPerfHerder({
    interval,
    platform,
    test: params.get("test"),
  });
}

window.addEventListener("load", update);
window.addEventListener("resize", update);
window.addEventListener("popstate", update);

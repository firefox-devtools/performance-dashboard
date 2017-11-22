async function fetchDates(channel) {
  let url = "https://aggregates.telemetry.mozilla.org/aggregates_by/build_id/channels/" + channel + "/dates/";
  let response = await fetchJSON(url);
  return response;
}

async function fetchTelemetry({ channel = "nightly", days, metric }) {
  // Fetch all the available dates for the given channel
  let dates = await fetchDates(channel);

  // Take the last ${days} dates and only consider the latest version
  let dateList = [];
  let versions = new Set();
  for (let i = 0; i < days; i++) {
    let d = dates[i];
    dateList.push(d);
    versions.add(d.version);
  }

  let buckets = [], data = [];
  versions = [...versions].sort().reverse();
  for (let version of versions) {
    let list = dateList.filter(d => d.version == version).map(d => d.date);
    let url = "https://aggregates.telemetry.mozilla.org/aggregates_by/build_id/channels/" + channel + "/?version=" + version +
      "&dates=" + list.join(",") + "&metric=" + metric;
    console.log("telemetry url", url);
    let response = await fetchJSON(url);
    buckets = buckets.concat(response.buckets);
    data = data.concat(response.data);
  }
  return { buckets, data };
}
async function loadTelemetry({ days = 12, metric = "DEVTOOLS_COLD_TOOLBOX_OPEN_DELAY_MS", histogramKey = "jsdebugger"}) {
  document.getElementById("loading").style.display = "block";

  let { buckets, data } = await fetchTelemetry({ days, metric });
  console.log(buckets, data);
  data = data.filter(d => !d.label || d.label == histogramKey)
    .map(d => {
      let l = d.histogram.length;
      let total = 0, totalCount = 0;
      //console.log(d.date)
      for (let i = 0; i < l; i++) {
        let count = d.histogram[i];
        let bucketStart = buckets[i];
        let bucketEnd = buckets[i+1] ? buckets[i+1] : bucketStart;
        let bucketMiddle = bucketStart + (bucketEnd - bucketStart) / 2;
        total += bucketMiddle * count;
        totalCount += count;
        //console.log(i, "=", bucketMiddle, "*", count);
      }
      //console.log("total", total, "count", totalCount, "avg", total/totalCount)
      let m = d.date.match(/(\d{4})(\d{2})(\d{2})/);
      let date = m[1] + "-" + m[2] + "-" + m[3];
      return { date: new Date(date), value: Math.round(total / totalCount) };
    });
  document.getElementById("loading").style.display = "none";
  graph(data);
}
function update() {
  let params = new URL(window.location).searchParams;
  if (!params.get("histogramKey")) {
    return;
  }
  loadTelemetry({
    histogramKey: params.get("histogramKey"),
    metric: params.get("metric"),
    days: params.get("days"),
  });
}

window.addEventListener("load", update);
window.addEventListener("resize", update);
window.addEventListener("popstate", update);

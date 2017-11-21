function buildTelemetryURL({ version, days, metric }) {
  // Build telemetry URL
  let d = new Date();
  d.setDate(d.getDate() - 2);
  let dates = [];
  for (let i = 0; i < days; i++) {
    let yyyymmdd = d.toISOString().split('T')[0].replace(/-/g,"");
    dates.push(yyyymmdd);
    d.setDate(d.getDate() - 1);
  }
  let url = "https://aggregates.telemetry.mozilla.org/aggregates_by/build_id/channels/nightly/?version=" + version +
    "&dates=" + dates.join(",") + "&metric=" + metric;// + "&application=Firefox";
  return url;
}
async function loadTelemetry({ version = 58, days = 12, metric = "DEVTOOLS_COLD_TOOLBOX_OPEN_DELAY_MS", histogramKey = "jsdebugger"}) {
  let url = buildTelemetryURL({ version, days, metric });
  console.log("telemetry url", url);

  document.getElementById("loading").style.display = "block";

  let response = await fetchJSON(url);
  let { buckets } = response;
  let data = response.data.filter(d => !d.label || d.label == histogramKey)
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

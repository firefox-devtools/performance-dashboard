async function getRevisionInfo(revision) {
  let url = `https://treeherder.mozilla.org/api/project/try/resultset/?revision=${revision}`;
  let { results } = await fetchJSON(url);
  return {
    id: results[0].id,
    message: results[0].revisions[0].comments
  };
}

// APIs to fetch full data, absolutely all tests results.
async function getJobs(push, signature) {
  let url = `https://treeherder.mozilla.org/api/project/try/performance/data/?push_id=${push}&signatures=${signature}`
  let data = await fetchJSON(url);
  if (!data || !data[signature]) {
    console.error(url, data);
    return [];
  }
  let jobs = [];
  for (let { signature_id, value, job_id, id, push_id } of data[signature]) {
    jobs.push(job_id);
  }
  return jobs;
}
async function getTestReplicates(results, push_id, signature, max_jobs) {
  let jobs = await getJobs(push_id, signature);
  let x = 0;
  for(let job_id of jobs) {
    if (x++ >= max_jobs) {
      break;
    }
    let url = `https://treeherder.mozilla.org/api/jobdetail/?job_id=${job_id}&value=perfherder-data.json`
    let data = await fetchJSON(url);
    if (!data || !data.results[0]) {
      console.error(url, data);
      continue;
    }
    url = data.results[0].url;
    data = await fetchJSON(url);
    if (!data || !data.suites || !data.suites[0]) {
      console.error(url, data);
      continue;
    }

    for (let test of data.suites[0].subtests) {
      let { name, replicates, value } = test;
      if (!results[name]) {
        results[name] = {};
      }
      if (!results[name][push_id]) {
        results[name][push_id] = { values: [], replicates: [] };
      }
      results[name][push_id].values.push(value);
      results[name][push_id].values.sort(function (a, b) { return a - b; });
      for (let v of replicates) {
        results[name][push_id].replicates.push(v);
      }
      results[name][push_id].replicates.sort(function (a, b) { return a - b; });
    }
  }
  return results;
}

/**
 * APIs to use when fetching only Talos datapoints (i.e. only the summary of each job run and not the full tests data)

async function getTests(signature) {
  let url = "https://treeherder.mozilla.org/api/project/try/performance/signatures/?framework=1&parent_signature=" + signature;
  let data = await fetchJSON(url);
  let subtests = [];
  for (let subtest_signature in data) {
    let { test, id } = data[subtest_signature];
    subtests.push({
      name: test,
      id,
      signature: subtest_signature
    });
  }
  return subtests;
}
async function getTestsResults(signature, push_a, push_b) {
  let tests = await getTests(signature);
  let signatures = tests.filter(({ name }) => {
    return !name.includes(".close.") && !name.includes("settle") && name.match(/webconsole|inspector|debugger|netmonitor/);
  }).map(({ id }) => "signature_id=" + id).join("&");
  let url = `https://treeherder.mozilla.org/api/project/try/performance/data/?framework=1&push_id=${push_a}&push_id=${push_b}&${signatures}`;
  let data = await fetchJSON(url);
  let results = {};
  for (let { id, name, signature } of tests) {
    let res = data[signature];
    if (!res) continue;
    for (let { push_id, value, id, job_id, signature_id } of res) {
      if (!results[name]) {
        results[name] = {};
      }
      if (!results[name][push_id]) {
        results[name][push_id] = [];
      }
      results[name][push_id].push(value);
      results[name][push_id].sort();
    }
  }
  return { results };
}
*/

function displayForm() {
  let form = document.getElementById("form");
  form.style.display = "block";
}

async function main() {
  // This is DAMP signature for linux
  let params = new URL(window.location).searchParams;
  let platform = params.get("platform") || "windows7-32-opt";
  let test = params.get("test") || "summary";
  let signatures = PerfHerderSignatures[test]
  let signature = signatures.platforms[platform].signature;
  let jobs = params.get("jobs") || 100;
  let ignore_close_settle = params.get("ignore") || false;

  let base_revision = params.get("base");
  let new_revision = params.get("new");
  if (!base_revision || !new_revision) {
    displayForm();
    document.getElementById("loading").remove();
    return;
  }
  let { id: base_push_id, message: base_message } = await getRevisionInfo(base_revision);
  let { id: new_push_id, message: new_message } = await getRevisionInfo(new_revision);

  //let results = await getTestsResults(signature, base_push_id, new_push_id);
  let results = {};
  let base_results = await getTestReplicates(results, base_push_id, signature, jobs);
  let new_results = await getTestReplicates(results, new_push_id, signature, jobs);

  document.getElementById("loading").remove();

  let perfherder_link = `https://treeherder.mozilla.org/perf.html#/comparesubtest?originalProject=try&originalRevision=${base_revision}&newProject=try&newRevision=${new_revision}&originalSignature=${signature}&newSignature=${signature}&framework=1`;
  
  // Print base and new revision commit messages
  let title = document.createElement("h3");
  base_message = base_message.split("\n")[0];
  new_message = new_message.split("\n")[0];
  title.appendChild(document.createTextNode(`Comparing "${base_message}" with "${new_message}"`));
  title.appendChild(document.createTextNode(` `));
  let link = document.createElement("a");
  link.textContent = "[Perfherder]";
  link.href = perfherder_link;
  link.style.fontSize = "10px";
  link.style.color = "gray";
  link.target = "_blank";
  title.appendChild(link);
  document.getElementById("content").appendChild(title);
  
  let table = document.createElement("table");
  table.style.width="100%";
  table.setAttribute("cellspacing", "0");

  let summary = {}; 

  let x = 0;
  for (let test in results) {
    if (ignore_close_settle && (test.includes(".settle") || test.includes(".close"))) {
      continue;
    }
    let base_results = results[test][base_push_id];
    let new_results = results[test][new_push_id];
    if (!base_results || !new_results) {
      // /!\ may be one of the two runs has some results
      // should display one run results without comparison
      continue;
    }

    let tr = document.createElement("tr");
    tr.classList.add(x++ % 2 == 0 ? "odd": "even");

    let td = document.createElement("td");
    let name = test.replace(".DAMP", "");
    td.textContent = name;
    tr.appendChild(td);

    td = document.createElement("td");
    let base_stats = calcBoxStats(base_results.replicates);
    let new_stats = calcBoxStats(new_results.replicates);
    const compares = [{
        title: "perfherder",
        base_values: base_results.values,
        new_values: new_results.values,
      },
      {
        title: "everything",
        base_values: base_results.replicates,
        new_values: new_results.replicates,
      },
      {
        title: "light-filtered",
        base_values: lightStripNoise(base_results.replicates, base_stats),
        new_values: lightStripNoise(new_results.replicates, new_stats),
      },
    ];
    for (let {title, base_values, new_values} of compares) {
      let div = document.createElement("div");
      base_stats = calcBoxStats(base_values);
      new_stats = calcBoxStats(new_values);
      let svg = createBoxPlot([{
        title: "base",
        values: base_values,
        stats: base_stats,
      }, {
        title: "new",
        values: new_values,
        stats: new_stats,
      }]);
      div.appendChild(svg.node());
      let span = document.createElement("span");
      span.style.display = "inline-block";
      span.style.marginLeft = "10px";

      function diff(name, base_v, new_v, suffix = "") {
        let percent = ( (new_v - base_v) / base_v) * 100;
        let string = name + ": " + round(base_v) + suffix;
        string += " - ";
        let report = name != "stddev" && name != "ci" && Math.abs(percent) > base_stats.stddevPercent && Math.abs(percent) > new_stats.stddevPercent;
        if (report) {
          let color = percent > 0 ? "green" : "red";
          string += `<span style="font-weight: bold; color: ${color}">`
        }
        string += (percent > 0 ? "+" : "") + round(percent) + "%";
        if (report) {
          string += "</span>";
        }
        string += " -> " + round(new_v) + suffix;

        if (!summary[title]) summary[title] = {};
        if (!summary[title][name]) summary[title][name] = [];
        summary[title][name].push(percent);
        return {
          string,
          percent
        };
      }
      span.innerHTML = "<b>" + title + ":</b> ("+base_values.length+" / "+new_values.length+")<br />";
      let median = diff("median", base_stats.median, new_stats.median);
      let mean = diff("mean", base_stats.mean, new_stats.mean);
      span.innerHTML += median.string + " <br />";
      span.innerHTML += mean.string + " <br />";
      span.innerHTML += diff("stddev", base_stats.stddevPercent, new_stats.stddevPercent, "%").string + "<br />";
      span.innerHTML += diff("ci", base_stats.confidenceInterval, new_stats.confidenceInterval).string;
      let regress = [], improves = [];
      if (new_stats.mean - new_stats.confidenceInterval > base_stats.mean + base_stats.confidenceInterval) {
        regress.push("confidence interval");
      } else if (new_stats.mean + new_stats.confidenceInterval < base_stats.mean - base_stats.confidenceInterval) {
        improves.push("confidence interval");
      }
      let maxStddev = Math.max(base_stats.stddevPercent, new_stats.stddevPercent);
      if (Math.abs(median.percent) > maxStddev) {
        if (median.percent > 0) {
          regress.push("median");
        } else {
          improves.push("median");
        }
      }
      if (Math.abs(mean.percent) > maxStddev) {
        if (mean.percent > 0) {
          regress.push("mean");
        } else {
          improves.push("mean");
        }
      }
      if (regress.length > 0) {
        span.innerHTML += `<br /><span style="font-weight: bold; color: red">Regress via ${regress.join(', ')}</span>`;
      }
      if (improves.length > 0) {
        span.innerHTML += `<br /><span style="font-weight: bold; color: green">Improved via ${improves.join(', ')}</span>`;
      }
      div.appendChild(span);
      td.appendChild(div);
    }
    tr.appendChild(td);
    table.appendChild(tr);

    tr.appendChild(td);
  }
  
  let boxPlots = {
    means: [],
    median: [],
    stddev: [],
    ci: [],
  };
  for(let title in summary) {
    let { mean: means, median, stddev, ci } = summary[title];
    stddev = stddev.filter(a => !!a);
    boxPlots.means.push({
      title: title,
      values: means,
      stats: calcBoxStats(means),
    });
    boxPlots.median.push({
      title: title,
      values: median,
      stats: calcBoxStats(median),
    });
    boxPlots.stddev.push({
      title: title,
      values: stddev,
      stats: calcBoxStats(stddev),
    });
    boxPlots.ci.push({
      title: title,
      values: ci,
      stats: calcBoxStats(ci),
    });
  }
  for (let name in boxPlots) {
    let data = boxPlots[name];
    let div = document.createElement("div");
    div.appendChild(document.createTextNode(`Overview for "${name}":`));
    let svg = createBoxPlot(data);
    let node = svg.node();
    node.style.verticalAlign = "middle";
    div.appendChild(node);
    let rightDiv = document.createElement("div");
    rightDiv.style.display = "inline-block";
    for (let { title, stats } of data) {
      let line = document.createElement("div")
      line.textContent = `${title} - mean:${round(stats.mean)} median:${round(stats.median)}`;
      rightDiv.appendChild(line);
    }
    div.appendChild(rightDiv);
    document.getElementById("content").appendChild(div);
  }
  document.getElementById("content").appendChild(table);
}
window.addEventListener("load", main, { once: true });

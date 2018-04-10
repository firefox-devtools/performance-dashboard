function computeAverage(data) {
  let average = [];
  let currentDate = null, currentValues = [];
  data.forEach(d => {
    if (!currentDate) {
      currentDate = new Date(d.date);
    }
    currentValues.push(d.value);
    if (currentDate.getDate() != d.date.getDate()) {
      let mean = 0;
      currentValues.forEach(v => { mean += v; });
      currentDate.setHours(12);
      currentDate.setMinutes(0);
      let value = Math.round(mean / currentValues.length);
      average.push({ date: currentDate, value });
      currentDate = new Date(d.date);
      currentValues = [];
    }
  });
  // Explicitely avoid displaying the average for the last day
  // to prevent displaying boggus average if the last day data
  // is having a lot of noise.
  return average;
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

function graph(data, { displayAverageLine = false } = {}) {
  console.log("graph with data", data);
  let params = new URL(window.location).searchParams;
  let summaryMode = false;
  if (params.has("summary")) {
    summaryMode = params.get("summary") == "true";
  }
  if (summaryMode) {
    displayAverageLine = true;
  }

  data = filterNoise(params, data);

  let svg = d3.select("svg");
  let margin = {top: 20, right: 20, bottom: 30, left: 50};
  if (summaryMode) {
    margin = {top:0, right: 0, bottom: 0, left: 0};
  }
  let rect = document.getElementById("svg").getBoundingClientRect();
  let width = rect.width - margin.left - margin.right;
  let height = rect.height - margin.top - margin.bottom;

  // Clear any previous content
  svg.selectAll("*").remove();

  let x = d3.scaleTime().rangeRound([0, width]);
  let y = d3.scaleLinear().rangeRound([height, 0]);

  let line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value))
    //.curve(d3.curveBasis);

  let line2 = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.value))

  x.domain(d3.extent(data, d => d.date));
  y.domain(d3.extent(data, d => d.value));

  let g = svg.append("g");

  // Don't display the axis in summary mode
  if (!summaryMode) {
    g.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
      .select(".domain")
        //.remove();

    g.append("g")
       .call(d3.axisLeft(y))
  }

  if (displayAverageLine) {
    let averageData = computeAverage(data);
    g.append("path")
     .datum(averageData)
     .attr("fill", "none")
     .attr("stroke", "green")
     .attr("stroke-linejoin", "round")
     .attr("stroke-linecap", "round")
     .attr("stroke-width", 2)
     .attr("d", line2);
  }

  // Only display the average line in summary mode
  if (summaryMode) {
    return;
  }

  g.append("path")
   .datum(data)
   .attr("fill", "none")
   .attr("stroke", "steelblue")
   .attr("stroke-linejoin", "round")
   .attr("stroke-linecap", "round")
   .attr("stroke-width", displayAverageLine ? 0.1 : 1.5)
   .attr("d", line);

  let tooltipDiv = d3.select("body").append("div")  
    .attr("class", "tooltip")        
    .style("opacity", 0);
  let hideTooltipTimeout = null;

  let formatTime = d3.timeFormat("%e %B");
  g.selectAll("dot")
   .data(data)
   .enter().append("circle")
     .classed("dot", true)
     .style("stroke", function(d) {
       return d.color ? d.color : "green";
     })
     .style("fill", function(d) {
       return d.fill ? d.fill : "white";
     })
     .attr("r", 4)
     .attr("cx", function(d) { return x(d.date); })
     .attr("cy", function(d) { return y(d.value); })
     .on("mouseover", async function(d, i) {
       // Compute the point link immediately, as onclick should have access to the link
       // synchronously, otherwise popup blocker prevents opening link asynchronously,
       // outside of the onclick handler.
       if (d.getLink) {
         let link = await d.getLink();
         d.link = link;
       }
       if (hideTooltipTimeout) {
         clearTimeout(hideTooltipTimeout);
         hideTooltipTimeout = null;
       }
       tooltipDiv.transition()
          .duration(200)
          .style("opacity", .9);
       let x = 60 + parseInt(d3.select(this).attr("cx"));
       let y = parseInt(d3.select(this).attr("cy"));
       let tooltipWidth = 100;
       if (x + tooltipWidth > window.innerWidth) {
         x -= tooltipWidth + 20;
       }
       let previous = data[i-1].value;
       let current = d.value;
       let percent =  Math.round( 1000 * ( ( current - previous ) / previous ) ) / 10;
       let html = formatTime(d.date) + "<br/> Δ " + (percent > 0 ? "+" : "") + percent + "% " + current;
       if (d.getTooltip) {
         html += await d.getTooltip(d, data[i-1]);
       }
       tooltipDiv.html(html)
          .style("left", x + "px")
          .style("top", y + "px");
     })
     .on("click", function(d) {
       if (d.link) {
         window.open(d.link, "_blank");
       }
     })
     .on("contextmenu", function(d) {
       d3.event.preventDefault();
			 hideTooltip();

       if (typeof window.showFormPopup == "function") {
         showFormPopup(this, d);
       }
     })
     .on("mouseout", function(d) {
       hideTooltip();
     });
   tooltipDiv.on("mouseoover", function(d) {
     if (hideTooltipTimeout) {
       clearTimeout(hideTooltipTimeout);
       hideTooltipTimeout = null;
     }
   });
   tooltipDiv.on("mouseout", function(d) {
     hideTooltip();
   });
   function hideTooltip() {
     hideTooltipTimeout = setTimeout(function () {
       hideTooltipTimeout = null;
       tooltipDiv.transition()
          .duration(500)
          .style("opacity", 0);
     }, 1000);
   }
   return g;
}

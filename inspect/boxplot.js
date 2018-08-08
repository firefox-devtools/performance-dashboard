
// Define the div for the tooltip
let tooltip;
addEventListener("load", () => {
  tooltip = d3.select("body").append("div")   
    .attr("class", "tooltip")               
    .style("opacity", 0);
}, { once: true });
const palette = [
  "lightskyblue",
  "lightsalmon",
  "lightgreen",
  "indianred",
];

function createBoxPlot(data) {
  let margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 500 - margin.left - margin.right,
      height = (data.length * 40 + 10) - margin.top - margin.bottom,
      padding = 5, labelWidth = 100;

  let svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  //initialize the x scale
  xScale = d3.scaleLinear()
    .range([labelWidth, width - padding]);

  //initialize the x axis
  let xAxis = d3.axisBottom()
    .scale(xScale)

  // set the domain of the xScale
  let min = Infinity, max = -Infinity;
  for (let { stats } of data) {
    min = Math.min(stats.min, min);
    max = Math.max(stats.max, max);
  }
  xScale.domain([min, max]);

  // set the position of the y axis and append it
  let xAxisYPos = height - padding - 15;
  svg.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0, " + xAxisYPos + ")")
      .call(xAxis);

  // draw vertical grid lines
  svg.selectAll("line.verticalGrid")
      .data(xScale.ticks(10))
      .enter()
      .append("line")
      .attr("class", "verticalGrid")
      .attr("x1", function(d) { return xScale(d); })
      .attr("y1", xAxisYPos)
      .attr("x2", function(d) { return xScale(d); })
      .attr("y2", padding - 3);

  // set which category we want to group by and get them
  let groupingCategory = "playerList";

  // calculate how much canvas space we've got available to plot the data from each category
  let yCanvasSpaceForEach = xAxisYPos / (data.length + 1)

  // iterate over each category and draw what you want on the plot
  let i = 0;
  for (let { title, values, stats } of data) {
    // calculate where to plot on the canvas (draws from top to bottom)
    let boxY = yCanvasSpaceForEach * (i + 1);

    // draw box-and-whiskers plot
    drawBoxes(svg, values, stats, whiskerHeight = 5, boxHeight = 10, boxY, boxNumber = i, xScale);

    // draw data points
    drawPoints(svg, values, stats, pointSize = 2.5, 
        outlierSize = 3.5, boxY, yDisplacement = 12, jitterAmount = 3, categoryIndex = i, hoverX = -5, hoverY = -10, xScale);

    // draw labels
    drawCategoryLabels(svg, title, fontsize = 13, xPlacement = 5, boxY, yDisplacement = 4);
    i++;
  }

  //draw vertical line for 0 if it is in range
  if (min < 0 && max > 0) {
    svg.append("line")
       .attr("class", "zero")
       .attr("x1", xScale(0))
       .attr("x2", xScale(0))
       .attr("stroke", "gray")
       .attr("y1", padding)
       .attr("y2", xAxisYPos);
  }

  return svg;
}

/******function to draw box-and-whiskers plot*******
*   arguments: 
*       svg: the svg to plot on
*       csv: csv with the data to plot
*       colToPlot: name of the column (as a string) containing the data to plot
*       whiskerHeight: the length of whiskers you want
*       boxHeight: the height of the interquartile range box you want
*       boxY: the y-coordinate around which the boxes should be centered
*       categoryIndex: the index of the current category of data being plotted
*/
function drawBoxes(svg, data, stats, whiskerHeight, boxHeight, boxY, categoryIndex, xScale) {

    //draw vertical line for lowerWhisker
    svg.append("line")
        .attr("class", "whisker")
        .attr("x1", xScale(stats.lowerWhisker))
        .attr("x2", xScale(stats.lowerWhisker))
        .attr("stroke", "black")
        .attr("y1", boxY - (whiskerHeight/2))
        .attr("y2", boxY + (whiskerHeight/2));

    //draw vertical line for upperWhisker
    svg.append("line")
        .attr("class", "whisker")
        .attr("x1", xScale(stats.upperWhisker))
        .attr("x2", xScale(stats.upperWhisker))
        .attr("stroke", "black")
        .attr("y1", boxY - (whiskerHeight/2))
        .attr("y2", boxY + (whiskerHeight/2));

    //draw horizontal line from lowerWhisker to 1st quartile
    svg.append("line")
        .attr("class", "whisker")
        .attr("x1", xScale(stats.lowerWhisker))
        .attr("x2", xScale(stats.q1))
        .attr("stroke", "black")
        .attr("y1", boxY)
        .attr("y2", boxY);

    //draw rect for iqr
    svg.append("rect")
        .attr("class", "box")
        .attr("stroke", "black")
        .attr("fill", palette[categoryIndex])       // sets new color for each box
        .attr("x", xScale(stats.q1))
        .attr("y", boxY - (boxHeight/2))
        .attr("width", xScale(stats.q3) - xScale(stats.q1))
        .attr("height", boxHeight);

    //draw horizontal line from 3rd quartile to upperWhisker
    svg.append("line")
        .attr("class", "whisker")
        .attr("x1", xScale(stats.q3))
        .attr("x2", xScale(stats.upperWhisker))
        .attr("stroke", "black")
        .attr("y1", boxY)
        .attr("y2", boxY);
	
	
    //draw vertical line at median
    svg.append("line")
        .attr("class", "median")
        .attr("x1", xScale(stats.median))
        .attr("x2", xScale(stats.median))
        .attr("y1", boxY - (boxHeight/2))
        .attr("y2", boxY + (boxHeight/2));
    

    //draw horizontal line for Confidence interval
    svg.append("line")
        .attr("class", "confidence-interval")
        .attr("x1", xScale(stats.mean - stats.confidenceInterval))
        .attr("x2", xScale(stats.mean + stats.confidenceInterval))
        .attr("stroke", "red")
        .attr("width", "2")
        .attr("y1", boxY+3)
        .attr("y2", boxY+3);

}


/*  ***function to draw the data points***
*   arguments: 
*       svg: the svg to plot on
*       csv: csv with data to plot
*       colToPlot: name of the column (as a string) containing the data to plot
*       colToHover: the name of the column (as a string) from which data should be shown on hover
*       pointSize: the size of points you want
*       boxY: the y-coordinate around which the points should be centered
*       yDisplacement: any desired displacement up or down relative to the center
*       jitterAmount: the amount of jitter you want
*       categoryIndex: the index of the current category of data being plotted
*       hoverX: where, relative to the datapoint, should the hover text be shown horisontally?
*       hoverY: where, relative to the datapoint, should the hover text be shown vertically?
*/

function drawPoints(svg, data, stats, pointSize, outlierSize, boxY, 
    yDisplacement, jitterAmount, categoryIndex, hoverX, hoverY, xScale) {
    
	boxY = boxY + yDisplacement;

	function random_jitter(boxY) {
	    if (Math.round(Math.random() * 1) == 0)
	        var seed = -jitterAmount;
	    else
	        var seed = jitterAmount;
	    return boxY + Math.floor((Math.random() * seed) + 1);
	}

    // make a grouping for each data point
    var dataPoints = svg 
        .selectAll(".dataPoints" + categoryIndex)   //select only data points drawn in the current iteration
        .data(data)
        .enter()
        .append("g")
        .attr("class", "dataPoints" + categoryIndex)    
        .attr("transform", function(d){
            return "translate(" + xScale(d) + "," + random_jitter(boxY) + ")";
        })
        
        // show app name when hovering over a data point
        .on("mouseover", function(d){       
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            
            tooltip.html(d)
                .style("left", (d3.event.pageX) + "px")     
                .style("top", (d3.event.pageY - 28) + "px");
            console.log(d, d.length);
        })
        // remove text when we move the mouse away
        .on("mouseout", function(d) {       
            tooltip.transition()        
                .duration(500)      
                .style("opacity", 0);   
        });

        // draw the data points as circles
        dataPoints
            .append("circle")
            .attr("r", function(d) {
              if (d < stats.lowerWhisker || d > stats.upperWhisker)
                return outlierSize;
              else
                return pointSize;
            })
            .attr("class", function(d) {
               if (d < stats.lowerWhisker || d > stats.upperWhisker)
                 return "outlier";
               else
                 return "point";
            })
            .attr("fill", function(d) {
              if (d < stats.lowerWhisker || d > stats.upperWhisker)
                return "#ccc";
              else
                return palette[categoryIndex]; 
            }); 
}
        

/*  ***function to draw the category labels***
*   arguments: 
*       svg: the svg to plot on
*       category: string with the category label to plot
*       xDisplacement: where on the horisontal axis should the label be shown?
*       boxY: the y coordinate where the data for the category has been plotted
*       yDisplacement: any desired displacement up or down of the text
*/

function drawCategoryLabels(svg, label, fontsize, xPlacement, boxY, yDisplacement) { 
    svg 
        .append("text")
        .attr("class", "categoryLabel")
        .text(label)
        .style("font-size", fontsize)
        .style("font-weight", 400)
        .attr("x", xPlacement)
        .attr("y", boxY + yDisplacement)    
}

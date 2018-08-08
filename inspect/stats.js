// function to calculate statistics summary
function calcBoxStats(data) {
  data = data.filter(v => typeof(v) != "undefined" && !isNaN(v));

  // sort the data ascending
  data = data.sort(d3.ascending);

  // initialise stats object
  let stats = {
    outliers: [],
    min: data[0],
    lowerWhisker: Infinity,
    q1: d3.quantile(data, .25),
    median: d3.quantile(data, .5),
    mean: d3.mean(data),
    variance: d3.variance(data),
    stddev: d3.deviation(data),
    q3: d3.quantile(data, .75),
    iqr: 0,
    upperWhisker: -Infinity,
    max: data[data.length - 1]
  };

  //calculate statistics
  stats.iqr = stats.q3 - stats.q1;
  stats.confidenceInterval = 1.96 * stats.stddev / Math.sqrt(data.length);
  stats.stddevPercent = (stats.stddev / stats.mean) * 100;

  let index = 0;

  //search for the lower whisker, the minimum value within q1 - 1.5*iqr
  while (index < data.length && stats.lowerWhisker == Infinity) {
    if (data[index] >= (stats.q1 - (1.5 * stats.iqr)))
      stats.lowerWhisker = data[index];
    else
      stats.outliers.push(data[index]);
    index++;
  }

  index = data.length - 1; // reset index to end of array

  //search for the upper whisker, the maximum value within q1 + 1.5*iqr
  while (index >= 0 && stats.upperWhisker == -Infinity) {
    if (data[index] <= (stats.q3 + (1.5 * stats.iqr)))
      stats.upperWhisker = data[index];
    else
      stats.outliers.push(data[index]);
    index--;
  }

  return stats;
}
function lightStripNoise(values, { lowerWhisker, upperWhisker }) {
  if (values.length <= 2) {
    return values;
  }
  return values.filter(v => v >= lowerWhisker && v <= upperWhisker);
}
function mean(array) {
  return d3.mean(array);
}
function round(v) {
  return Math.round(v * 100) / 100;
}

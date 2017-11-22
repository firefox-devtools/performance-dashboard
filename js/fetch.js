function fetchJSON(url) {
  return new Promise(done => {
    //url = "test-data/warm-toolbox-month.json";
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "json";
    xhr.onload = function () {
      done(xhr.response);
    };
    xhr.send(null);
  });
}

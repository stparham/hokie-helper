const NUM_PROFS_AT_VT = 1500;

chrome.runtime.onMessage.addListener(function(req, sender, sendResponse) {
  switch (req.type) {
    case "RMPRatings":
      getRMPRatings().then(function(results) {
        sendResponse(results);
      }, function(error) {
        sendResponse(new Error("Error while getting Rate My Professor ratings"));
      });
      break;
    case "AnaanuData":
      getAnaanuDataFor(req.course).then(function(results) {
        sendResponse(results);
      }, function(error) {
        sendResponse(new Error("Error while getting Anaanu data"));
      });
      break;
    case "KoofersRatings":
      getKoofersRatingsFor(req.subject).then(function(results) {
        sendResponse(results);
      }, function(error) {
        sendResponse(new Error("Error while getting Koofers ratings"));
      });
      break;
    case "KoofersGPA":
      getKoofersGPAFor(req.courseSubj, req.courseNum, req.courseTitle).then(function(results) {
        sendResponse(results);
      }, function(error) {
        sendResponse(new Error("Error while getting Koofers GPAs"));
      });
      break;
    default:
      sendResponse(new Error("Invalid request type"));
  }
  return true; // prevents the callback from being called too early on return
});

function getRMPRatings() {
  return new Promise(function(resolve, reject) {
    var host1 = "https://search-a.akamaihd.net/typeahead/suggest/";
    var host2 = "http://search.mtvnservices.com/typeahead/suggest/";
    var params1 = "?solrformat=true" +
        "&rows=100" +
        "&start=0" +
        "&callback=cb" +
        "&q=*%3A*+AND+schoolid_s%3A685+AND+teacherdepartment_s%3A%22Computer+Science%22" +
        "&defType=edismax" +
        "&qf=teacherfirstname_t%5E2000+teacherlastname_t%5E2000+teacherfullname_t%5E2000+autosuggest" +
        "&bf=pow(total_number_of_ratings_i%2C2.1)" +
        "&sort=teacherlastname_sort_s+asc" +
        "&siteName=rmp" +
        "&fl=pk_id+teacherfirstname_t+teacherlastname_t+total_number_of_ratings_i+averageratingscore_rf+schoolid_s" +
        "&fq=";
    var allProfsVT = "?solrformat=true" +
        "&rows=" + NUM_PROFS_AT_VT +
        "&start=0" +
        "&callback=cb" +
        "&q=*%3A*+AND+schoolid_s%3A1349" +
        "&defType=edismax" +
        "&qf=teacherfirstname_t%5E2000+teacherlastname_t%5E2000+teacherfullname_t%5E2000+autosuggest" +
        "&bf=pow(total_number_of_ratings_i%2C2.1)" +
        "&sort=teacherlastname_sort_s+asc" +
        "&siteName=rmp" +
        "&fl=pk_id+teacherfirstname_t+teacherlastname_t+total_number_of_ratings_i+averageratingscore_rf+schoolid_s" +
        "&fq=";

    var xhr = new XMLHttpRequest();
    xhr.open("GET", host1 + allProfsVT, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        var resp = xhr.responseText;

        try { // try to parse pure JSON
          resp = JSON.parse(xhr.responseText);
        } catch (err) { // try to parse JSONP
          try {
            resp = JSON.parse(xhr.responseText.slice(3, -3));
          } catch (err) { // try to parse html
            var el = $('<div></div>');
            el.html(xhr.responseText);
            resp = $('.breakdown-header', el);
          }
        }
        resolve(resp.response);
      } else if (xhr.readyState == 4 && xhr.status != 200) {
        reject("ERROR: " + xhr.responseText);
      }
    };
    xhr.send();
  });
}

function getAnaanuDataFor(course) {
  return new Promise(function(resolve, reject) {
    var url = "http://anaanu.com/virginia-tech-vt/course/" + course + "/";
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        var el = $('<div></div>');
        el.html(xhr.responseText);
        var inlineScripts = el.find('script')
            .filter(function() {
              return this.src == "";
            });
        var script = inlineScripts[inlineScripts.length - 1].innerText;
        var JSONStrIndicator = "= \"{";
        var JSONStr = script.slice(script.search(JSONStrIndicator) + 3, script.search("\";")).replace(/\\"/g, '"');
        try {
          var obj = JSON.parse(JSONStr);
          var afterAnaanuCraziness = doAnaanuCraziness(obj);
          resolve(afterAnaanuCraziness);
        } catch (error) { // catches JSON parsing errors
          reject("Error while parsing");
        }
      } else if (xhr.readyState == 4 && xhr.status != 200) {
        reject("ERROR: " + xhr.responseText);
      }
    };
    xhr.send();
  });

  // I found this code in the source code for Anaanu and figured out that it parses the data that's sent along with the page.
  // It was minified, so it's hard to follow.  I plan on eventually going through it and making it more readable.
  function doAnaanuCraziness(courseResultsObject) {
    var l = [];

    return t(courseResultsObject);

    function t(r) {
        var e = r;
        for (var t in e)
            if ("course_grade" !== t)
                for (var o = e[t].classes, s = 0; s < o.length; s++)
                    o[s].semester = t,
                    l.push(o[s]);
        return a(l);
    }

    function a(r) {
        var e = r
          , t = ""
          , a = ""
          , s = 0
          , template = {
            instructor: "Instructor",
            num_courses: "Courses Taught",
            withdraws: "Withdraws",
            a: "A %",
            b: "B %",
            c: "C %",
            d: "D %",
            f: "F %",
            gpa: "GPA"
        }
          , c = {
            credit_hours: "credit_hours",
            gpa: "gpa",
            a: "a",
            b: "b",
            c: "c",
            d: "d",
            f: "f",
            withdraws: "withdraws"
        }
          , i = {}
          , l = [];
        for (s = 0; s < e.length; s++)
            t = e[s].instructor,
            t in i || (i[t] = {},
            i[t].courses = [],
            i[t].cour_avg = {}),
            i[t].courses.push(e[s]);
        for (t in i) {
            var g = i[t].courses
              , h = g.length;
            for (s = 0; s < h; s++)
                for (a in c) {
                    var v = g[s][a];
                    a in i[t].cour_avg || (i[t].cour_avg[a] = 0),
                    i[t].cour_avg[a] += parseFloat(v)
                }
            for (a in c)
                i[t].cour_avg[a] /= h;
            i[t].cour_avg.num_courses = h,
            i[t].cour_avg.course = g[0].course,
            i[t].cour_avg.instructor = g[0].instructor,
            i[t].cour_avg.subject = g[0].subject,
            i[t].cour_avg.title = g[0].title,
            l.push(n(i[t].cour_avg))
        }
        l.sort(d);
        return l;
    }

    function d(r, e) {
        var t = r.instructor
          , a = e.instructor;
        return t < a ? -1 : t > a ? 1 : 0
    }

    function n(r) {
        var e = {
            credit_hours: "credit_hours",
            gpa: "gpa",
            a: "a",
            b: "b",
            c: "c",
            d: "d",
            f: "f",
            withdraws: "withdraws"
        };
        for (var t in e)
            "credit_hours" === e[t] || "withdraws" === e[t] ? r[t] = Math.floor(r[t]) : "gpa" === e[t] ? r[t] = (Math.round(100 * r[t]) / 100).toFixed(2) : r[t] = Math.round(10 * r[t]) / 10;
        return r
    }
  }
}

function getKoofersRatingsFor(subject) {
  return new Promise(function(resolveOuter, rejectOuter) {
    var initStatus = {"nextPage": "https://www.koofers.com/virginia-tech-vt/" + subject + "/professors?p=1", "results": []};

    var chain = requestPage(initStatus);

    function requestPage(status) {
      return new Promise(function(resolve, reject) {
        var url = status.nextPage;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4 && xhr.status == 200) {
            var el = $('<div></div>');
            el.html(xhr.responseText);

            var professorRows = el.find('div.list_view_widget.professors > div.row');
            professorRows.each(function(idx) {
              var profData = {};
              var ratingSpan = $(this).find('div.right > div.rating > span');
              if (ratingSpan.length === 1) {
                profData.rating = ratingSpan[0].innerText;
              }
              var nameLink = $(this).find('div.content > div.title > a');
              if (nameLink.length === 1) {
                profData.url = "https://www.koofers.com" + nameLink[0].pathname;
                var nameSplit = nameLink[0].innerText.split(", ");
                profData.lastName = (nameSplit[0]) ? nameSplit[0] : "";
                profData.firstName = (nameSplit[1]) ? nameSplit[1] : "";
                status.results.push(profData);
              }
            });

            var nextPageLink = el.find('div.paging_widget > div.page_links > a.next');
            if (nextPageLink.length > 0) { // if there is a next page
              status.nextPage = "https://www.koofers.com/virginia-tech-vt/" + subject + "/professors" + nextPageLink[0].search; // get the link
              chain.then(function() { // and chain the next page's results to the Promise chain
                return requestPage(status);
              });
            } else { // else there are no more pages so we can resolve the overall promise
              resolveOuter(status.results);
            }

            resolve(status);
          } else if (xhr.readyState == 4 && xhr.status != 200) {
            reject("ERROR: " + xhr.responseText);
          }
        };
        xhr.send();
      });
    }
  });
}

function getKoofersGPAFor(courseSubj, courseNum, courseTitle) {

}












// Click icon to run script on page, take to classes page, and right click for options
chrome.browserAction.onClicked.addListener(function() {
  console.log("Extension clicked");
  var matches = "https://banweb.banner.vt.edu/ssb/prod/HZSKVTSC.P_ProcRequest";
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
      var url = tabs[0].url;
      var matches = ["https://banweb.banner.vt.edu/ssb/prod/HZSKVTSC.P_ProcRequest"];
      if (matches[0] == url.substring(0, matches[0].length)) {
        // chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        //   chrome.tabs.sendMessage(tabs[0].id, {doAction: true}, function(response) {
        //     if(!response) {
        //       sendNotification("ASU Professor Ratings has already been run on this page.");
        //     }
        //   });
        // });
      } else {
        chrome.tabs.create({'url': "https://banweb.banner.vt.edu/ssb/prod/HZSKVTSC.P_ProcRequest"});
        // sendNotification("Perform a search and ASU Professor Ratings will autorun. If autorun is disabled, click the extension icon to show ratings.");
      }
  });
});

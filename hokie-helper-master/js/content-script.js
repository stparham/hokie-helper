var hasRun = false;
var userID = "";
var notify = false;
var preferredQualityArray = ['Overall_Quality', 'Difficulty'];
var preferredQuality = 'Overall_Quality';

var messageDiv = document.createElement('div');
messageDiv.id = "send_message_div";
messageDiv.hidden = true;

messageDiv.addEventListener('sendMessage', function() {
  chrome.runtime.sendMessage(JSON.parse(this.innerHTML));
});
document.body.appendChild(messageDiv);

// Connects to First Background Function
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if(!hasRun && request.doAction) {
    sendResponse(true);
    checkStorageAndRunScript(true);
  } else {
    sendResponse(false);
  }
});

// returns the index at which the value is found based on the comparator function
// returns -1 if the value is not found
Array.prototype.binarySearch = function(valueToFind, comparator) {
  return searchHelper(this, 0, this.length - 1, valueToFind);
  function searchHelper(array, left, right, key) {
    if (left > right) {
      return -1;
    }
    var mid = Math.floor((left + right) / 2);
    var comparison = comparator(array[mid], key);
    if (comparison == 0) {
      return mid;
    }
    if (comparison > 0) {
      return searchHelper(array, left, mid - 1, key);
    }
    return searchHelper(array, mid + 1, right, key);
  }
}

function rmpSearchComparator(arrVal, valToFind) {
  var arrValLastName = arrVal.teacherlastname_t.toLowerCase();
  var arrValFirstName = arrVal.teacherfirstname_t.toLowerCase();
  var valToFindLastName = valToFind.lastName.toLowerCase();
  if (arrValLastName == valToFindLastName) {
    if (arrValFirstName.charAt(0) == valToFind.initials.toLowerCase().charAt(0)) {
      return 0;
    } else if (arrValFirstName.charAt(0) > valToFind.initials.toLowerCase().charAt(0)) {
      return 1;
    }
    return -1;
  }
  if (arrValLastName > valToFindLastName) {
    return 1;
  } else {
    return -1;
  }
}

function anaanuSearchComparator(arrVal, valToFind) {
  var arrValLastName = arrVal.instructor.toLowerCase();
  var valToFindLastName = valToFind.lastName.toLowerCase();
  if (arrValLastName == valToFindLastName) {
    return 0;
  }
  if (arrValLastName > valToFindLastName) {
    return 1;
  }
  return -1;
}

function sortComparator(val1, val2) {
  var lastName1 = val1.teacherlastname_t.toLowerCase();
  var firstName1 = val1.teacherfirstname_t.toLowerCase();
  var lastName2 = val2.teacherlastname_t.toLowerCase();
  var firstName2 = val2.teacherfirstname_t.toLowerCase();
  if (lastName1 == lastName2) {
    if (firstName1.charAt(0) == firstName2.charAt(0)) {
      return 0;
    } else if (firstName1.charAt(0) > firstName2.charAt(0)) {
      return 1;
    }
    return -1;
  }
  if (lastName1 > lastName2) {
    return 1;
  } else {
    return -1;
  }
}

readyScript();

var profRatingTemplate;
var courseGPATemplate;
var tableHeaderTemplates;
var loadingAnimation = chrome.extension.getURL("img/loading.gif");
function readyScript() {
  $.when(
    $.get(chrome.extension.getURL('/html/prof_rating.html'), function(data) {
      profRatingTemplate = data;
    }),
    $.get(chrome.extension.getURL('/html/avg_gpa.html'), function(data) {
      courseGPATemplate = data;
    }),
    $.get(chrome.extension.getURL('/html/table_headers.html'), function(data) {
      var el = $('<div></div>');
      el.html(data);
      tableHeaderTemplates = $('td', el);
    })
  ).then(function() {
    runScript();
  });
}

function runScript() {
  // Get the current version number from the manifest and manually set
  // the platform as Chrome
  var manifestData = chrome.runtime.getManifest();
  var platform = "Chrome";
  var version = manifestData.version;


  /////////////////////
  /// NOTIFICATIONS ///
  /////////////////////
  Notification.requestPermission();
  chrome.storage.sync.get('notify', function(items) {
    if (items.notify == true) {
      var options = {
        body: "VT Prof Stats is now running on this page. To change this behavior, go to the options page.",
        icon: chrome.extension.getURL("imgs/icon.png")
      }
      var n = new Notification("VT Prof Stats", options);
      setTimeout(function(){n.close();}, 5000);
    }
  });


  var instructors = {};
  var courses = {};

  // get the column before the point of injection for the new statistics headers
  var instructorHeader = $(".dataentrytable > tbody > tr:first-of-type > td:nth-of-type(7)");
  if (typeof instructorHeader[0] == 'undefined') return;

  // insert table headers
  var prev = instructorHeader;
  for (var i = 0; i < tableHeaderTemplates.length; i++) {
    prev = $(tableHeaderTemplates[i]).insertAfter(prev);
  }

  // get the columns containing course and instructor information
  var courseCodeCol = $(".dataentrytable > tbody > tr > td:nth-of-type(2)");
  var instructorCol = $(".dataentrytable > tbody > tr > td:nth-of-type(7)");

  // new columns that will be populated by data from RMP, Koofers, and Anaanu
  var rmpDataCol = [];
  var anaanuDataCol = [];
  // var koofersDataCol = []; // TODO Add Koofers column

  // extract data from courseCodeCol and instructorCol while inserting new cells for RMP, Koofers, and Anaanu
  for (var i = 1; i < instructorCol.length; i++) { // start at 1 to avoid column headers
    // create enough new cells for the headers (one for RMP, Anaanu, and potentially Koofers)
    var newCells = [];
    for (var j = 0; j < tableHeaderTemplates.length; j++) {
      var newCell = document.createElement("td");
      newCell.className = "RMPtd dedefault";
      newCells.push(newCell);
    }
    rmpDataCol.push(newCells[0]);
    anaanuDataCol.push(newCells[1]);
    // koofersDataCol.push(newCells[2]); // TODO Add Koofers column

    // whether or not the instructor is indicated as "Staff"
    var staffCourse = instructorCol[i].innerText == "Staff";
    // whether or not this is a weird row (most of the exceptions come from rows that don't have course codes so I test for those with this regex)
    var weirdRow = !(new RegExp("[A-Z]{2,4}-[0-9]{4}")).test(courseCodeCol[i].innerText);
    if (!staffCourse && !weirdRow) { // course with real instructor
      // insert new cells after the instructor column
      var row = instructorCol[i].parentNode;
      var colToInsertBefore = instructorCol[i].nextSibling;
      for (var cell of newCells) {
        // add loading bar animations for the cell while information is retrieved
        var node = document.createElement("img");
        node.src = loadingAnimation;
        node.className = 'RMPimg';
        cell.appendChild(node);
        // insert the cell into the row
        row.insertBefore(cell, colToInsertBefore);
      }

      // data extraction begins here
      var name = instructorCol[i].innerText;
      var course = courseCodeCol[i].innerText;

      // store instructor information
      if (typeof instructors[name] === 'undefined') {
        var split = name.split(' ');
        var initials = split[0];
        split.splice(0, 1); // get rid of initials
        var lastName = split.join(''); // join any last names together
        instructors[name] = {
          "firstName": initials,
          "lastName": lastName,
          "initials": initials,
          "courses": {},
          "associatedTableCells": [],
          "rating": "No Rating",
          "hasRating": false,
          "rmpURL": "http://www.ratemyprofessors.com/campusRatings.jsp?sid=1349",
          "koofersURL": "https://www.koofers.com/virginia-tech-vt/",
          "anaanuURL": "http://anaanu.com/virginia-tech-vt/"
        };
      }
      if (typeof instructors[name].courses[course] === 'undefined') {
        instructors[name].courses[course] = course;
      }
      instructors[name].associatedTableCells.push(i - 1);

      // store course information
      if (typeof courses[course] === 'undefined') {
        var split = course.split('-');
        courses[course] = {
          "subject": split[0],
          "courseNum": split[1],
          "associatedTableCells": [],
          "instructors": {},
          "anaanuURL": "http://anaanu.com/virginia-tech-vt/"
        }
      }
      if (typeof courses[course].instructors[name] === 'undefined') {
        courses[course].instructors[name] = {
          "firstName": instructors[name].firstName,
          "lastName": instructors[name].lastName,
          "initials": instructors[name].initials,
          "a": 0.0,
          "b": 0.0,
          "c": 0.0,
          "d": 0.0,
          "f": 0.0,
          "hasGPA": false,
          "avgGPA": "No Data",
          "associatedTableCells": [],
          "anaanuURL": courses[course].anaanuURL
        }
      }
      courses[course].instructors[name].associatedTableCells.push(i - 1);

    } else if (weirdRow) {
      // insert new cells in line with columns despite being a weird row
      var row = instructorCol[i].parentNode;
      var colToInsertBefore = instructorCol[i].previousSibling.previousSibling;
      for (var cell of newCells) {
        cell.innerText = "";
        row.insertBefore(cell, colToInsertBefore);
      }

    } else { // extra weird row
      // insert new cells after the instructor column
      var row = instructorCol[i].parentNode;
      var colToInsertBefore = instructorCol[i].nextSibling;
      for (var cell of newCells) {
        cell.innerText = "N / A";
        row.insertBefore(cell, colToInsertBefore);
      }

    }

  }


  getData();

  function getData() {
    console.log("Getting RMP Data");
    // DataService is loaded from data-services.js
    DataService.getRMPRatings().then(function(response) {
      var results = response.docs;
      results.sort(sortComparator);

      for (var inst in instructors) {
        // update instructor objects with data from results
        var resultsIdx = -1;

        if ((resultsIdx = results.binarySearch(instructors[inst], rmpSearchComparator)) > -1) {
          var resultRating = results[resultsIdx].averageratingscore_rf;
          instructors[inst].hasRating = (typeof resultRating !== 'undefined');
          instructors[inst].rating = (instructors[inst].hasRating) ? resultRating : instructors[inst].rating;
          instructors[inst].rmpURL = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=" + results[resultsIdx].pk_id;
          instructors[inst].firstName = results[resultsIdx].teacherfirstname_t;
          instructors[inst].lastName = results[resultsIdx].teacherlastname_t;
        }

        // update each of the cells associated with this professor
        var injection = "";
        for (var j = 0; j < instructors[inst].associatedTableCells.length; j++) {
          var curCellNum = instructors[inst].associatedTableCells[j];
          injection = fillProfRatingTemplate(instructors[inst]);
          $(rmpDataCol[curCellNum]).css({opacity: 0});
          $(rmpDataCol[curCellNum]).html(injection);
          $(rmpDataCol[curCellNum]).animate({opacity: 1}, 1000);
        }
      }
      console.log(instructors);
    })
    .catch(function(error) {
      console.log("ERROR Getting RMP Data: ");
      console.log(error);
    })

    // get Anaanu data
    .then(function() {
      console.log("Getting Anaanu Data");
      for (var crs in courses) { // for each course
        (function (course) {
          console.log("Collecting Anaanu data for " + course.subject + "-" + course.courseNum);
          DataService.getAnaanuDataFor(course.subject + "+" + course.courseNum).then(function(results) {
            console.log("Collected Anaanu data for " + course.subject + "-" + course.courseNum + " successfully!!");
            for (var inst in course.instructors) { // for each instructor of that course
              inst = course.instructors[inst];
              // update course objects with data from results
              inst.anaanuURL = inst.anaanuURL + "course/" + course.subject + "+" + course.courseNum + "/";
              var resultsIdx = -1;
              if ((resultsIdx = results.binarySearch(inst, anaanuSearchComparator)) > -1) {
                inst.a = results[resultsIdx].a;
                inst.b = results[resultsIdx].b;
                inst.c = results[resultsIdx].c;
                inst.d = results[resultsIdx].d;
                inst.f = results[resultsIdx].f;
                inst.hasGPA = true;
                inst.avgGPA = results[resultsIdx].gpa;
                inst.anaanuURL = inst.anaanuURL + encodeURIComponent(results[resultsIdx].instructor);
              }

              // update each of the cells associated with this course and instructor
              var injection = "";
              for (var j = 0; j < inst.associatedTableCells.length; j++) {
                var curCellNum = inst.associatedTableCells[j];
                injection = fillCourseGPATemplate(inst);
                $(anaanuDataCol[curCellNum]).css({opacity: 0});
                $(anaanuDataCol[curCellNum]).html(injection);
                $(anaanuDataCol[curCellNum]).animate({opacity: 1}, 1000);
              }
            }
          }, function(error) {
            console.log("Unable to collect Anaanu data for course " + course.subject + "-" + course.courseNum);
            for (var inst in course.instructors) { // for each instructor of that course
              inst = course.instructors[inst];
              // update each of the cells associated with this course and instructor
              var injection = "";
              for (var j = 0; j < inst.associatedTableCells.length; j++) {
                var curCellNum = inst.associatedTableCells[j];
                injection = fillCourseGPATemplate(inst);
                $(anaanuDataCol[curCellNum]).css({opacity: 0});
                $(anaanuDataCol[curCellNum]).html(injection);
                $(anaanuDataCol[curCellNum]).animate({opacity: 1}, 1000);
              }
            }
          })
        })(courses[crs]);
      }
    })
    .catch(function(error) {
      console.log("ERROR Getting Anaanu Data: ");
      console.log(error);
    })

    // TODO get Koofers data
    // .then(function() {
    //   console.log("Getting Koofers Data");
    //   return DataService.getKoofersData();
    // })
    // .then(function(data) {
    //   console.log(data);
    // }, function(error) {
    //   console.log("ERROR Getting Koofers Data: ");
    //   console.log(error);
    // });

  }

}


function fillProfRatingTemplate(profData) {
  var div = document.createElement('div');
  var ratingColor = (profData.hasRating) ? getRatingColor(profData.rating) : 'CCC';
  div.innerHTML = profRatingTemplate.slice();
  $(div).find(".RMPa").attr('href', profData.rmpURL);
  $(div).find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  $(div).find(".RMPatext").html(profData.rating);
  $(div).find(".tooltiptext").html(profData.rating + " / 5 Rating");

  return div.innerHTML;
}

function fillCourseGPATemplate(courseData) {
  var div = document.createElement('div');
  var ratingColor = (courseData.hasGPA) ? getGPAColor(courseData.avgGPA) : 'CCC';
  div.innerHTML = courseGPATemplate.slice();
  $(div).find(".RMPa").attr('href', courseData.anaanuURL);
  $(div).find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  $(div).find(".RMPatext").html(courseData.avgGPA);
  $(div).find(".tooltiptext").html(courseData.avgGPA + " / 4.0 Avg. GPA");

  return div.innerHTML;
}

function getRatingColor(rating) {
  var ratingColors = ['F91D06'/*red*/, 'FC6F22'/*orange*/, 'E6D600'/*yellow*/, '4EEB51'/*light green*/, '00B13D'/*dark green*/];
  return ratingColors[Math.floor((rating - 1) / 4.01 * ratingColors.length)];
}

function getGPAColor(gpa) {
  var colors = {
    "red": 'F91D06',
    "orange": 'FC6F22',
    "yellow": 'E6D600',
    "light green": '4EEB51',
    "dark green": '00B13D'
  };
  if (gpa >= 3.5) {
    return colors["dark green"];
  } else if (gpa >= 3.00) {
    return colors["light green"];
  } else if (gpa >= 2.5) {
    return colors["yellow"];
  } else if (gpa >= 2.00) {
    return colors["orange"];
  }
  return colors["red"];
}

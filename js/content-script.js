// listen for messages from the background page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.doAction) {
    sendResponse(true);
    checkStorageAndRunScript(true);
  } else {
    sendResponse(false);
  }
});

/** The zero-based index of the course code column in the table; */
const COURSE_CODE_COL_IDX = 1;
/** The zero-based index of the instructor column in the table; */
const INSTRUCTOR_COL_IDX = 6;

/** The data columns to include in the current page; */
var config = {
  "colsToInclude": ["rmp", "koofersRatings", "anaanu"]
};

// new columns that will be populated by data from RMP, Koofers, and Anaanu
var dataCols = {};

/** The subject that is selected at the top of the page; */
var selectedSubject;
/** All the instructor data on the page; */
var instructors = {};
/** All the course data on the page; */
var courses = {};

// resources
var loadingAnimationURL = chrome.extension.getURL("img/loading.gif");
var headerTemplates = {};
var cellTemplates = {};

// load resource files
(function() {
  console.time("resources");
  $.when(
    // load all of the cell templates
    $.get(chrome.runtime.getURL('/html/table_cells.html'), function(data) {
      // get the div elements from the html data
      $("div", $('<div></div>').html(data)).each(function(idx) {
        // set the cell elements in the cellTemplates object based on their type
        var typeOfCell = this.dataset.hhCellType;
        cellTemplates[typeOfCell] = this;
      });
    }),
    // load all of the header templates
    $.get(chrome.runtime.getURL('/html/table_headers.html'), function(data) {
      // get the table data elements from the html data
      $("td", $('<div></div>').html(data)).each(function(idx) {
        // set the header elements in the headerTemplates object based on their type
        var typeOfHeader = this.dataset.hhCellType;
        headerTemplates[typeOfHeader] = this;
      });
    })
  ).then(function() {
    console.timeEnd("resources");
    getSelectedSubject();
    traverseTable();
  });
})();

function getSelectedSubject() {
  selectedSubject = $("select[name='subj_code']")[0].value;
  console.log(selectedSubject);
}

function traverseTable() {
  // get the column before the point of injection for the new headers
  var instructorHeader = $(".dataentrytable > tbody > tr:first-of-type > td:nth-of-type(" + (INSTRUCTOR_COL_IDX + 1) + ")");
  if (typeof instructorHeader[0] == 'undefined') return;

  // insert table headers and initialize column arrays
  var prev = instructorHeader;
  config.colsToInclude.forEach(function(val, idx) {
    prev = $(headerTemplates[val]).insertAfter(prev);
    dataCols[val] = [];
  });

  // the row containing the table headers
  var headerRow = $(".dataentrytable > tbody > tr:first-child");
  // extra rows that just get in the way of things (but I still have to put blank cells in them)
  var otherRows = [];
  // the rows that could potentially have data added to them
  var dataRows = [];
  // regular expression for evaluating course code format
  var courseCodeRegex = new RegExp("[A-Z]{2,4}-[0-9]{4}");

  // gets each row in the table except the first one (the column headers)
  var rows = $(".dataentrytable > tbody > tr:not(:first-child)");
  var idx = 0;

  // iterates over the rows asynchronously to avoid blocking the UI
  var prom = new Promise(function(resolve, reject) {
    console.time("table traversal");
    async.whilst(
      function() { return idx < rows.length; },
      function(callback) {
        // set a min for how much time should be burnt during this function call
        var burnTimeout = new Date();
        burnTimeout.setTime(burnTimeout.getTime() + 50); // burnTimeout set to 50ms in the future

        do {
          var curEl = rows[idx];

          // create enough new cells (one for each column to include)
          var newCells = [];
          config.colsToInclude.forEach(function(val, idx) {
            var newCell = document.createElement("td");
            newCell.className = "RMPtd dedefault";
            newCells.push(newCell);
            dataCols[val].push(newCell);
          });

          var hasValidCourseCode = courseCodeRegex.test(curEl.cells[COURSE_CODE_COL_IDX].innerText);
          if (hasValidCourseCode) { // it's a row that data could potentially be grabbed for
            dataRows.push(curEl);

            // extract info from table
            var name = curEl.cells[INSTRUCTOR_COL_IDX].innerText;
            var course = curEl.cells[COURSE_CODE_COL_IDX].innerText;
            storeInfo(name, course, idx);

            // insert loading cells
            var colToInsertBefore = curEl.cells[INSTRUCTOR_COL_IDX].nextSibling;
            for (var cell of newCells) {
              // add loading bar animations for the cell while information is retrieved
              var node = document.createElement("img");
              node.src = loadingAnimationURL;
              node.className = 'RMPimg';
              cell.appendChild(node);
              // insert the cell into the row
              curEl.insertBefore(cell, colToInsertBefore);
            }
          } else { // it's an extra row that just gets in the way of things ("Comments", "Additional Times", etc. rows)
            otherRows.push(curEl);

            // default column to insert blank cells before
            var colToInsertBefore = curEl.cells[0];

            // identifies 'Comments' rows by checking the inner text of the second cell
            if (!!~curEl.cells[0].innerText.search(/comments/i)) { // the row is a 'Comments' row
              var colToInsertBefore = curEl.cells[1].nextSibling;
            } else { // the row is an 'Additional Times' row
              colToInsertBefore = curEl.cells[INSTRUCTOR_COL_IDX].previousSibling.previousSibling;
            }

            // insert blank cells
            for (var cell of newCells) {
              cell.innerText = "";
              curEl.insertBefore(cell, colToInsertBefore);
            }
          }
          idx++;
        } while ((new Date()) < burnTimeout && idx < rows.length); // while time hasn't burnt out and it's still passing its test

        // call the next iteration of the function
        setTimeout(function() { callback(null, idx); }, 0);
      },
      function (err, results) {
        console.timeEnd("table traversal");
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      }
    );
  });

  prom.then(fillDataCols);
}

function storeInfo(name, course, cellIdx) {
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
      "rmp": {
        "rating": "No Rating",
        "hasRating": false,
        "url": "http://www.ratemyprofessors.com/campusRatings.jsp?sid=1349"
      },
      "koofersRatings": {
        "rating": "No Rating",
        "hasRating": false,
        "url": "https://www.koofers.com/virginia-tech-vt/"
      },
      "anaanu": {
        "url": "http://anaanu.com/virginia-tech-vt/"
      }
    };
  }
  if (typeof instructors[name].courses[course] === 'undefined') {
    instructors[name].courses[course] = course;
  }
  instructors[name].associatedTableCells.push(cellIdx);

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
  courses[course].instructors[name].associatedTableCells.push(cellIdx);
}

function fillDataCols() {
  var chain = Promise.resolve("Start Data Retrieval Chain");

  // get RMP ratings
  chain.then(function() {
    console.log("Getting RMP ratings");
    return DataService.getRMPRatings(); // DataService is loaded from data-services.js
  })
  .then(fillRMPCells) // fill the RMP column with the data that's returned
  .catch(function(error) {
    console.log("Error while getting RMP ratings");
    fillRMPCells(undefined);
  });

  // get Koofers ratings
  chain.then(function() {
    console.log("Getting Koofers ratings");
    return DataService.getKoofersRatingsFor(selectedSubject);
  })
  .then(fillKoofersRatingsCells) // fill the Koofers ratings column with the data that's returned
  .catch(function(error) {
    console.log("Error while getting Koofers ratings")
    fillKoofersRatingsCells(undefined);
  });

  // get Koofers GPA


  // get Anaanu data through a series of separate requests
  Object.keys(courses).forEach(function(crs) {
    var course = courses[crs];
    var courseCode = course.subject + "-" + course.courseNum;
    chain.then(function() {
      console.log("Getting Anaanu data for " + courseCode);
      return DataService.getAnaanuDataFor(course.subject + "+" + course.courseNum);
    })
    .then(function(results) {
      fillAnaanuCells(course, results);
    })
    .catch(function(error) {
      console.log("Unable to get Anaanu data for " + courseCode);
      fillAnaanuCells(course, undefined);
    });
  });
}

function fillRMPCells(results) {
  Object.keys(instructors).forEach(function(inst, i) { // for every instructor
    inst = instructors[inst];
    // update instructor objects with data from results
    var resultsIdx = -1;
    if (results && (resultsIdx = results.binarySearch(inst, rmpSearchComparator)) > -1) {
      var resultRating = results[resultsIdx].averageratingscore_rf;
      inst.rmp.hasRating = (typeof resultRating !== 'undefined');
      inst.rmp.rating = (inst.rmp.hasRating) ? resultRating : inst.rmp.rating;
      inst.rmp.url = "http://www.ratemyprofessors.com/ShowRatings.jsp?tid=" + results[resultsIdx].pk_id;
      inst.firstName = results[resultsIdx].teacherfirstname_t;
      inst.lastName = results[resultsIdx].teacherlastname_t;
    }

    // update each of the cells associated with this professor
    var injection = "";
    for (var j = 0; j < inst.associatedTableCells.length; j++) {
      var curCellNum = inst.associatedTableCells[j];
      injection = fillRMPRatingTemplate(inst.rmp);
      $(dataCols.rmp[curCellNum]).css({opacity: 0});
      $(dataCols.rmp[curCellNum]).html(injection);
      $(dataCols.rmp[curCellNum]).animate({opacity: 1}, 1000);
    }
  });
}

function fillKoofersRatingsCells(results) {
  Object.keys(instructors).forEach(function(inst, i) { // for every instructor
    inst = instructors[inst];
    // update instructor objects with data from results
    var resultsIdx = -1;
    if (results && (resultsIdx = results.binarySearch(inst, koofersRatingsSearchComparator)) > -1) {
      var resultRating = results[resultsIdx].rating;
      inst.koofersRatings.hasRating = (resultRating !== undefined);
      inst.koofersRatings.rating = (inst.koofersRatings.hasRating) ? Math.round(resultRating * 100) / 100 : inst.koofersRatings.rating;
      inst.koofersRatings.url = results[resultsIdx].url;
      inst.firstName = results[resultsIdx].firstName;
      inst.lastName = results[resultsIdx].lastName;
    }

    // update each of the cells associated with this professor
    var injection = "";
    for (var j = 0; j < inst.associatedTableCells.length; j++) {
      var curCellNum = inst.associatedTableCells[j];
      injection = fillKoofersRatingTemplate(inst.koofersRatings);
      $(dataCols.koofersRatings[curCellNum]).css({opacity: 0});
      $(dataCols.koofersRatings[curCellNum]).html(injection);
      $(dataCols.koofersRatings[curCellNum]).animate({opacity: 1}, 1000);
    }
  });
}

function fillAnaanuCells(course, results) {
  Object.keys(course.instructors).forEach(function(inst, i) { // for every instructor of that course
    inst = course.instructors[inst];
    // update course objects with data from results
    var resultsIdx = -1;
    if (results && (resultsIdx = results.binarySearch(inst, anaanuSearchComparator)) > -1) {
      inst.a = results[resultsIdx].a;
      inst.b = results[resultsIdx].b;
      inst.c = results[resultsIdx].c;
      inst.d = results[resultsIdx].d;
      inst.f = results[resultsIdx].f;
      inst.hasGPA = true;
      inst.avgGPA = results[resultsIdx].gpa;
      inst.anaanuURL = inst.anaanuURL + "course/" + course.subject + "+" +
        course.courseNum + "/" + encodeURIComponent(results[resultsIdx].instructor);
    }

    // update each of the cells associated with this course and instructor
    var injection = "";
    for (var j = 0; j < inst.associatedTableCells.length; j++) {
      var curCellNum = inst.associatedTableCells[j];
      injection = fillAnaanuGPATemplate(inst);
      $(dataCols.anaanu[curCellNum]).css({opacity: 0});
      $(dataCols.anaanu[curCellNum]).html(injection);
      $(dataCols.anaanu[curCellNum]).animate({opacity: 1}, 1000);
    }
  });
}

function fillRMPRatingTemplate(profData) {
  var ratingColor = (profData.hasRating) ? getRatingColor(profData.rating) : 'CCC';
  var cell = $(cellTemplates["rmp"]).clone();
  cell.find(".RMPa").attr('href', profData.url);
  cell.find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  cell.find(".RMPatext").html(profData.rating);
  cell.find(".tooltiptext").html(profData.rating + " / 5 Rating");

  return cell.prop('outerHTML');
}

function fillKoofersRatingTemplate(profData) {
  var ratingColor = (profData.hasRating) ? getRatingColor(profData.rating) : 'CCC';
  var cell = $(cellTemplates["koofersRatings"]).clone();
  cell.find(".RMPa").attr('href', profData.url);
  cell.find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  cell.find(".RMPatext").html(profData.rating);
  cell.find(".tooltiptext").html(profData.rating + " / 5 Rating");

  return cell.prop('outerHTML');
}

function fillAnaanuGPATemplate(courseData) {
  var ratingColor = (courseData.hasGPA) ? getGPAColor(courseData.avgGPA) : 'CCC';
  var cell = $(cellTemplates["anaanu"]).clone();
  cell.find(".RMPa").attr('href', courseData.anaanuURL);
  cell.find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  cell.find(".RMPatext").html(courseData.avgGPA);
  cell.find(".tooltiptext").html(courseData.avgGPA + " / 4.0 Avg. GPA");

  return cell.prop('outerHTML');
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
  if (gpa >= 3.5) return colors["dark green"];
  else if (gpa >= 3.00) return colors["light green"];
  else if (gpa >= 2.5) return colors["yellow"];
  else if (gpa >= 2.00) return colors["orange"];
  return colors["red"];
}



/////////////////// Comparator Functions

function rmpSearchComparator(valToFind, arrVal) {
  var arrValLastName = arrVal.teacherlastname_t.toLowerCase();
  var arrValFirstName = arrVal.teacherfirstname_t.toLowerCase();
  var valToFindLastName = valToFind.lastName.toLowerCase();
  if (valToFindLastName == arrValLastName) {
    if (arrValFirstName.charAt(0) == valToFind.initials.toLowerCase().charAt(0)) {
      return 0;
    } else if (arrValFirstName.charAt(0) > valToFind.initials.toLowerCase().charAt(0)) {
      return 1;
    }
    return -1;
  }
  if (valToFindLastName > arrValLastName) {
    return 1;
  } else {
    return -1;
  }
}

function koofersRatingsSearchComparator(valToFind, arrVal) {
  var arrValLastName = arrVal.lastName.toLowerCase();
  var arrValFirstName = arrVal.firstName.toLowerCase();
  var valToFindLastName = valToFind.lastName.toLowerCase();
  if (valToFindLastName == arrValLastName) {
    if (arrValFirstName.charAt(0) == valToFind.initials.toLowerCase().charAt(0)) {
      return 0;
    } else if (arrValFirstName.charAt(0) > valToFind.initials.toLowerCase().charAt(0)) {
      return 1;
    }
    return -1;
  }
  if (valToFindLastName > arrValLastName) {
    return 1;
  } else {
    return -1;
  }
}

function anaanuSearchComparator(valToFind, arrVal) {
  var arrValLastName = arrVal.instructor.toLowerCase();
  var valToFindLastName = valToFind.lastName.toLowerCase();
  if (valToFindLastName == arrValLastName) {
    return 0;
  }
  if (valToFindLastName > arrValLastName) {
    return 1;
  }
  return -1;
}


function asyncHelper(array, performFunc, checkFunc) {
  return new Promise(function(resolve, reject) {
    loop();
    function loop() {
      if (checkFunc()) {
        setTimeout(loop, 0);
      } else {
        resolve();
        return;
      }

      var burnTimeout = new Date();
      burnTimeout.setTime(burnTimeout.getTime() + 50); // burnTimeout set to 50ms in the future

      do {
        performFunc(array);
      } while ((new Date()) < burnTimeout && checkFunc());
    }
  });
}

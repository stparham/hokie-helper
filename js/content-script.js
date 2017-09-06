/**
 * This file is injected into the course time table web page.
 * Its main purpose is to:
 * 1) gather information from the table
 * 2) store and organize that information
 * 3) ask the background page to retrieve information (from RMP, Koofers,
 *    Anaanu, or any other sites) based on the table information
 * 4) sort through and format the raw data returned by the background page
 * 5) place that data in new columns in the table on the web page.
 *
 * This is where the real "meat" of the Hokie Helper extension resides.
 *
 * @author Stanton Parham (stanton8parham8@gmail.com)
 */

// listen for messages from the background page
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.doAction) {
    sendResponse(true);
    checkStorageAndRunScript(true);
  } else {
    sendResponse(false);
  }
});

//////////////////////////////////////////
// WEAK POINT: If the website changes the order of the columns or the titles
// of the columns, then these constants may not be correct and later code may
// break as a result.
//////////////////////////////////////////
/** The zero-based index of the course code column in the table; */
const COURSE_CODE_COL_IDX = 1;
/** The zero-based index of the instructor column in the table; */
const INSTRUCTOR_COL_IDX = $('td:contains("Instructor")').index();

/** The data columns to include in the current page; */
var config = {
  /* TODO eventually set this up to read the columns to include from the
     settings that the user sets so they can choose which columns will show */

  /* Obviously, if a column is deselected, then its cells will not show, but
     I'm not sure if a deselected column should still grab its data from its
     site.  The main reason I'm not sure is because I think it would be cool if
     the updates to the table happened as soon as the user deslected a certain
     column in the settings (a popup from the extension could also show the
     settings instead of just the settings page).  I may be able to do this
     either way, but I haven't looked into it yet. */
  "colsToInclude": ["rmp", "koofersRatings", "anaanu"]
};

/** new columns that will be populated by data from RMP, Koofers, and Anaanu */
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

// load the resource files (html templates for data cols)
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

/**
 * Gets the subject the user selected at the top of the page;
 */
function getSelectedSubject() {
  selectedSubject = $("select[name='subj_code']")[0].value;
}

/**
 * Traverses the table of course information while grabbing instructor and
 * course information and inserting new cells for each of the data cols;
 */
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
    // using the async.min.js lib
    async.whilst(
      // the continuation test function
      function() { return idx < rows.length; },
      // the function that does the stuff
      function(callback) {
        /* The burn timeout stuff helps to maximize the advantage (and minimize
           the disadvantage) of using asynchronous table traversal. */
        // Set a min for how much time should be burnt during this function call;
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

  // once the table traversal is done, fillDataCols will be called
  prom.then(fillDataCols);
}

/**
 * Helper function for storing information gathered during the table traversal;
 * The information is stored in the instructors and courses objects declared
 * toward the top of the file.
 * @param {string} name - the name of the instructor to store info about
 * @param {string} course - the course associated with the instructor
 * @param {number} cellIdx - the index of the row in the table that the data came from
 */
function storeInfo(name, course, cellIdx) {
  // store instructor information
  if (typeof instructors[name] === 'undefined') { // if this instructor has not already been stored previously
    var split = name.split(' ');
    var initials = split[0];
    split.splice(0, 1); // get rid of initials
    var lastName = split.join(' '); // join any last names together
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
  if (typeof instructors[name].courses[course] === 'undefined') { // if this instructor and course combo has not been stored previously
    instructors[name].courses[course] = course;
  }
  instructors[name].associatedTableCells.push(cellIdx); // always store the cell associated with the data because it has to be a new row even if it is a repeat of the data

  // store course information
  if (typeof courses[course] === 'undefined') { // if this course has not been stored previously
    var split = course.split('-');
    courses[course] = {
      "subject": split[0],
      "courseNum": split[1],
      "associatedTableCells": [],
      "instructors": {},
      "anaanuURL": "http://anaanu.com/virginia-tech-vt/"
    }
  }
  if (typeof courses[course].instructors[name] === 'undefined') { // if this course and instructor combo has not been stored previously
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
  courses[course].instructors[name].associatedTableCells.push(cellIdx); // always store the cell associated with the data because it has to be a new row even if it is a repeat of the data
}


/**
 * Asks the background page (through the DataService object I wrote in
 * data-services.js) to retrieve data from all the data sites based on some
 * bits of information gathered during the table traversal;
 * Once the data is returned, this function calls a few other functions to fill
 * the returned data into the new data cols in the table.
 */
function fillDataCols() {
  var chain = Promise.resolve("Start Data Retrieval Chain");

  /* TODO Set up some kind of conditional flow so that only the information
     needed for the columns that the user has selected */

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

  // TODO get Koofers GPA

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

/**
 * Fills the RMP ratings data column in the table based on the results;
 * @param {array} results - an array of the ratings from the RMP site
 */
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

/**
 * Fills the Koofers ratings data column in the table based on the results;
 * @param {array} results - an array of the ratings from the Koofers site
 */
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

/**
 * Fills the Anaanu GPA data column in the table based on the results;
 * @param {array} results - an array of the stats about instructors from the Anaanu site
 */
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

/**
 * Fills out and returns a HTML template for an RMP rating data cell;
 * @param {object} profData - data about the instructor for the cell
 * @return {string} an HTML string for the filled-out cell
 */
function fillRMPRatingTemplate(profData) {
  var ratingColor = (profData.hasRating) ? getRatingColor(profData.rating) : 'CCC';
  var cell = $(cellTemplates["rmp"]).clone();
  cell.find(".RMPa").attr('href', profData.url);
  cell.find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  cell.find(".RMPatext").html(profData.rating);
  cell.find(".tooltiptext").html(profData.rating + " / 5 Rating");

  return cell.prop('outerHTML');
}

/**
 * Fills out and returns a HTML template for a Koofers rating data cell;
 * @param {object} profData - data about the instructor for the cell
 * @return {string} an HTML string for the filled-out cell
 */
function fillKoofersRatingTemplate(profData) {
  var ratingColor = (profData.hasRating) ? getRatingColor(profData.rating) : 'CCC';
  //var toolTipText = (profData.rating + " / 5 Rating" + " Avg GPA: " profData.g)
  var cell = $(cellTemplates["koofersRatings"]).clone();
  cell.find(".RMPa").attr('href', profData.url);
  cell.find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  cell.find(".RMPatext").html(profData.rating);
  cell.find(".tooltiptext").html(profData.rating + " / 5 Rating");

  return cell.prop('outerHTML');
}

/**
 * Fills out and returns a HTML template for an Anaanu GPA data cell;
 * @param {object} courseData - data about the course for the cell
 * @return {string} an HTML string for the filled-out cell
 */
function fillAnaanuGPATemplate(courseData) {
  var ratingColor = (courseData.hasGPA) ? getGPAColor(courseData.avgGPA) : 'CCC';
  var cell = $(cellTemplates["anaanu"]).clone();
  cell.find(".RMPa").attr('href', courseData.anaanuURL);
  cell.find(".RMPatext").attr('style', 'background-color: #' + ratingColor);
  cell.find(".RMPatext").html(courseData.avgGPA);
  cell.find(".tooltiptext").html(courseData.avgGPA + " / 4.0 Avg. GPA");

  return cell.prop('outerHTML');
}

/**
 * Returns the color associated with the given rating;
 * @param {number} rating - the rating to get the color for
 * @return {string} a hexadecimal color code as a string
 */
function getRatingColor(rating) {
  var ratingColors = ['F91D06'/*red*/, 'FC6F22'/*orange*/, 'E6D600'/*yellow*/, '4EEB51'/*light green*/, '00B13D'/*dark green*/];
  return ratingColors[Math.floor((rating - 1) / 4.01 * ratingColors.length)];
}

/**
 * Returns the color associated with the given gpa;
 * @param {number} gpa - the gpa to get the color of
 * @return {string} a hexadecimal color code as a string
 */
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



//////////////////////////////// Comparator Functions
/* These functions are used with the bin-search.js lib in order to look throug
   the results from the data sites quickly. */

/**
 * Used as the comparator function when searching through Rate My Professor ratings results;
 * @param {object} valToFind - the value to find in the array of results
 * @param {object} arrVal - the value in the array of results currently being compared against
 * @return {number} -1 if valToFind < arrVal, 0 if valToFind = arrVal, 1 if valToFind > arrVal
 */
function rmpSearchComparator(valToFind, arrVal) {
  var arrValLastName = arrVal.teacherlastname_t.toLowerCase();
  var arrValFirstName = arrVal.teacherfirstname_t.toLowerCase();
  var valToFindLastName = valToFind.lastName.toLowerCase();
  if (valToFindLastName == arrValLastName) {
    if (valToFind.initials.toLowerCase().charAt(0) == arrValFirstName.charAt(0)) {
      return 0;
    } else if (valToFind.initials.toLowerCase().charAt(0) > arrValFirstName.charAt(0)) {
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

/**
 * Used as the comparator function when searching through Koofers ratings results;
 * @param {object} valToFind - the value to find in the array of results
 * @param {object} arrVal - the value in the array of results currently being compared against
 * @return {number} -1 if valToFind < arrVal, 0 if valToFind = arrVal, 1 if valToFind > arrVal
 */
function koofersRatingsSearchComparator(valToFind, arrVal) {
  var arrValLastName = arrVal.lastName.toLowerCase();
  var arrValFirstName = arrVal.firstName.toLowerCase();
  var valToFindLastName = valToFind.lastName.toLowerCase();
  if (valToFindLastName == arrValLastName) {
    if (valToFind.initials.toLowerCase().charAt(0) == arrValFirstName.charAt(0)) {
      return 0;
    } else if (valToFind.initials.toLowerCase().charAt(0) > arrValFirstName.charAt(0)) {
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

/**
 * Used as the comparator function when searching through Anaanu GPA results;
 * @param {object} valToFind - the value to find in the array of results
 * @param {object} arrVal - the value in the array of results currently being compared against
 * @return {number} -1 if valToFind < arrVal, 0 if valToFind = arrVal, 1 if valToFind > arrVal
 */
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

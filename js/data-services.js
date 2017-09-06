/**
 * Just declaring a DataService object so that the following functions can be attached to it;
 */
function DataService() {
  this.name = "DataService"; // pointless but I thought the object might need
                             // at least one thing when it's declared (probably not)
}

/**
 * Asks the background page to get all the RMP ratings for the professors at Virginia Tech;
 * @return {Promise} a Promise that resolves with an array of the ratings from RMP
 */
DataService.getRMPRatings = function() {
  return new Promise(function(resolve, reject) {
    chrome.runtime.sendMessage({
      "type": "RMPRatings"
    }, function(response) {
      try {
        // resolve the Promise with the sorted results from RMP
        resolve(response.docs.sort(function(val1, val2) {
          var lastName1 = val1.teacherlastname_t.toLowerCase();
          var lastName2 = val2.teacherlastname_t.toLowerCase();
          if (lastName1 == lastName2) {
            var firstName1 = val1.teacherfirstname_t.toLowerCase();
            var firstName2 = val2.teacherfirstname_t.toLowerCase();
            if (firstName1.charAt(0) == firstName2.charAt(0)) return 0;
            if (firstName1.charAt(0) > firstName2.charAt(0)) return 1;
            return -1;
          }
          if (lastName1 > lastName2) return 1;
          return -1;
        }));
      } catch (error) {
        reject("Error while getting Rate My Professor ratings");
      }
    });
  });
};

/**
 * Asks the background page to get all the Koofers ratings for professors within a certain subject;
 * @param {string} subject - the subject to get professor ratings for
 * @return {Promise} a Promise that resolves with an array of the ratings from Koofers
 */
DataService.getKoofersRatingsFor = function(subject) {
  return new Promise(function(resolve, reject) {
    chrome.runtime.sendMessage({
      "type": "KoofersRatings",
      "subject": subject
    }, function(response) {
      try {
        // resolve the Promise with the sorted results from RMP
        resolve(response.sort(function(val1, val2) {
          var lastName1 = val1.lastName.toLowerCase();
          var lastName2 = val2.lastName.toLowerCase();
          if (lastName1 == lastName2) {
            var firstName1 = val1.firstName.toLowerCase();
            var firstName2 = val2.firstName.toLowerCase();
            if (firstName1.charAt(0) == firstName2.charAt(0)) return 0;
            if (firstName1.charAt(0) > firstName2.charAt(0)) return 1;
            return -1;
          }
          if (lastName1 > lastName2) return 1;
          return -1;
        }));
      } catch (error) {
        reject("Error while sorting Koofers ratings");
      }
    })
  })
};

/**
 * Asks the background page to get all the Koofers average GPAs for professors within a certain course;
 * @param {string} courseSubj - the subject of the course
 * @param {string} courseNum - the number of the course
 * @param {string} courseTitle - the title of the course
 * @return {Promise} a Promise that resolves with an array of the GPAs from Koofers
 */
DataService.getKoofersGPAFor = function(courseSubj, courseNum, courseTitle) {
  return new Promise(function(resolve, reject) {
    chrome.runtime.sendMessage({
      "type": "KoofersGPA",
      "courseSubj": courseSubj,
      "courseNum": courseNum,
      "courseTitle": courseTitle
    }, function(response) {
      if (response instanceof Error) {
        reject("Unable to get Koofers GPA");
      } else {
        resolve(response);
      }
    })
  })
};

/**
 * Asks the background page to get all the Anaanu data for professors within a certain course;
 * @param {string} course - the course code (in the format SUBJ+3333; ex: MATH+1225)
 * @return {Promise} a Promise that resolves with an array of the ratings from RMP
 */
DataService.getAnaanuDataFor = function(course) {
  return new Promise(function(resolve, reject) {
    chrome.runtime.sendMessage({
      "type": "AnaanuData",
      "course": course
    }, function(response) {
      if (response instanceof Error) {
        reject("Unable to get Anaanu data");
      } else {
        resolve(response);
      }
    });
  });
};

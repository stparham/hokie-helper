function DataService() {
  this.name = "DataService";
}

// gets all the RMP ratings for the professors at Virginia Tech
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

// gets all the Koofers ratings for professors within a certain subject
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

// gets all the Koofers average GPAs for professors within a certain course
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

// gets all the Anaanu data for professors within a certain course
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

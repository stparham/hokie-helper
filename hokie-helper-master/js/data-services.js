function DataService() {
  this.name = "DataService";
}

DataService.getRMPRatings = function() {
  return new Promise(function(resolve, reject) {
    chrome.runtime.sendMessage({
      "type": "RMPData"
    }, function(response) {
      try {
        resolve(response);
      } catch (error) {
        reject(error);
      }
    });
  });
};

DataService.getAnaanuDataFor = function(course) {
  return new Promise(function(resolve, reject) {
    // TODO implement an array of Promises here that will update the columns and make new requests as data comes back
    chrome.runtime.sendMessage({
      "type": "AnaanuData",
      "course": course
    }, function(response) {
      if (typeof response.error !== 'undefined') {
        reject(response.message);
      } else {
        resolve(response);
      }
    });
  });
};

// TODO get Koofers data
// DataService.getKoofersData = function() {
//   return new Promise(function(resolve, reject) {
//     chrome.runtime.sendMessage({
//       "type": "KoofersData"
//     }, function(response) {
//       try {
//         resolve(response);
//       } catch (error) {
//         reject(error);
//       }
//     });
//   });
// };

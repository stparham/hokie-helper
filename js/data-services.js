function DataService() {
  this.name = "DataService";
}

DataService.getRMPRatings = function() {
  return new Promise(function(resolve, reject) {
    chrome.runtime.sendMessage({
      "type": "RMPData"
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
        // reject the Promise with the error
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

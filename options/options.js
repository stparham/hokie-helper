function save_options() {
  var doAutorun = document.getElementById('autorun').checked;
  var doNotify = document.getElementById('notify').checked;
  var showParam = $("#show_param").val();
  chrome.storage.sync.set({
    'autorun': doAutorun,
    'notify': doNotify,
    'show' : showParam
  }, function() {
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 1250);
  });
}

function restore_options() {
  chrome.storage.sync.get(['autorun','notify', 'user_id', 'show'], function(items) {
    if(!('autorun' in items) || !('notify' in items) || !('user_id' in items) || !('show' in items)) {
        chrome.storage.sync.set({
            'autorun': true,
            'notify': false,
            'user_id': generateNewUserID(),
            'show' : 0
        }, function() {
          document.getElementById('autorun').checked = true;
          document.getElementById('notify').checked = false;
          $("#show_param").val('0');
        });
    } else {
      document.getElementById('autorun').checked = items.autorun;
      document.getElementById('notify').checked = items.notify;
      $("#show_param").val(items.show.toString());
    }
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

function generateNewUserID() {
  var id = Date.now().toString() + Math.floor(Math.random() * 1000000000).toString();
  console.log("New user id generated: " + id);
  return id;
}

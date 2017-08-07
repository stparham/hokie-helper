## General
- clean code
    - get rid of unused code from the ASU extension
- Figure out a more robust way of adding the columns into the time table
    - account for if comments are on
- When the user clicks the extension icon, have a few different things happen
    - If they aren't on the time table page, take them to it
    - Run/Rerun the content script on the page
    - Allow them to enable/disable certain columns
- Explain (in the description of the extension) that some data may be incorrect and users should not make final decisions for courses based on these statistics
    (Tell them to make sure to check the corresponding sites and verify the information displayed by the extension)
- Document where all the potential weak points are for the program (basically the points at which parsing will break if ANYTHING changes with the sites the data is coming from)


## Options
- Provide options for turning certain columns on and off
- Automatically run the script on the page or only when the user clicks the extension icon


## RMP (ratings for each professor)
- figure out how to grab professors only for the selected department (will help reduce overhead and incorrect ratings for profs with similar names)
    (there are a few incorrect ratings when searching courses in the Com Sci department)


## Anaanu (average GPA for a particular course and professor)
- ask Anaanu creator to make API so things won't break so easily


## Koofers (ratings for each professor / course data)
- figure out how to grab data from Koofers
- add Koofers column

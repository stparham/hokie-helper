##General
- change name to Hokie Helper
- have 3 columns added to the VT time table: RMP, Anaanu, Koofers
    (each column header should be a clickable link to the corresponding base web site for Virginia Tech)
- clean code
    - get rid of unused code from the ASU extension
- Explain (in the description of the extension) that some data may be incorrect and users should not make final decisions for courses based on these statistics
    (Tell them to make sure to check the corresponding sites and verify the information displayed by the extension)
- Figure out a more robust way of adding the columns into the time table
- Document where all the potential weak points are for the program (basically the points at which parsing will break if ANYTHING changes with the sites the data is coming from)


##RMP (ratings for each professor)
- figure out how to grab professors only for the selected department (will help reduce overhead and incorrect ratings for profs with similar names)
    (there are a few incorrect ratings when searching courses in the Com Sci department)


##Anaanu (average GPA for a particular course and professor)
- ask Anaanu creator to make API so things won't break so easily


##Koofers (ratings for each professor / course data)
- figure out how to grab data from Koofers
- add Koofers column

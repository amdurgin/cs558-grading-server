cs558-grading-server
====================

The grading server handles receiving the submissions, requests, etc. 
unpacking them, getting them graded, stored, and sending appropriate responses.

Usage:
```javascript
//Takes three arguments: port to use, ip address of server, and path to the 
// location to set up the server. port defaults to 8080, ip defaults to 
// localhost, and there is no default path. 
var createServer = require("cs558-grading-server");

//There are no members of server intentionally exposed, though you can 
//easily access the database: server.db, the grading object: server.grade,
//source handler: server.srcHandler. Once initialized the server immediately 
//builds the necessary framework, if necessary, and runs the server.
var server = createServer(port, ip, pathToPreferredLocationOfEverything);
```

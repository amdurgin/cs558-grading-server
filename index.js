var http = require("http");
var url = require("url");
var fs = require("fs");

var ClassDB = require("cs558-db");
var SrcHandler = require("cs558-submission-handler");
var AssignmentGrader = require("cs558-grader");
//var ServerLog = require("../server-logger/server-logger");

var ClassServer = function(port, ip, path){ 
  this.db = new ClassDB(path);
  this.grade = (new AssignmentGrader(path + "/Submissions/")).grade;
  //this.logger = new ServerLog(path);
  this.server;
  this.srcHandler = new SrcHandler(path + "/Submissions/");
  var argIp;
  var argPort;
  var db = this.db;
  var grade = this.grade;
  //var logger = this.logger;
  var srcHandler = this.srcHandler;

  //request callback  
  var reqCb = function(req, res){
    console.log("Received request");
    //handle GET
    if(req.method.localeCompare("GET") == 0){
      console.log("Received GET request");
      var urlObj = url.parse(req.url, true);
      console.log("Request URL path: " + urlObj.path.split("/"));

      if( urlObj.path.localeCompare() == 0 ){
        console.log(urlObj);
        var params = urlObj.query;
        var query = params.query;
        var aNum = params.aNum;
        var user = params.user;
        var password = params.password;
        console.log("query: " + query);
        console.log("anum: " + aNum);
        console.log("userpass: " + user + " " + password);

        switch(query) {
          case "Score":
            db.getAssignmentScore(user, password, aNum,
              function(err, val){
                if(err)
                  simpleResponse(res, err);
                else
                  simpleResponse(res, val);
              });
            break;
          case "Src": 
            db.getAssignmentSrc(user, password, aNum, 
              function(err, val){
                if(err)
                  simpleResponse(res, err);
                else
                  simpleResponse(res, val);
              });
            break;
          default :
            simpleResponse(res, "Bad Request.");
            break;
        }
      }
    }

    //handle OPTIONS request
    if(req.method.localeCompare("OPTIONS") == 0){
      res.writeHead(200, {
            "Content-Length" : 0,
            "Content-Type": "text/plain",
            "Allow": "GET, POST",
            "Access-Control-Allow-Origin" : "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET, POST"
          });
      console.log("Sent OPTIONS response");
      res.end();
    }

    //TODO:wow this is so ugly, but it works... i will make better later
    if(req.method.localeCompare("POST") == 0){
      console.log("Received POST request");
      var body = "";
      req.on("data", function(chunk) {
        console.log("Received new data chunk: " + chunk);
        body += chunk;
      });
      req.on("end", function(){
        console.log("Received all of POST data body");
        console.log("Body: " + body);
        //note json should be object of form 
        //{name, pass, aNum, srcTargz}
        var dataJson = JSON.parse(body);
        //TODO: add dataJson logic here, i.e. validating aNum, etc.

        try{ //run assingment modules in here, might throw errors, idk
          db.verifyStudent(dataJson.name, dataJson.pass, function(err){
            if(err){
              console.log(err);
              simpleResponse(res, "Bad username or password");
            }else{
              db.getAssignmentAttempts(dataJson.name, dataJson.pass, dataJson.aNum,
                function(err, attempts){
                  if(err){
                    console.log(err);
                    simpleResponse(res, "Error.");
                  }else{
                    srcHandler.extract(dataJson.name, dataJson.aNum, +attempts + 1,
                      new Buffer(dataJson.srcTargz), function(err, val){
                      if(err){
                        console.log(err);
                        simpleResponse(res, "Error.");
                      }else{ 
                        //store src
                        db.putAssignmentSrc(dataJson.name, dataJson.pass, dataJson.aNum,
                          new Buffer(dataJson.srcTargz), function(err){
                          if(err){
                            console.log(err);
                            simpleResponse(res, "Error.");
                          }else{ //now go through grading process
                            db.getAssignmentAttempts(dataJson.name, dataJson.pass, dataJson.aNum,
                              function(err, attempts){
                                if(err){
                                  console.log(err);
                                  simpleResponse("Error.");
                                }else{
                                  grade(dataJson.name, dataJson.aNum, attempts, function(err, result){
                                    if(err){ //problem w/ actuall assignment, 0 score
                                      var errMsg = String(err);
                                      db.putAssignmentScore(dataJson.name, dataJson.pass, dataJson.aNum,
                                        0, function(err){
                                        if(err){
                                          console.log(err);
                                          simpleResponse(res, "Error.");
                                        }else{//successfully stored score
                                          db.getMaxAssignmentScore(dataJson.name, dataJson.pass, dataJson.aNum, 
                                            function(err, max){
                                              if(err){
                                                console.log(err);
                                                simpleResponse("Error.");
                                              }else{
                                                simpleResponse(res, JSON.stringify({"score": 0,
                                                  "max": max, "attempts": attempts, "error": errMsg}));
                                              }
                                          }); //end getmaxassignmentscore()
                                        }
                                      }); //end putAssignmentScore()
                                    }else{ //no timeout or memory whoring
                                      db.putAssignmentScore(dataJson.name, dataJson.pass, dataJson.aNum,
                                        result.score, function(err){
                                        if(err){
                                          console.log(err);
                                          simpleResponse(res, "Error.");
                                        }else{//successfully stored score
                                          db.getMaxAssignmentScore(dataJson.name, dataJson.pass, dataJson.aNum, 
                                            function(err, max){
                                              if(err){
                                                console.log(err);
                                                simpleResponse("Error.");
                                              }else{
                                                simpleResponse(res, JSON.stringify({"score": result.score,
                                                  "max": max, "attempts": attempts, "error": "No errors."}));
                                              }
                                          }); //end getmaxassignmentscore()
                                        }
                                      }); //end putAssignmentScore()
                                    }
                                  }); //end grade()
                              }
                            }); //end putAssignmentAttempts()
                          }
                        }); //end putAssignmentSrc()
                      }
                    }); //end extract()
                  }
                }); //getattempts()
            }
          });//end verifyStudent()
        }catch(e){
          console.log(String(e));
          simepleResponse(res, "Error");
        }
      }); //end req.on("end")
    }
  }//end onReq() def

  //Start server
  //default por/ip
  var argPort = "8080";
  var argIp = "127.0.0.1";
  if(typeof port !== "undefined")
    argPort = port;
  if(typeof ip !== "undefined")
    argIp = ip;
  
  this.server = http.createServer(reqCb);
  this.server.listen(argPort, argIp);
}

var simpleResponse = function(res, data){
  res.writeHead(200, {
        //"Content-Length" : body.length,
        "Content-Length" : Buffer.byteLength(String(data)),
        "Content-Type": "text/plain",
  });
  res.end(String(data));
}

module.exports = ClassServer;

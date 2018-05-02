var restify = require('restify');
var builder = require('botbuilder');
var csv = require('csv-array');
var courses = [];


//positions of the parameters in the csv
var titlePosition = 0;
var typePosition = 1;
var formatPosition = 2;
var interestPosition = 3;
var expertisePosition = 4;
var targetPosition = 5;
var durationPosition = 6;
var infoPosition = 7;

function reset(){
  csv.parseCSV("courses.csv", function(data){
     courses = data;
     //mapItemsToFields();
   },false);
}

function removeDuplicates(coursesArray,colnr) {
  var newArray = [];
  var i = 0;
  for(var course of coursesArray){
    if (!newArray.includes(course[colnr])&&i>0){
      newArray.push(course[colnr]);
      }
    i=i+1;
  }
  return newArray;
}

reset();

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

var http = require('http');
var fs = require("fs");

http.createServer(function(request, response) {
  fs.readFile("test.html", function(err, data){
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write(data);
    response.end();
  });
}).listen(3000);



// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});


// Listen for messages from users
server.post('/api/messages', connector.listen());

var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector);

const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/8ef54f6e-1b7c-493b-b93d-45668bf93dbf?subscription-key=a1f8565cfb844254b2ff3b7076896d9a&verbose=true&timezoneOffset=60&q=';

var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
.matches('identity', (session) => {
    session.beginDialog('startDialog');
})
.matches('find_course', (session) => {
    session.beginDialog('findCourseDialog');
})
.matches('Cancel', (session) => {
    session.send('Do you want to stop?');
})
.onDefault((session) => {
    session.send('Sorry, I did not understand \'%s\'.', session.message.text);
});

//bot.dialog('/', intents);
//bot.dialog('/', startDialog);

bot.dialog('startDialog', [
  function (session) {
    session.send('I am the Imec Academy bot, AIBOT for short, nice to meet you');
    builder.Prompts.choice(session, "Would you like me to help you find one of our great courses?", ["yes","no"], { listStyle: builder.ListStyle.button });
  },
  function (session, results) {
    if (results.response.entity == "yes")
        session.beginDialog('findCourseDialog');
    else   session.beginDialog('endDialog');
  }
  ]);

bot.dialog('endDialog', [
    function (session) {
      session.send('Ok, see you next time then. Feel free to contact me at any time of the day!');
      session.endDialog("It was lovely talking to you!");
    }
    ]);

bot.dialog('findCourseDialog', [
  //todo: make sure the choices can be made are restricted by the previous choices, so the user is more likely to find a course
  function (session) {
      session.send("Ok, let's go find you a course...");
      type = removeDuplicates(courses,typePosition)
      builder.Prompts.choice(session, "What type of course are you interested in?", type, { listStyle: builder.ListStyle.button });
  },
  function (session, results) {
      session.dialogData.type = results.response;
      filteredCourses = findCoursesByContext(typePosition,results.response.entity);
      areaOfInterest = removeDuplicates(filteredCourses,interestPosition)
      builder.Prompts.choice(session, "Please provide an area of interest", areaOfInterest, { listStyle: builder.ListStyle.button });
  },
  function (session, results) {
      //show only the titles of the selected courses and allow the user to choose one
      session.dialogData.areaOfInterest = results.response;
      filteredCourses = findCoursesByContext(interestPosition,results.response.entity);
      title = removeDuplicates(filteredCourses,titlePosition);
      builder.Prompts.choice(session, "We found the following courses for you. Click one to find out more.", title, { listStyle: builder.ListStyle.button });
  },
  function (session, results) {
      session.dialogData.title = results.response;
      filteredCourses = findCoursesByContext(titlePosition,results.response.entity);
      console.log("******info");
      console.log(filteredCourses[0][infoPosition]);
      session.send(filteredCourses[0][infoPosition]);
      session.send("Expertise level: "+filteredCourses[0][expertisePosition]);
      session.send("Duration: "+filteredCourses[0][durationPosition]);
      session.send("Target audience: "+filteredCourses[0][targetPosition]);
      session.send("Delivery format: "+filteredCourses[0][formatPosition]);
      //builder.Prompts.choice(session, "Please provide an area of interest", areasOfInterest, { listStyle: builder.ListStyle.button });
      builder.Prompts.choice(session, "Would you like to enroll in this course?", ["yes","no"], { listStyle: builder.ListStyle.button });
  },
  function (session, results) {
      if (results.response.entity == "yes") {
          builder.Prompts.choice(session, "What is your email address?");
          }
      else {
        builder.Prompts.choice(session,"Ok, would you like to look for another course?", ["yes","no"], { listStyle: builder.ListStyle.button });
      }
  },
  function (session, results) {
      if (results.response.entity == "yes") {
        session.beginDialog('findCourseDialog');
      }
      if (results.response.entity == "no") {
        session.beginDialog('endDialog');
      }
      if ((results.response.entity != "no") && (results.response.entity != "yes")) {
        console.log("************enrolling logic");
        session.dialogData.email = results.response;
        session.send(results.response.entity);
        session.send("Ok, one of my collegues at imec Academy wil get in touch for more info on this course.");
      }
  }
  ]);

    // The dialog stack is cleared and this dialog is invoked when the user enters 'help'.
    bot.dialog('help', function (session, args, next) {
        session.endDialog("I can help you find an imec Academy course. Let's try it out.");
    })
    .triggerAction({
        matches: /^help$/i,
    });

/*
searchIndex: the column of the array in which to search
searchTerm: the string which the search should match
*/
function findCoursesByContext(searchIndex,searchTerm) {
  filteredCourses = courses.filter(o => o[searchIndex] === searchTerm);
  return filteredCourses;
}

/*
Als het mogelijk is, zou ik de chatbot graag nog wat meer vragen laten stellen op basis van de variabelen in de Excel lijst? Hieronder alvast een voorstel:
1.       Are you an imec employee? YES/NO (kolom E)
2.       What type of courses are you interested? BUSINESS TRAINING / TECHNICAL TRAINING (wordt reeds gevraagd door de bot maar zou enkel gevraagd moeten worden als het een imec medewerker is gezien een externe geen toegang heeft tot business trainings)
3.       Please provide an area of interest? (is ok) (kolom C)
4.       What is your level of expertise in this area? BASIC/INTERMEDIATE/HIGH (select one or more) (kolom D)
5.       In which type of training format(s) are you interested? CLASSROOM/HANDSON/SEMINAR/RECORDING (select one or more) (kolom B)
6.       Als resultaat zou de person één of meerdere relevante trainings moeten zien. Als hij/zij daarop doorklikt zou hij/zij enkel een korte omschrijving moeten zien en de duurtijd (en dus liefst niet meer de expertise level, target audience en delivery format gezien deze al in de vragen verwerkt zijn)
*/


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

var internalTag = "Internal only";
var externalTag = "External only";
var bothTag = "Both";

function reset(){
  csv.parseCSV("courses.csv", function(data){
     courses = data;
   },false);
}

/*
removes duplicate exntries in a vertain column of an array and returns this diplicate-free 1-dimensional array
*/
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

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});


// Listen for messages from users
server.post('/api/messages', connector.listen());

var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector,[
  function (session) {
    session.beginDialog('startDialog');
  }
]).set('storage', inMemoryStorage);

const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/8ef54f6e-1b7c-493b-b93d-45668bf93dbf?subscription-key=a1f8565cfb844254b2ff3b7076896d9a&verbose=true&timezoneOffset=60&q=';

var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer]})
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
})

//bot.dialog('/', intents);

/*
Make sure that the default dialog is started when the user initiates a new session
*/
  bot.on('conversationUpdate', function (message) {
      if (message.membersAdded) {
          message.membersAdded.forEach(function (identity) {
              if (identity.id === message.address.bot.id) {
                  bot.beginDialog(message.address, '/');
              }
          });
      }
  });

bot.dialog('startDialog', [
  function (session) {
    session.send('Hi there, I am the Imec Academy bot, AIBOT for short, nice to meet you!');
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
      builder.Prompts.choice(session, "Are you on the imec payroll?", ["yes","no"], { listStyle: builder.ListStyle.button });
  },
  function (session, results,next) {
    //todo: add selection by target
    filteredCourses = [];
    session.dialogData.employeeType = "";
    if (results.response.entity == "yes") {
        session.dialogData.employeeType = internalTag
        filteredCourses = findCoursesByContext(targetPosition,internalTag,bothTag);
        type = removeDuplicates(filteredCourses,typePosition)
        builder.Prompts.choice(session, "What type of course are you interested in?", type, { listStyle: builder.ListStyle.button });
    }
    if (results.response.entity == "no") {
        session.dialogData.employeeType = externalTag;
        next();
    }
  },
  function (session, results) {
      if (session.dialogData.employeeType == internalTag) {
        session.dialogData.type = results.response.entity;
        }
      if (session.dialogData.employeeType == externalTag) {
        //todo: make sure the following string is read from the csv and not hard-coded
        session.dialogData.type = "Technical training"
        }
      filteredCourses = findCoursesByContext(typePosition,session.dialogData.type);
      session.dialogData.filteredCourses = filteredCourses;
      areaOfInterest = removeDuplicates(filteredCourses,interestPosition);
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
        builder.Prompts.text(session, "What is your email address?");
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
        session.dialogData.email = results.response;
        session.send(results.response.entity);
        session.send("Ok, one of my collegues at imec Academy wil get in touch for more info on this course.");
        session.beginDialog('startDialog');
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

function findCoursesByContext(searchIndex,searchTerm1,searchTerm2) {
  filteredCourses = courses.filter(o => (o[searchIndex] === searchTerm1 || o[searchIndex] === searchTerm2));
  console.log(filteredCourses);
  return filteredCourses;
}

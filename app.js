var restify = require('restify');
var builder = require('botbuilder');
var csv = require('csv-array');
var courses;


csv.parseCSV("courses.csv", function(data){
   courses = data;
},false);


function mapItemsToField(colnr,data) {
  /*for(var course of data){
    console.log(course);
  }*/
}

mapItemsToField(3,courses);

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
    //appId: null,
    //appPassword: null
});


// Listen for messages from users
server.post('/api/messages', connector.listen());

function findCourse(area,expertise,duration) {
  //var course = courses.find(o => o[0] === parameter);
  var course = courses.find(o => o[3] === area && o[4] === expertise && o[5]);
  console.log("****found course: "+course);
  return course;
}




// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
/*
var bot = new builder.UniversalBot(connector, function (session) {
    var course = findCourse(session.message.text)
    //session.send("You said: %s", session.message.text);
    session.send("Found course: %s", course);
});
*/

var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector);

bot.dialog('findCourseDialog', [
      function (session) {
          session.send("Welcome to the imec Academy course recommendation bot.");
          //builder.Prompts.text(session, "Please provide an area of interest");
          builder.Prompts.choice(session, "Please provide an area of interest", "Technology|IC-design|Life science", { listStyle: builder.ListStyle.button });

      },
      function (session, results) {
          session.dialogData.areaOfInterest = results.response;
          builder.Prompts.text(session, "What is your level of exepertise?");
      },
      function (session, results) {
          session.dialogData.expertise = results.response;
          builder.Prompts.text(session, "How long much time are you willing to spend on the training?");
      },
      function (session, results) {
          session.dialogData.duration = results.response;

          // Process request and display reservation details
          //session.send(`Reservation confirmed. Reservation details: <br/>Date/Time: ${session.dialogData.reservationDate} <br/>Party size: ${session.dialogData.partySize} <br/>Reservation name: ${session.dialogData.reservationName}`);
          session.send(`Your details: ${session.dialogData.areaOfInterest.entity} <br/>Expertise level: ${session.dialogData.expertise} <br/>Duration: ${session.dialogData.duration}`);
          var course = findCourse(session.dialogData.areaOfInterest.entity,session.dialogData.expertise,session.dialogData.duration)
          session.send('We found the following couse for you:'+course);
          session.endDialog();
      }
    ])

    // The dialog stack is cleared and this dialog is invoked when the user enters 'help'.
    bot.dialog('help', function (session, args, next) {
        session.endDialog("I can help you find an imec Academy course. Let's try it out.");
    })
    .triggerAction({
        matches: /^help$/i,
    });

const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/8ef54f6e-1b7c-493b-b93d-45668bf93dbf?subscription-key=a1f8565cfb844254b2ff3b7076896d9a&verbose=true&timezoneOffset=60&q=';

var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
.matches('identity', (session) => {
    session.send('I am the Imec Academy bot, AIBOT for short, nice to meet you');
})
.matches('find_course', (session) => {
    //session.send("Let's try to find you a course");
    session.beginDialog('findCourseDialog');
})
.matches('Cancel', (session) => {
    session.send('Do you want to stop?');
})
.onDefault((session) => {
    session.send('Sorry, I did not understand \'%s\'.', session.message.text);
});

bot.dialog('/', intents);

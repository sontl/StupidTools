/**
 * Created by sontl on 27/4/14.
 */

var request =  require("request");
var DOMParser = require('xmldom').DOMParser;
var plivo = require('plivo');
var Step = require('step');

var p = plivo.RestAPI(require('./config'));
var playableDays = ["Saturday", "Sunday"];
var DataStore = [];
var playableHours = {"code" : "17:00:00;19:00:00", "text" : "5.00pm - 7.00pm"};
var playableField = "5-a-side";
var receiverNumbers = ["6594343564", "6582656308"] ;
var intervalTime = 5 * 60 * 1000; //5 minutes
var smsData;
//var receiverNumber = "6582656308"; //anh Hung number

setInterval(function(){
    startJob()
}, intervalTime );


startJob();

function startJob(){
    Step(
        function craw() {
            console.log("Start crawling on" + new Date());
            smsData = []; //reset every time
            var playableDates = getPlayableDateNextIncomingWeeks(playableDays, 2);
            for (var i =0; i < playableDates.length; i++ ) {
                var playableDate = playableDates[i];
                var playableData = toPlayableData(playableDate); // data format: { 'date': '2014-05-10', 'smsCount' : 3};
                if( playableData.smsCount < 3 ) {
                    shoot(playableData, this.parallel() ); //async call
                }
            }
        },
        function sms(err) {
            if (err) {
                throw err;
            } else {
                if (smsData.length > 0) {
                    var message = "Book it Now! StWilfrid Field available on ";
                    for (var i=0; i<smsData.length; i++) {
                        message += smsData[i].date + ", ";
                    }
                    message += "for " + playableField + " fields, from " + playableHours.text + ". //SonTL";
                    console.log(message);
                    //send sms
                    Step(
                        function sendSmsToEachReceiver() {
                            for (var i = 0; i < receiverNumbers.length; i++) {
                                sendSms(receiverNumbers[i], message, this.parallel()); //async call
                            }
                        },
                        function saveData(err, status, response) {
                            if (err) {
                                throw err;
                            } else {
                                console.log("res code: " + status);
                                for (var i = 0; i < smsData.length; i++) {
                                    smsData[i].smsCount++;
                                }
                                //save to DataStore
                                saveToDataStoreArr(smsData);
                            }
                        }
                    );
                }
            }
        }
    );

}

function toPlayableData(date) {
    var playableData = {
        'date' : date,
        'smsCount' : 0
    };
    for (var i =0; i< DataStore.length; i++ ) {
        var dateInStore = DataStore[i];
        if (playableData.date === dateInStore.date) {
            playableData = dateInStore;
            break;
        }
    }
    return playableData;
}

function shoot(playableData, callback) {
    var myActiveSGurl = "https://members.myactivesg.com/facilities/ajax/getTimeslots?activity_id=207&venue_id=255&date="
        + playableData.date;
    console.log(myActiveSGurl);
    request(myActiveSGurl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            body = body.replace(/\\n/g, '');
            body = body.replace(/\\/g, '');
            //console.log(body);
            var availableSlots = findAvailableSlots(body);
            if (availableSlots.length > 0) {
                console.log(playableData.date);
                smsData.push(playableData);
            }
        } else {
            console.log( "No response from MyActiveSG. Error: " + error);
            console.log( "Response code: " + response.statusCode);
            console.log( "Body: " + body);
        }
        callback();
    })
}

function findAvailableSlots(body) {
    var availableSlots = [];
    var doc = new DOMParser().parseFromString(body,'text/xml');
    var docElements = doc.getElementsByTagName("input");
    for ( var i = 0; i < docElements.length; i++) {
        var element = docElements[i];
        if(!element.hasAttribute("disabled")){
            var elementValue = element.getAttribute("value");
            if (elementValue.indexOf(playableField) != -1 && elementValue.indexOf(playableHours.code) != -1 ) {
                console.log(elementValue);
                availableSlots.push(elementValue);
            }
        }
    }
    return availableSlots;
}

function saveToDataStoreArr(dataArr) {
    for (var i=0; i<dataArr.length; i++) {
        saveToDataStore(dataArr[i]);
    }
}

function saveToDataStore(data) {
    var isExistingInStore = false;
    var dateInStore;
    for (var i=0; i< DataStore.length; i++) {
        dateInStore = DataStore[i];
        if (data.date === dateInStore.date) {
            isExistingInStore = true;
            break;
        }
    }
    if (isExistingInStore){
        dateInStore = data; //update existing
        console.log(data.date + "/" + data.smsCount  + " is updated.")
    } else {
        DataStore.push(data); //add new
        console.log(data.date + "/" + data.smsCount + " is added.")
    }
}

function getPlayableDateNextIncomingWeeks(playableDays, numberOfWeek) {
    var dates = [];
    for ( var i = 0; i < numberOfWeek; i++) {
        for ( var j = 0; j < playableDays.length; j++) {
            dates.push(getIncomingDate(playableDays[j],i));
        }
    }
    return dates;
}

/*
    Get incoming date in format YYYY-MM-DD
    e.g : getIncomingDate("Sunday", 2) return 2014-05-10;
 */
function getIncomingDate(day, numberOfWeek){
    var incomingWeek = new Date(new Date().getTime() + 60 * 60 * 24 * 7 * 1000 * numberOfWeek);
    var incomingDay = incomingWeek.getDay();
    var diffToMonday = incomingWeek.getDate() - incomingDay + (incomingDay === 0 ? -6 : 1) ;
    var dayInUpperCase = day.toUpperCase();
    var x = 0;
    switch (dayInUpperCase) {
        case "MONDAY" :
        case "MON" :
            x = 0;
            break;
        case "TUESDAY" :
        case "TUE" :
            x = 1;
            break;
        case "WEDNESDAY" :
        case "WED" :
            x = 2;
            break;
        case "THURSDAY" :
        case "THU" :
            x = 3;
            break;
        case "FRIDAY" :
        case "FRI" :
            x = 4;
            break;
        case "SATURDAY" :
        case "SAT" :
            x = 5;
            break;
        case "SUNDAY" :
        case "SUN" :
            x = 6;
            break;
        default : //default is Saturday
            x = 5;
    }

    var incomingDate = new Date(incomingWeek.setDate(diffToMonday + x));
    //console.log(day + " of next " + (numberOfWeek+1) + " week is " +  incomingDateInFormat);
    return convertDate(incomingDate);
}

function convertDate(d) {
    function pad(s) { return (s < 10) ? '0' + s : s; }
    return [ d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate()) ].join('-');
}

/**
 * Send SMS from Plivo
 */
function sendSms(receiverNumber, message, callback) {
    var params = {
        'src': '16012815562', // Caller Id
        'dst' : receiverNumber, // User Number to Call
        'text' : message,
        'type' : "sms"
    };
    console.log("sendSms called");
    p.send_message(params, function (status, response) {
        console.log('SMS Status: ', status);
        console.log('SMS API Response:\n', response);
        callback(null,status,response);
    });
}

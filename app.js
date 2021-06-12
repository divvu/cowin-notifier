#!/usr/bin/env node
const request = require("request");
const argv = require('minimist')(process.argv.slice(2));
const sound = require("sound-play");
const path = require("path");
const { format } = require('date-fns');
const notificationSound = path.join(__dirname, "alert-sound/beep.wav");
var noOfAttempt = 0;
var timeoutCount = 0;

console.log(
  `
  #################################
  ###      COWIN NOTIFIER       ###
  ###      Version:  1.0.7      ###
  ###   Author: Divyansh Singh  ###
  #################################
  `
  );

checkParams();

function checkParams() {
    if (argv.help) {
        console.error('Refer documentation for more details');
    } else if (argv._ && argv._.length && argv._.includes('run')) {
        if (!argv.age) {
            console.error('Please provide your age by appending --age=<YOUR-AGE> \nRefer documentation for more details');
            return;
        } else if (!argv.district && !argv.pin) {
            console.error('Please provide either district-id or pincode by appending --district=<DISTRICT-ID> or --pin=<PINCODE> \nRefer documentation for more details');
            return;
        } else if (argv.pin && argv.pin.toString().length !== 6) {
            console.error('Pincode must be a 6 digit number \nRefer documentation for more details');
            return;
        } else if (!argv.dose || (argv.dose && argv.dose !== 1 && argv.dose !== 2)) {
            console.error('Please mention if your require first dose or second dose by passing --dose=1 or --dose=2 \n');
            return;
        } 
        else if ((argv.vaccine && typeof argv.vaccine !== 'string') || (argv.vaccine && argv.vaccine.toLowerCase() !== 'covishield' && argv.vaccine.toLowerCase() !== 'covaxin')) {
            console.error('Please provide vaccine param as COVISHIELD or COVAXIN');
            return;
        }
        else if (argv.mob && argv.mob.toString().length !== 10) {
          console.error('mobile no. must be a 10 digit number \nRefer documentation for more details');
          return;
        }
        else if ((argv.cost && typeof argv.cost !== 'string') || (argv.cost && argv.cost.toLowerCase() !== 'free' && argv.cost.toLowerCase() !== 'paid')){
          console.error('Please provide cost param as FREE or PAID');
          return;
        }
        else if ((argv.keep_searching && typeof argv.keep_searching !== 'string') || (argv.keep_searching && argv.keep_searching.toLowerCase() !== 'true' && argv.keep_searching.toLowerCase() !== 'false')){
          console.error('Please provide keep_searching param as True or False');
          return;
        }
        else {            
            const params = {
                vaccine: argv.vaccine, 
                dose: argv.dose, 
                age: argv.age,
                districtId: argv.district,
                date: format(new Date(), 'dd-MM-yyyy'),
                pin: argv.pin,
                cost: argv.cost,
                keep_searching: argv.keep_searching
            }
            console.log('\nCowin vaccine availability notifier started succesfully\n');
            console.log(`Date = ${params.date}`);
            console.log(`Age = ${params.age}`);
            console.log(`Dose = ${params.dose === 1 ? 'First Dose' : 'Second Dose'}`);
            params.vaccine && console.log(`Vaccine = ${params.vaccine.toUpperCase()}`);
            params.cost && console.log(`Cost = ${params.cost.toUpperCase()}`);
            if (params.pin) {
                console.log(`Pincode = ${params.pin}`);
            } else {
                console.log(`District ID = ${params.districtId}`);
            }
            console.log('\nMake sure to turn up the volume to hear the notifcation sound')
            console.log('\n\n')
            checkVaccineAvailabilty(params);
        }
    } else {
        console.log('\nInvalid command\n\nRun `cowin-notifier run` with all required params to start pinging cowin portal\nRefer documentation for instructions on how to run package\n');
    }
}

var getOTP = function(){
  const apiBaseURL = 'https://cdn-api.co-vin.in/api/v2/auth/public/';
  var options = { 
    method: 'POST',
    url: apiBaseURL+"generateOTP",
    headers: 
    { 
      'Content-Type': 'application/json' 
    },
    body: { mobile: argv.mob },
    json: true 
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log("OTP sent. Check your phone.")
  });

}

function checkVaccineAvailabilty({ age, districtId, date, pin, vaccine, dose, cost }){
  var availableCenters = {
    count: 0,
    centers: []
  };
  const apiBaseUrl = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/'
  let url = pin ? `${apiBaseUrl}calendarByPin?pincode=${pin}&date=${date}` : `${apiBaseUrl}calendarByDistrict?district_id=${districtId}&date=${date}`
  let isSlotAvailable = false;
  var options = { 
    method: 'GET',
    url: url,
    headers: 
    { 
      'Content-Type': 'application/json' 
    },
    json: true 
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    if( body.centers ){
      for(var i = 0; i < body.centers.length; i++){
        var center = body.centers[i];
        for(var j = 0; j < center.sessions.length; j++){
          var session = center.sessions[j];
          if( session.min_age_limit <= age && session.available_capacity > 0){
            if( (dose === 1 && session.available_capacity_dose1 > 0) ||  (dose === 2 && session.available_capacity_dose2 > 0) ){
              if( !vaccine || ( vaccine && vaccine.toLowerCase() == session.vaccine.toLowerCase() ) ){
                if( !cost || ( cost && cost.toLowerCase() == center.fee_type.toLowerCase() ) ){
                  isSlotAvailable = true;
                  availableCenters.centers.push({
                    name: center.name,
                    address: center.address,
                    cost: center.fee_type,
                    date: session.date,
                    available_capacity_dose1: session.available_capacity_dose1,
                    available_capacity_dose2: session.available_capacity_dose2,
                    vaccine: session.vaccine
                  });
                  availableCenters.district = center.district_name;
                  availableCenters.count++;
                }
              }
            }
          }
        }
      }
      if( isSlotAvailable == true ){
        console.log(`Slot(s) found at below centers with availabilty as of :  ${format( new Date(), "dd-MM-yyyy hh:mm:ss")}`);
        console.log(availableCenters);
        notify( { age, districtId, date, pin, vaccine, dose, cost } );
      } 
      else {
        noOfAttempt++;
        console.log("fetching again.. attempt no. " + noOfAttempt);
        setTimeout(() => { checkVaccineAvailabilty({ age, districtId, date, pin, vaccine, dose, cost }) }, 30000); // call with 30 seconds delay.
      } 
    }
    else{
      timeoutCount++;
      console.log("timeoutCount:", timeoutCount);
      setTimeout(() => { checkVaccineAvailabilty({ age, districtId, date, pin, vaccine, dose, cost }) }, 300000); // call with 5 mints delay.
    }
  })
}


notify = function ( { age, districtId, date, pin, vaccine, dose, cost } ){
  sound.play(notificationSound);
  if(argv.mob) getOTP();
  if(argv.keep_searching && argv.keep_searching.toLowerCase() == "true") setTimeout(() => { checkVaccineAvailabilty({ age, districtId, date, pin, vaccine, dose, cost }) }, 30000);
}

 

var express = require("express");
var logfmt = require("logfmt");
var app = module.exports =  express();
var url = require('url');
var pg = require('pg');
var http = require('http');
var path = require('path');
var request = require('request');


console.log(process.env.DATABASE_URL);
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'hjs');
app.engine('html', require('ejs').renderFile);

// app.use(express.favicon());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.bodyParser());  // including this line to try app.post below
app.use(express.static(path.join(__dirname, 'public')));
// app.use(logfmt.requestLogger());

if ('development' == app.get('env')) {
  app.use(express.errorHandler());
  app.use(express.logger('dev'));
}


//set up our client connection info for Postgres
var client = new pg.Client(process.env.DATABASE_URL);

//Create Necessary Tables in Postgres
var createTable = function(){
  client.connect();
  client.query('CREATE TABLE IF NOT EXISTS soildata (id SERIAL PRIMARY KEY, reading INTEGER, pi_id text, sensor_id INTEGER, recordtime text, isdry Boolean)');
  client.query('CREATE TABLE IF NOT EXISTS piunits (id SERIAL PRIMARY KEY, ownedby text, serial_num text, redline INTEGER, sensor_id INTEGER)');
}; 


//get all soil data
app.get('/data', function(req, res){ 
  query = client.query('SELECT * FROM soildata', function(err, result){
    if(!result){
      return res.send('no data');
    } else {
      res.send(result);
    }
  });
});

//get all pi units
app.get('/pi', function(req, res){
  query = client.query('SELECT * FROM piunits',function(err, result){
    if(!result){
      return res.send('no data');
    } else {
      res.send(result);
    }
  }); 
});

//Add sensor data to given plant under given pi
app.post('/:reading/:pi_id/:sensor_id', function(req, res){
  
  var data = req.params; 
  console.log(data);

  var reading = data.reading;
  var pi_id = data.pi_id;
  var sensor_id = data.sensor_id;
  var d = (new Date()+'').split(' ');
  var date = [d[1], d[2], d[3], d[4]].join(' '); //formatting datetime to show on chart
  // var date = new Date();
  console.log(pi_id);
  console.log(sensor_id);
  console.log(reading);
  console.log(date);

 
    client.query('SELECT redline, ownedby FROM piunits INNER JOIN soildata ON pi_id = serial_num WHERE soildata.sensor_id = piunits.sensor_id Limit 1',
    function(err, result){
      // console.log((result.rows[0].redline), "this is the result");
      var redline_value = result.rows[0].redline; 
      var ownedby = result.rows[0].ownedby;
      var dryness;
      if(reading > redline_value){
        dryness = true;
        } else {
          dryness = false;
        }

      if(dryness){
        client.query('SELECT * FROM soildata WHERE pi_id = \''+ pi_id +'\' AND sensor_id = '+sensor_id + 'AND isdry = false ORDER BY recordtime desc limit 1', function(err, result){
          if (err){console.log(err);}
          var last_tweet = new Date(result.rows[0].recordtime);
          var currentdate = new Date(date);
          var difference= (currentdate-last_tweet);
          difference = (difference/3600000);
          console.log(last_tweet);
          console.log(currentdate);
          console.log(currentdate-last_tweet);
          res.send("200, success");
      // request.post("http://projectlorax.herokuapp.com/notify/" + ownedby+"/"+pi_id+"/"+sensor_id);
        });
      }

        // client.query('INSERT INTO soildata(reading, pi_id, sensor_id, recordtime, isdry) VALUES($1, $2, $3, $4, $5)', [reading, pi_id, sensor_id, date, dryness],
        //     function(err, result){
        //         if (err){console.log(err, "error inserting to PG");}
        //         res.send(req.params);
        // });
    });
});


//add User's new Pi Unit to Pi Unit database
app.post('/register/:ownedby/:serial_num/:sensor_id/:redline', function(req, res){
  
  var data = req.params; 
  console.log(data);

  var ownedby = data.ownedby;
  var serial_num = data.serial_num;
  var sensor_id = data.sensor_id;
  var redline = data.redline;
  console.log(ownedby);
  console.log(serial_num);
  console.log(redline);

client.query('INSERT INTO piunits(ownedby, serial_num, sensor_id, redline) VALUES($1, $2, $3, $4)', [ownedby, serial_num, sensor_id, redline], 
function(err, result){
    if (err){console.log(err);}
    res.send(req.params);
  });
});

app.get('/plantdata/:serial_num/:channel_num', function(req, res){
  var serial_num = req.params.serial_num;
  var channel_num = req.params.channel_num;

  client.query("SELECT * FROM soildata WHERE pi_id = '" + serial_num+ "' AND sensor_id = "+ channel_num, function(err, result){
    if (err){console.log(err);}
    res.send(result);
  });
});

createTable();

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});



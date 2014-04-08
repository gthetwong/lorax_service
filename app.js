var express = require("express");
var logfmt = require("logfmt");
var app = module.exports =  express();
var url = require('url');
var pg = require('pg');
var http = require('http');
var path = require('path');

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
  var isdry = function(){ client.query('SELECT redline FROM piunits INNER JOIN soildata ON pi_id = serial_num WHERE soildata.sensor_id = piunits.sensor_id Limit 1',
    function(err, result){
      // console.log((result.rows[0].redline), "this is the result");
      var redline_value = result.rows[0].redline; 
      // console.log(reading, "this is the reading");
      // if(err){console.log(err);}
      var dryness;
      if(reading > redline_value){
        console.log("reading is dry");
        dryness = true;
        // return true;
        } else {
          console.log("reading is moist");
          dryness = false;
        }
        return dryness;
      });
  };
  console.log(isdry(), "isdry?");

  client.query('INSERT INTO soildata(reading, pi_id, sensor_id, recordtime, isdry) VALUES($1, $2, $3, $4, $5)', [reading, pi_id, sensor_id, date, isdry],
  function(err, result){
    if (err){console.log(err, "error inserting to PG");}
    res.send(req.params);
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
//'+ownedby+', '+serial_num+', '+redline+')',

//Get soil data based on user_id  <<-------------------(Deprecated)
// app.get('/api/:user_id', function(req, res){
//   var id = req.params.user_id;
//   console.log(id);
//   query = client.query('SELECT * FROM soildata WHERE user_id = ' + id, function(err, result){
//     if(!result){
//       return res.send('no data');
//     } else {
//       res.send(result);
//     }
//   });

createTable();

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});



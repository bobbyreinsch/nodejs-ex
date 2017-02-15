//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    morgan  = require('morgan'),
    mongoose = require('mongoose');

Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};


// social sharing - serve og optimized page

var bot_router = express.Router();


bot_router.get('/:text',function(req,res){
  var page_url = req.protocol + '://' + req.get('host') + req.url;

  var page_title = req.params.text; // this page title
  var page_desc = 'this is the description for ' + page_title + '.';
  var img_url = page_url + '/img/test.gif'; // page image
  var page_tags = 'tags,tags,many tags';

  res.render('bots',{
    img: img_url,
    title: page_title,
    description: page_desc,
    url: page_url,
    tags: page_tags
  });
});

  bot_router.get('/',function(req,res){
    var page_url = req.protocol + '://' + req.get('host') + req.url;
    res.render('bots',{
      img: page_url + '/img/test.gif',
      title: 'OG Test',
      description: 'This is the home page.',
      url: page_url,
      tags: 'no page tags'
    });
  });

/*

// var _id = req.params.id;
// var page_priority = '6';

  if(!_id){id=0}

  Todo.find(function(err,todos){
    if (err)
        res.send(err);
    console.log(todos);
    res.render('bots',{
      img: img_url,
      title: todos[_id].priority,
      description: todos[_id].text,
      url: page_url,
      tags: todos[_id].tags
    });

  });

});

*/


app.use(function(req,res,next){
   var ua = req.headers['user-agent'];
    if(/^(facebookexternalhit)|(Twitterbot)|(Pinterest)/gi.test(ua)){
     console.log(ua, ' gets served the OG template.');
     bot_router(req,res,next);
    }else{
      next();
    }
});



// routes ======================================================================


app.get('/:textvar',function(req,res){

  res.render('info.html', {pageCountMessage: null, test_text : req.textvar});
});


app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render('info.html', { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render('info.html', { pageCountMessage : null});
  }
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});




// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app;

//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    methodOverride = require('method-override'), // simulate DELETE and PUT (express4)
    morgan  = require('morgan'),
    mongoose = require('mongoose'),
    swig    = require('swig');

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


// define model =================
var Todo = mongoose.model('Todo', {
   text : String,
   tags: {type: [], index: true },
   priority: Number
});

// social sharing - serve og optimized page

var bot_router = express.Router();
bot_router.get('/todo/:id',function(req,res){
  var page_url = req.protocol + '://' + req.get('host') + req.url;
  var _id = req.params.id;

  var page_title = 'Test Title'; // this page title
  var img_url = '/img.jpg'; // page image
  var page_priority = '6';
  var page_tags = 'tags,tags,many tags';

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


app.use(function(req,res,next){
   var ua = req.headers['user-agent'];
    if(/^(facebookexternalhit)|(Twitterbot)|(Pinterest)/gi.test(ua)){
     console.log(ua, ' gets sent elsewhere.');
     bot_router(req,res,next);
    }else{
      next();
    }
});
app.use(express.static(__dirname + '/public'));                 // set the static files location /public/img will be /img for users
app.use(morgan('dev'));                                         // log every request to the console
app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
app.use(bodyParser.json());                                     // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride());




// routes ======================================================================


app.get('/info', function (req, res) {
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



// api ---------------------------------------------------------------------
// get all todos
app.get('/api/todos', function(req, res) {
  if (!db) {
    initDb(function(err){});
  }
    // use mongoose to get all todos in the database
    Todo.find(function(err, todos) {

        // if there is an error retrieving, send the error. nothing after res.send(err) will execute
        if (err)
            res.send(err)

        res.json(todos); // return all todos in JSON format
    });
});

// create todo and send back all todos after creation
app.post('/api/todos', function(req, res) {
  if (!db) {
    initDb(function(err){});
  }
    // create a todo, information comes from AJAX request from Angular
    Todo.create({
        text : req.body.text,
        tags : req.body.tags.split(),
        priority: req.body.priority,
        done : false
    }, function(err, todo) {
        if (err)
            res.send(err);

        // get and return all the todos after you create another
        Todo.find(function(err, todos) {
            if (err)
                res.send(err)
            res.json(todos);
        });
    });

});

// delete a todo
app.delete('/api/todos/:todo_id', function(req, res) {
  if (!db) {
    initDb(function(err){});
  }
    Todo.remove({
        _id : req.params.todo_id
    }, function(err, todo) {
        if (err)
            res.send(err);

        // get and return all the todos after you create another
        Todo.find(function(err, todos) {
            if (err)
                res.send(err)
            res.json(todos);
        });
    });
});

// application -------------------------------------------------------------
app.get('*', function(req, res) {
  if (!db) {
    initDb(function(err){});
  }
  res.sendFile(__dirname + '/public/index.html'); // load the single view file (angular will handle the page changes on the front-end)
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

module.exports = app ;

var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

let mydb, cloudant;
var vendor; // Because the MongoDB and Cloudant use different API commands, we
            // have to check which command should be used based on the database
            // vendor.
var dbName = 'mydb';

// Separate functions are provided for inserting/retrieving content from
// MongoDB and Cloudant databases. These functions must be prefixed by a
// value that may be assigned to the 'vendor' variable, such as 'mongodb' or
// 'cloudant' (i.e., 'cloudantInsertOne' and 'mongodbInsertOne')

var insertOne = {};
var getAll = {};

insertOne.cloudant = function(doc, response) {
  mydb.insert(doc, function(err, body, header) {
    if (err) {
      console.log('[mydb.insert] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.send(doc);
  });
}

getAll.cloudant = function(response) {
  var names = [];  
  mydb.list({ include_docs: true }, function(err, body) {
    if (!err) {
      body.rows.forEach(function(row) {
        if(row.doc.name)
          names.push(row.doc.name);
      });
      response.json(names);
    }
  });
  //return names;
}

let collectionName = 'mycollection'; // MongoDB requires a collection name.

insertOne.mongodb = function(doc, response) {
  mydb.collection(collectionName).insertOne(doc, function(err, body, header) {
    if (err) {
      console.log('[mydb.insertOne] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.send(doc);
  });
}

getAll.mongodb = function(response) {
  var names = [];
  mydb.collection(collectionName).find({}, {fields:{_id: 0, count: 0}}).toArray(function(err, result) {
    if (!err) {
      result.forEach(function(row) {
        names.push(row.name);
      });
      response.json(names);
    }
  });
}

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
*   "name": "Bob"
* }
*/
const TorrentSearchApi = require('torrent-search-api');
app.post("/api/visitors", function (request, response) {
  
  var query = request.body.name;

  var category = request.body.category | 'Movies';

  TorrentSearchApi.enableProvider('1337x');
  
  // Search '1080' in 'Movies' category and limit to 20 results
  const torrents = TorrentSearchApi.search(query, category, 20);

  torrents.then(torrentList => {
    // console.log(torrentList)
    response.send(torrentList)
  })
});

app.post("/api/getFiles", function (request, response) {
  
  var torrent = request.body;

  const magnet = TorrentSearchApi.getMagnet(torrent);

  magnet.then(magnetRes => {
    // response.send(magnetRes);
    getTorrentFiles(request, response, magnetRes);
    // getTorrentFileLink(torrent, (torrentLink) => {
    // })
  })

});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function (request, response) {
  var names = [];
  if(!mydb) {
    response.json(names);
    return;
  }
  getAll[vendor](response);
});

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

if (appEnv.services['compose-for-mongodb'] || appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/)) {
  // Load the MongoDB library.
  var MongoClient = require('mongodb').MongoClient;

  dbName = 'mydb';

  // Initialize database with credentials
  if (appEnv.services['compose-for-mongodb']) {
    MongoClient.connect(appEnv.services['compose-for-mongodb'][0].credentials.uri, null, function(err, db) {
      if (err) {
        console.log(err);
      } else {
        mydb = db.db(dbName);
        console.log("Created database: " + dbName);
      }
    });
  } else {
    // user-provided service with 'mongodb' in its name
    MongoClient.connect(appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/).credentials.uri, null,
      function(err, db) {
        if (err) {
          console.log(err);
        } else {
          mydb = db.db(dbName);
          console.log("Created database: " + dbName);
        }
      }
    );
  }

  vendor = 'mongodb';
} else if (appEnv.services['cloudantNoSQLDB'] || appEnv.getService(/[Cc][Ll][Oo][Uu][Dd][Aa][Nn][Tt]/)) {
  // Load the Cloudant library.
  var Cloudant = require('@cloudant/cloudant');

  // Initialize database with credentials
  if (appEnv.services['cloudantNoSQLDB']) {
    // CF service named 'cloudantNoSQLDB'
    cloudant = Cloudant(appEnv.services['cloudantNoSQLDB'][0].credentials);
  } else {
     // user-provided service with 'cloudant' in its name
     cloudant = Cloudant(appEnv.getService(/cloudant/).credentials);
  }
} else if (process.env.CLOUDANT_URL){
  cloudant = Cloudant(process.env.CLOUDANT_URL);
}
if(cloudant) {
  //database name
  dbName = 'mydb';

  // Create a new "mydb" database.
  cloudant.db.create(dbName, function(err, data) {
    if(!err) //err if database doesn't already exists
      console.log("Created database: " + dbName);
  });

  // Specify the database we are going to use (mydb)...
  mydb = cloudant.db.use(dbName);

  vendor = 'cloudant';
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));



var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});






// codes for cl-stream api
var torrentStream = require('torrent-stream');
const parseTorrent = require('parse-torrent')
const https = require('https')
var rimraf = require("rimraf");

app.get('/test', function(req, res) {
  res.end('Cloud Torrent Stream')
})

app.get('/deleteTemp', function(req, res) {
  rimraf('/tmp/torrent-stream/', function () { console.log("deleted tmp") })
  res.end();
})

app.get('/listFiles', function (req, res) {
  console.log(req.query)
  if(req.query.torrent.startsWith('magnet:')) {
      getTorrentFileLink(req.query.torrent, (torrentLink) => {
        getTorrentFiles(req, res, torrentLink);
      })
  } else {
    getTorrentFiles(req, res, req.query.torrent);
  }
})

var WebTorrent = require('webtorrent')
var client = new WebTorrent()

function getTorrentFiles(req, res, torrentId) {
  console.log('calculsting response')

  // parseTorrent.remote(torrentId, { timeout: 60 * 1000 }, (err, parsedTorrent) => {
    // if (err) throw err
    engine = torrentStream(torrentId);
    // engines[id] = engine;
    engine.on('ready', function() {
      var response = [];
      for (i = 0; i < engine.files.length; i++) {
        var eachFile = engine.files[i];
        response.push({
          name: eachFile.name,
          id: engine.infoHash
        });
      }
    engines[engine.infoHash] = engine;
    res.end(JSON.stringify({response,torrentId}))
    });
  // }) 

  // client.add(torrentId, function (torrent) {
  //   //deselctTorrentFiles(torrent);
  //   var response = [];
  //   for (i = 0; i < torrent.files.length; i++) {
  //     var file = torrent.files[i];
  //     console.log(file.name)
  //     response.push({
  //       name: file.name,
  //       progress: file.progress,
  //       id: torrent.infoHash
  //     });
  //   }
  //   console.log('sending response')
  //   res.end(JSON.stringify({response}))
  // })
}

function getTorrentFileLink(magnetStr, onSuccess) {
  const torrentHtmlDetail = TorrentSearchApi.getTorrentDetails(magnetStr);
  torrentHtmlDetail.then(res => {
    console.log(res)
  })
  const bufferRes = TorrentSearchApi.downloadTorrent(magnetStr);
  bufferRes.then(buffer => {
    onSuccess(buffer)
  })
  // https.get('https://anonymiz.com/magnet2torrent/magnet2torrent.php?magnet='+magnetStr, (resp) => {
  //     let data = '';
  //     resp.on('data', (chunk) => {
  //       data += chunk;
  //     });

  //     resp.on('end', () => {
  //       console.log('respone for '+magnetStr,JSON.parse(data))
  //       console.log(JSON.parse(data).url.split('<a')[0]);
  //       onSuccess(JSON.parse(data).url.split('<a')[0]);
  //     });
  //   }).on("error", (err) => {
  //     console.log("Error: " + err.message);
  //   });
}

var engines = {};

app.get('/getData', function (req, res) {
  console.log(req.query);
  var id  = req.query.id;
  var fileIndex = req.query.fileIndex;
  var fileName = req.query.fileName;
  fileName = fileName.trim().replace(/ /g,'');
  var engine = engines[id];
  if(engine) {
    streamTorrentFileToResponse(req, res, fileName, engine);
  } else {
    engine = torrentStream(req.query.magnet);
    engine.on('ready', function() {
      engines[id] = engine;
      streamTorrentFileToResponse(req, res, fileName, engine);
    });
    // getTorrentFileLink(JSON.parse(req.query.torrent), (torrentLink) => {
    //   console.log('torrent link', torrentLink);
    //   engine = torrentStream(parsedTorrent);
    //     engine.on('ready', function() {
    //       engines[id] = engine;
    //       streamTorrentFileToResponse(req, res, fileName, engine);
    //     });
    //   // parseTorrent.remote(torrentLink, { timeout: 60 * 1000 }, (err, parsedTorrent) => {
    //   //   if (err) throw err
    //   //   engine = torrentStream(parsedTorrent);
    //   //   engines[id] = engine;
    //   //   engine.on('ready', function() {
    //   //     streamTorrentFileToResponse(req, res, fileName, engine);
    //   //   });
    //   // })  
    // });
  }
});

function streamTorrentFileToResponse(req, res, fileName, engine) {
  console.log(engine.files)
  var file;
  for (i = 0; i < engine.files.length; i++) {
      var eachFile = engine.files[i];
      console.log('checking fileName',eachFile.name)
      if(eachFile.name.trim().replace(/ /g,'') === fileName) {
      console.log('fileIndex found at',i);
      file = eachFile;
      break;
    }
  }
  console.log(file.length);
  var range = req.headers.range;
  var total = file.length;
  if(!range) {
    range = 'bytes=0-';
  }
  var positions = range.replace(/bytes=/, "").split("-");
  var start = parseInt(positions[0], 10);
  var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
  var chunksize = (end - start) + 1;
  res.writeHead(req.headers.range ? 206 : 200, {
    "Content-Range": "bytes " + start + "-" + end + "/" + total,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize,
            "Content-Type": "video/" + fileName.split('.').pop(),
            "Content-Disposition": "attachment; filename="+file.name,

    });

  // var stream = file.createReadStream(
  //   {
  //     start,
  //     end
  //   }
  // );

  var offset = start + file.offset;
  console.log('start', start)
  console.log('file-offset', file.offset)
  console.log('offset', offset)
  var pieceLength = engine.torrent.pieceLength;
  console.log('pieceLength', pieceLength)
  startPiece = (offset / pieceLength) | 0;
  _piece = startPiece;
  endPiece = ((end + file.offset) / pieceLength) | 0;
  console.log(endPiece)
  console.log('start-piece',startPiece);
  pieces = {};
  _critical = Math.min(1024 * 1024 / pieceLength, 2) | 1;
  _waitingFor = -1;
  _offset = offset - startPiece * pieceLength;
  console.log('_offset', _offset);

  MAX_BUFFER_PIECES = Math.ceil((5000000 * 10) / pieceLength);
  MIN_BUFFER_PIECES = Math.ceil((4000000 * 10) / pieceLength);
  var _nextPiece = startPiece + MAX_BUFFER_PIECES;

  const { Readable } = require('stream'); 

  var currentPieceIndex = startPiece;
  const stream = new Readable({
    read() {
      console.log('read requested for ', _piece);
      // if (_piece > endPiece) {
      //   return {};
      // }
      var piece = pieces[_piece];
      if(piece) {
        if (_offset) {
          piece = piece.slice(_offset)
          _offset = 0
        }
        this.push(piece);
        console.log('buffer fetched for ', _piece);
        delete pieces[_piece];
        // if(_piece >= currentPieceIndex + MIN_BUFFER_PIECES) {
        //   engine.select(_nextPiece + 1, _nextPiece + MAX_BUFFER_PIECES, true, null)
        //   currentPieceIndex = _nextPiece;
        //   _nextPiece = _nextPiece + MAX_BUFFER_PIECES
        // }
        _piece++;
      } else {
        _waitingFor = _piece;
        _piece++;
        return engine.critical(_waitingFor, _critical)
      }

      if(_piece >= currentPieceIndex + MIN_BUFFER_PIECES) {
        engine.select(_nextPiece + 1, _nextPiece + MAX_BUFFER_PIECES, true, null)
        currentPieceIndex = _nextPiece;
        _nextPiece = _nextPiece + MAX_BUFFER_PIECES
      }

    }
  });

  engine.select(startPiece, _nextPiece, true, null)

  engine.on('download', (index, buffer) => {
    console.log('pushing buffer to stream for', index);
    if(_waitingFor === index) {
      console.log('pushing buffer to stream for', index);
      if (_offset) {
      buffer = buffer.slice(_offset)
      _offset = 0
      }
      stream.push(buffer);
      _waitingFor = -1;
    } else {
      pieces[index] = buffer;
    }
  })

  stream.pipe(res);
  req.on("close", function() {
    console.log('request closed');
    engine.destroy();
    engines[req.query.id] = null;
    pieces = {};
    stream.destroy();
  });
}

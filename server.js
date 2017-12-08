// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var request = require("request");
var cheerio = require("cheerio");
var logger = require("morgan");
var mongoose = require("mongoose");

var db = require("./models");


var port = process.env.PORT || 5000;
var app = express();

app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

app.use(express.static("public"));

var exphbs = require("express-handlebars");
app.engine("handlebars", exphbs({
  defaultLayout: "main"
}));
app.set("view engine", "handlebars");

mongoose.Promise = Promise;
mongoose.connect(process.env.MONGODB_URI, {
  useMongoClient: true
});

app.get("/", function(req, res) {
  db.Article.find({
    "saved": false
  }, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  db.Article.find({
    "saved": true
  }).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});

app.get("/scrape", function(req, res) {
  request("https://www.nytimes.com/", function(error, response, html) {
    var $ = cheerio.load(html);
    $("article").each(function(i, element) {
      var result = {};
      result.title = $(this).children("h2").text();
      result.summary = $(this).children(".summary").text();
      result.link = $(this).children("h2").children("a").attr("href");
      var entry = new Article(result);
      entry.save(function(err, doc) {
        if (err) {
          console.log(err);
        } else {
          console.log(doc);
        }
      });

    });
    res.send("Scrape Complete");
  });
});

app.get("/articles", function(req, res) {
  db.Article.find({}, function(error, doc) {
    if (error) {
      console.log(error);
    } else {
      res.json(doc);
    }
  });
});


app.get("/articles/:id", function(req, res) {
  db.Article.findOne({
      "_id": req.params.id
    })
    .populate("note")
    .exec(function(error, doc) {
      if (error) {
        console.log(error);
      } else {
        res.json(doc);
      }
    });
});



app.post("/articles/save/:id", function(req, res) {
  db.Article.findOneAndUpdate({
      "_id": req.params.id
    }, {
      "saved": true
    })
    .exec(function(err, doc) {
      if (err) {
        console.log(err);
      } else {
        res.send(doc);
      }
    });
});

app.post("/articles/delete/:id", function(req, res) {
  db.Article.findOneAndUpdate({
      "_id": req.params.id
    }, {
      "saved": false,
      "notes": []
    })
    .exec(function(err, doc) {
      if (err) {
        console.log(err);
      } else {
        res.send(doc);
      }
    });
});

app.post("/notes/save/:id", function(req, res) {
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  newNote.save(function(error, note) {
    if (error) {
      console.log(error);
    } else {
      db.Article.findOneAndUpdate({
          "_id": req.params.id
        }, {
          $push: {
            "notes": note
          }
        })
        .exec(function(err) {
          if (err) {
            console.log(err);
            res.send(err);
          } else {
            res.send(note);
          }
        });
    }
  });
});

app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
  db.Note.findOneAndRemove({
    "_id": req.params.note_id
  }, function(err) {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      db.Article.findOneAndUpdate({
          "_id": req.params.article_id
        }, {
          $pull: {
            "notes": req.params.note_id
          }
        })
        .exec(function(err) {
          if (err) {
            console.log(err);
            res.send(err);
          } else {
            res.send("Note Deleted");
          }
        });
    }
  });
});

app.listen(port, function() {
  console.log("App running on port " + port);
});

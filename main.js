(function() {

  /*
    Module dependencies.
  */

  var Docs, LAST_MSG, Patches, app, docIO, express, io, nib, nicknames, sio, stylus, utilities;

  express = require('express');

  stylus = require('stylus');

  nib = require('nib');

  sio = require('socket.io');

  utilities = require('./utilities');

  Docs = require('./models').Docs;

  Patches = require('./models').Patches;

  /*
   * App.
  */

  app = express.createServer();

  /*
   * App configuration.
  */

  app.configure(function() {
    var compile;
    compile = function(str, path) {
      return stylus(str).set('filename', path).use(nib());
    };
    app.use(stylus.middleware({
      src: __dirname + '/public',
      compile: compile
    }));
    app.use(express.static(__dirname + '/public'));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    return app.set('view options', {
      layout: false
    });
  });

  /*
   * App listen.
  */

  if (!module.parent) {
    app.listen(3000, function() {
      var addr;
      addr = app.address();
      return console.log('   app listening on http://' + addr.address + ':' + addr.port);
    });
  } else {
    exports.app = app;
  }

  /*
   * App routes.
  */

  app.get('/', function(req, res) {
    return res.render('index');
  });

  app.get('/about', function(req, res) {
    return res.render('about');
  });

  app.get('/contact', function(req, res) {
    return res.render('contact');
  });

  app.get('/d/:name', function(req, res) {
    var name, slug;
    name = req.params.name;
    slug = utilities.makeSlug(name);
    return Docs.findOne({
      slug: slug
    }, function(err, doc) {
      if (err) {
        console.error(err);
        return res.send('Database Error');
      }
      if (doc) {
        if (doc.ver - doc.ver_patch >= 10) Docs.applyPatch(doc.slug);
        return res.render('doc', {
          doc: doc
        });
      } else {
        doc = {
          title: name,
          slug: slug,
          content: '<p>&nbsp;</p>',
          ver: 0,
          ver_patch: 0,
          created_at: new Date()
        };
        return Docs.insert(doc, {
          safe: true
        }, function(err, doc) {
          if (err || !(doc && doc.length)) {
            console.error(err);
            return res.send('Database Error');
          }
          return res.render('doc', {
            doc: doc[0]
          });
        });
      }
    });
  });

  /*
   * Socket.IO server (single process only)
  */

  io = sio.listen(app);

  nicknames = {};

  LAST_MSG = null;

  docIO = io.of('/doc').on('connection', function(socket) {
    socket.on('init', function(data) {
      return Docs.findOne({
        slug: data.slug
      }, function(err, doc) {
        var r;
        r = {
          success: false
        };
        if (!err && doc) {
          if (!nicknames[data.slug]) {
            nicknames[data.slug] = {
              __count: 0
            };
          }
          if (!data.nickname) {
            data.nickname = 'user' + (nicknames[data.slug].__count + 1);
          }
          if (data.nickname === '__count') {
            data.nickname = '_count';
          } else if (nicknames[data.slug][data.nickname]) {
            data.nickname += '[' + (new Date()).getTime() + ']';
          }
          if (doc.ver > doc.ver_patch) {
            return Patches.find({
              doc_id: doc._id,
              ver: {
                $gt: doc.ver_patch
              }
            }).sort({
              ver: 1
            }).toArray(function(err, patches) {
              if (!err) {
                r.success = true;
                r.socket_id = socket.id;
                r.doc = doc;
                r.patches = patches;
                socket.__slug = data.slug;
                nicknames[data.slug][data.nickname] = socket.nickname = data.nickname;
                nicknames[data.slug].__count += 1;
                r.nickname = data.nickname;
                r.onlines = nicknames[data.slug].__count;
                r.lastMsg = LAST_MSG;
                socket.join('doc_' + data.slug);
                socket.emit('init', r);
                return socket.broadcast.to('doc_' + data.slug).emit('new editor', data.nickname);
              } else {
                r.error = 'Server Error';
                return socket.emit('init', r);
              }
            });
          } else {
            r.success = true;
            r.socket_id = socket.id;
            r.doc = doc;
            socket.__slug = data.slug;
            nicknames[data.slug][data.nickname] = socket.nickname = data.nickname;
            nicknames[data.slug].__count += 1;
            r.nickname = data.nickname;
            r.onlines = nicknames[data.slug].__count;
            r.lastMsg = LAST_MSG;
            socket.join('doc_' + data.slug);
            socket.emit('init', r);
            return socket.broadcast.to('doc_' + data.slug).emit('new editor', {
              nickname: data.nickname,
              onlines: r.onlines
            });
          }
        } else {
          r.error = 'Server Error';
          return socket.emit('init', r);
        }
      });
    });
    socket.on('new version', function(ver) {
      return Docs.findAndModify({
        slug: socket.__slug
      }, [], {
        '$inc': {
          ver: 1
        }
      }, {
        "new": true
      }, function(err, doc) {
        var patch;
        if (!err && doc) {
          patch = {
            doc_id: doc._id,
            ver: doc.ver,
            patch: ver.patch_text,
            created_at: new Date()
          };
          return Patches.insert(patch, {
            safe: true
          }, function(err, _patch) {
            if (err || !_patch) return console.error(err);
            return socket.broadcast.to('doc_' + socket.__slug).emit('new version', {
              patch_text: ver.patch_text
            });
          });
        }
      });
    });
    socket.on('disconnect', function() {
      if (!socket.__slug || !socket.nickname) return;
      delete nicknames[socket.__slug][socket.nickname];
      nicknames[socket.__slug].__count--;
      socket.broadcast.to('doc_' + socket.__slug).emit('leave', {
        nickname: socket.nickname,
        onlines: nicknames[socket.__slug].__count
      });
      if (nicknames[socket.__slug].__count < 1) delete nicknames[socket.__slug];
      if (nicknames[socket.__slug] && nicknames[socket.__slug].__count > 0) {
        return socket.broadcast.to('doc_' + socket.__slug).emit('nicknames', {
          nicknames: nicknames[socket.__slug],
          onlines: nicknames[socket.__slug].__count
        });
      }
    });
    socket.on('new msg', function(msg) {
      LAST_MSG = {
        nickname: socket.nickname,
        msg: msg
      };
      return socket.broadcast.to('doc_' + socket.__slug).emit('new msg', {
        nickname: socket.nickname,
        msg: msg
      });
    });
    return socket.on('set nickname', function(nickname) {
      socket.nickname = nickname;
      return socket.broadcast.to('doc_' + socket.__slug).emit('set nickname', nickname);
    });
  });

  /*
  io.sockets.on 'connection',
      (socket) ->
          console.log 'connection'
          socket.on('user message', (msg) ->
              socket.broadcast.emit('user message', socket.nickname, msg)
          )
  
          socket.on('nickname', (nick, fn) ->
              if nicknames[nick]
                  fn(true)
              else
                  fn(false)
                  nicknames[nick] = socket.nickname = nick
                  socket.broadcast.emit('announcement', nick + ' connected')
                  io.sockets.emit('nicknames', nicknames)
              
          )
  
          socket.on('disconnect',  () ->
              if socket.nickname
                  return
  
              delete nicknames[socket.nickname]
              socket.broadcast.emit('announcement', socket.nickname + ' disconnected')
              socket.broadcast.emit('nicknames', nicknames)
          )
  */

}).call(this);

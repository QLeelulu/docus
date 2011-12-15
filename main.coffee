###
  Module dependencies.
###

express = require('express')
stylus = require('stylus')
nib = require('nib')
sio = require('socket.io')

utilities = require('./utilities')
Docs = require('./models').Docs
Patches = require('./models').Patches

###
 * App.
###

app = express.createServer()

###
 * App configuration.
###

app.configure(() ->
    compile = (str, path) -> return stylus(str).set('filename', path).use(nib())
    app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }))
    app.use(express.static(__dirname + '/public'))
    app.set('views', __dirname + '/views')
    app.set('view engine', 'jade')
    app.set('view options', {
      layout: false
    })
    #app.register( '.coffee', coffeekup.adapters.express )
)


###
 * App listen.
###

if !module.parent
    app.listen 3000, () ->
        addr = app.address()
        console.log('   app listening on http://' + addr.address + ':' + addr.port)
else
    exports.app = app


###
 * App routes.
###

app.get '/', (req, res) ->
    res.render('index')

app.get '/about', (req, res) ->
    res.render('about')

app.get '/contact', (req, res) ->
    res.render('contact')

app.get '/d/:name', (req, res) ->
    name = req.params.name
    slug = utilities.makeSlug(name)
    Docs.findOne( {slug: slug}, (err, doc) ->
        if err
            console.error err
            return res.send 'Database Error'
        if doc
            if doc.ver - doc.ver_patch >= 10
                Docs.applyPatch doc.slug
            res.render('doc', {doc: doc})
        else
            doc = {
                title: name
                slug: slug
                content: '<p>&nbsp;</p>'
                ver: 0
                ver_patch: 0
                created_at: new Date()
            }
            Docs.insert(doc, {safe: true}, (err, doc) ->
                if err || !(doc && doc.length)
                    console.error err
                    return res.send 'Database Error'
                res.render('doc', {doc: doc})
            )
    )

###
 * Socket.IO server (single process only)
###

io = sio.listen(app)
nicknames = {}

docIO = io.of('/doc').on 'connection', (socket) ->
    #console.log io.sockets.sockets[socket.id]

    socket.on 'init', (data) ->
        Docs.findOne {slug: data.slug}, (err, doc) ->
            r = {success: false}
            if !err && doc
                if doc.ver > doc.ver_patch
                    Patches
                        .find({doc_id: doc._id, ver: {$gt: doc.ver_patch}})
                        .sort({ver:1})
                        .toArray (err, patches) ->
                            if !err
                                r.success = true
                                r.socket_id = socket.id
                                r.doc = doc
                                r.patches = patches
                                socket.__slug = data.slug
                                socket.join 'doc_' + data.slug
                                socket.emit 'init', r
                                socket.broadcast.to('doc_' + data.slug).emit('new editor')
         
                else
                    r.success = true
                    r.socket_id = socket.id
                    r.doc = doc
                    socket.__slug = data.slug
                    socket.join 'doc_' + data.slug
                    socket.emit 'init', r
                    socket.broadcast.to('doc_' + data.slug).emit('new editor')
    
    socket.on 'new version', (ver) ->
        console.log ver
        Docs.findAndModify  {slug: socket.__slug}, #query
                            [], #sort
                            { '$inc': {ver: 1} }, #update
                            {new: true}, #options
                            (err, doc) ->
                                if !err && doc
                                    patch = {
                                        doc_id: doc._id
                                        ver: doc.ver
                                        patch: ver.patch_text
                                        created_at: new Date()
                                    }
                                    Patches.insert patch, {safe: true}, (err, _patch) ->
                                        if err || !_patch
                                            return console.error err

                                        socket.broadcast.to('doc_' + socket.__slug).emit 'new version', {patch_text: ver.patch_text}

###
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
###


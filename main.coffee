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
                res.render('doc', {doc: doc[0]})
            )
    )

###
 * Socket.IO server (single process only)
###

io = sio.listen(app)
nicknames = {}
LAST_MSG = null

docIO = io.of('/doc').on 'connection', (socket) ->
    #console.log io.sockets.sockets[socket.id]

    socket.on 'init', (data) ->

        Docs.findOne {slug: data.slug}, (err, doc) ->
            r = {success: false}

            if !err && doc
                if !nicknames[data.slug]
                    nicknames[data.slug] = {__count:0}
                if !data.nickname
                    data.nickname = 'user' + (nicknames[data.slug].__count + 1)
                if data.nickname == '__count'
                    data.nickname = '_count'
                else if nicknames[data.slug][data.nickname]
                    data.nickname += '[' + (new Date()).getTime() + ']'

                # 如果doc的版本大于已经打了patch的版本，
                # 需要加载还没有打patch的版本，进行合并
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
                                # 
                                socket.__slug = data.slug
                                nicknames[data.slug][data.nickname] = socket.nickname = data.nickname
                                nicknames[data.slug].__count += 1
                                # online users
                                r.nickname = data.nickname
                                r.onlines = nicknames[data.slug].__count
                                # last msg
                                r.lastMsg = LAST_MSG

                                socket.join 'doc_' + data.slug
                                socket.emit 'init', r
                                socket.broadcast.to('doc_' + data.slug).emit 'new editor', data.nickname
                            else
                                r.error = 'Server Error'
                                socket.emit 'init', r
         
                else
                    r.success = true
                    r.socket_id = socket.id
                    r.doc = doc
                    # bind slug to socket
                    socket.__slug = data.slug
                    nicknames[data.slug][data.nickname] = socket.nickname = data.nickname
                    nicknames[data.slug].__count += 1
                    # online users
                    r.nickname = data.nickname
                    r.onlines = nicknames[data.slug].__count
                    # last msg
                    r.lastMsg = LAST_MSG

                    socket.join 'doc_' + data.slug
                    socket.emit 'init', r
                    socket.broadcast.to('doc_' + data.slug).emit 'new editor', {nickname:data.nickname, onlines:r.onlines}
            
            # 因为打开页面的时候，doc不存在会自动创建的，
            # 所以这里必定是出错了
            else
                r.error = 'Server Error'
                socket.emit 'init', r
    
    socket.on 'new version', (ver) ->
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

    socket.on 'disconnect',  () ->
        if !socket.__slug || !socket.nickname
            return

        delete nicknames[socket.__slug][socket.nickname]
        nicknames[socket.__slug].__count--
        # emit leave
        socket.broadcast.to('doc_' + socket.__slug).emit 'leave', {nickname:socket.nickname, onlines:nicknames[socket.__slug].__count}
        # if no editor, delete it
        if nicknames[socket.__slug].__count < 1
            delete nicknames[socket.__slug]

        #socket.broadcast.to('doc_' + socket.__slug).emit 'info', socket.nickname + ' disconnected'
        # if nicknames[socket.__slug] not null, 
        if nicknames[socket.__slug] && nicknames[socket.__slug].__count > 0
            socket.broadcast.to('doc_' + socket.__slug).emit 'nicknames', {nicknames:nicknames[socket.__slug], onlines:nicknames[socket.__slug].__count}

    socket.on 'new msg',  (msg) ->
        LAST_MSG = {nickname:socket.nickname, msg:msg}
        socket.broadcast.to('doc_' + socket.__slug).emit 'new msg', {nickname:socket.nickname, msg:msg}

    socket.on 'set nickname',  (nickname) ->
        socket.nickname = nickname
        socket.broadcast.to('doc_' + socket.__slug).emit 'set nickname', nickname

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


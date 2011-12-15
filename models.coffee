###
 * @author QLeelulu@gmail.com
 * @blog http://qleelulu.cnblogs.com
###

diff_match_patch = require('./public/js/diff_match_patch').diff_match_patch
dmp = new diff_match_patch()

mongo = require('mongoskin')
config = require('./config')
db = mongo.db('{{username}}:{{password}}@{{host}}:{{port}}/{{dbname}}?auto_reconnect'.format({
                host: config.MONGO_HOST,
                port: config.MONGO_PORT,
                dbname: config.MONGO_DB_NAME,
                username: config.MONGO_DB_USER,
                password: config.MONGO_DB_PWD
        }),
        (err) ->
            err && console.error(err)
)
        

exports.mongo = mongo

exports.db = db

Docs = exports.Docs = db.collection 'docs'

db.bind 'docs', {
    # 打patch，生成新的content内容
    applyPatch: (slug) ->
        this.findOne {slug: slug}, (err, doc) ->
            if !err && doc && doc.ver > doc.ver_patch
                Patches.find({doc_id: doc._id, ver: {$gt: doc.ver_patch}})
                       .sort({ver:1})
                       .toArray (err, patches) ->
                            if !err && patches && patches.length
                                content = doc.content
                                pt = null
                                results = null
                                for patch in patches
                                    pt = dmp.patch_fromText patch.patch
                                    results = dmp.patch_apply pt, content
                                    content = results[0]
                                console.log content
                                Docs.updateById doc._id.toString(), 
                                                {'$set': {content:content, ver_patch:doc.ver}},
                                                {safe: true},
                                                (err, count) ->
                                                    if err
                                                        console.error err

}

Patches = exports.Patches = db.collection 'patches'


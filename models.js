(function() {

  /*
   * @author QLeelulu@gmail.com
   * @blog http://qleelulu.cnblogs.com
  */

  var Docs, Patches, config, confit, db, diff_match_patch, dmp, mongo;

  diff_match_patch = require('./public/js/diff_match_patch').diff_match_patch;

  dmp = new diff_match_patch();

  mongo = require('mongoskin');

  if (module.parent) {
    config = require('./config');
  } else {
    confit = require('.config.nae');
  }

  db = mongo.db('{{username}}:{{password}}@{{host}}:{{port}}/{{dbname}}?auto_reconnect'.format({
    host: config.MONGO_HOST,
    port: config.MONGO_PORT,
    dbname: config.MONGO_DB_NAME,
    username: config.MONGO_DB_USER,
    password: config.MONGO_DB_PWD
  }), function(err) {
    return err && console.error(err);
  });

  exports.mongo = mongo;

  exports.db = db;

  Docs = exports.Docs = db.collection('docs');

  db.bind('docs', {
    applyPatch: function(slug) {
      return this.findOne({
        slug: slug
      }, function(err, doc) {
        if (!err && doc && doc.ver > doc.ver_patch) {
          return Patches.find({
            doc_id: doc._id,
            ver: {
              $gt: doc.ver_patch
            }
          }).sort({
            ver: 1
          }).toArray(function(err, patches) {
            var content, patch, pt, results, _i, _len;
            if (!err && patches && patches.length) {
              content = doc.content;
              pt = null;
              results = null;
              for (_i = 0, _len = patches.length; _i < _len; _i++) {
                patch = patches[_i];
                pt = dmp.patch_fromText(patch.patch);
                results = dmp.patch_apply(pt, content);
                content = results[0];
              }
              console.log(content);
              return Docs.updateById(doc._id.toString(), {
                '$set': {
                  content: content,
                  ver_patch: doc.ver
                }
              }, {
                safe: true
              }, function(err, count) {
                if (err) return console.error(err);
              });
            }
          });
        }
      });
    }
  });

  Patches = exports.Patches = db.collection('patches');

}).call(this);

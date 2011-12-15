(function() {
  var Doc, Docus, MessageManage, dmp, docus;

  dmp = new diff_match_patch();

  Doc = (function() {

    function Doc(container, content) {
      this.container = container;
      this.content = content;
      this.editor = new baidu.editor.ui.Editor();
      this.editor.render(this.container);
      this.editor.setContent(this.content);
      this.dmp = new diff_match_patch();
    }

    Doc.prototype.makePatch = function() {
      var diff, newContent, patch_list, patch_text;
      newContent = this.editor.getContent();
      if (this.content === newContent.trim()) return null;
      diff = this.dmp.diff_main(this.content, newContent, true);
      if (diff.length > 2) this.dmp.diff_cleanupSemantic(diff);
      patch_list = this.dmp.patch_make(this.content, newContent, diff);
      patch_text = this.dmp.patch_toText(patch_list);
      this.content = newContent;
      return patch_text;
    };

    Doc.prototype.applyPatch = function(patch_text) {
      var eContent, patches, results, _results;
      patches = this.dmp.patch_fromText(patch_text);
      eContent = this.editor.getContent();
      results = this.dmp.patch_apply(patches, eContent);
      if (this.content.trim() !== eContent.trim()) {
        _results = this.dmp.patch_apply(patches, this.content);
        this.content = _results[0];
      } else {
        this.content = results[0];
      }
      this.editor.setContent(results[0]);
      this.editor.selection.getRange().setCursor();
      return this.editor.focus();
    };

    return Doc;

  })();

  MessageManage = (function() {

    function MessageManage() {}

    MessageManage.prototype.info = function(msg) {
      return console.log(msg);
    };

    MessageManage.prototype.warn = function(msg) {
      return console.warn(msg);
    };

    MessageManage.prototype.error = function(msg) {
      return console.error(msg);
    };

    return MessageManage;

  })();

  Docus = (function() {

    function Docus() {
      this.socket = io.connect('/doc');
      this.mm = new MessageManage();
      this.listens();
    }

    Docus.prototype.listens = function() {
      var that;
      that = this;
      this.socket.on('connect', function() {
        that.mm.info('connected!');
        return that.socket.emit('init', {
          slug: DocInfo.slug
        });
      });
      this.socket.on('disconnect', function() {
        if (that._patchLoop) {
          clearInterval(that._patchLoop);
          that._isDisconnected = true;
          return that.mm.error('你已经断开与服务器的链接');
        }
      });
      this.socket.on('init', function(data) {
        var content, patch, pt, results, _i, _len, _ref;
        if (!data.success) return that.mm.error('很抱歉，出现错误，请尝试刷新页面');
        content = data.doc.content;
        if (data.patches) {
          _ref = data.patches;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            patch = _ref[_i];
            pt = dmp.patch_fromText(patch.patch);
            results = dmp.patch_apply(pt, content);
            content = results[0];
          }
        }
        if (that._isDisconnected) {
          that.doc.editor.setContent(content || '<p>&nbsp;</p>');
          taht.doc.editor.selection.getRange().setCursor();
        } else {
          that.doc = new Doc('docEditor', content || '<p>&nbsp;</p>');
        }
        that.socket_id = data.socket_id;
        return that.startPatchLoop();
      });
      return this.socket.on('new version', function(ver) {
        return that.doc.applyPatch(ver.patch_text);
      });
    };

    Docus.prototype.checkPatch = function() {
      var patch_text;
      patch_text = this.doc.makePatch();
      if (patch_text) {
        return this.socket.emit('new version', {
          patch_text: patch_text
        });
      }
    };

    Docus.prototype.startPatchLoop = function() {
      var that, _f;
      that = this;
      _f = function() {
        return that.checkPatch();
      };
      return this._patchLoop = setInterval(_f, 10 * 1000);
    };

    return Docus;

  })();

  docus = new Docus();

}).call(this);

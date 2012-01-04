(function() {
  var $cookie, Doc, Docus, MessageManage, dmp, docus;

  dmp = new diff_match_patch();

  $cookie = function(name, value, options) {
    var arr, date, domain, expires, path, secure, _ref;
    if (typeof value !== 'undefined') {
      options = options || {};
      if (value === null) {
        value = '';
        options.expires = -1;
      }
      expires = '';
      if (options.expires && (typeof options.expires === 'number' || options.expires.toUTCString)) {
        date = '';
        if (typeof options.expires === 'number') {
          date = new Date();
          date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
        } else {
          date = options.expires;
        }
        expires = '; expires=' + date.toUTCString();
      }
      path = options.path ? '; path=' + options.path : '';
      domain = options.domain ? '; domain=' + options.domain : '';
      secure = (_ref = options.secure) != null ? _ref : {
        '; secure': ''
      };
      return document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
    } else {
      arr = document.cookie.match(new RegExp("(^| )" + name + "=([^;]*)(;|$)"));
      if (arr !== null) return decodeURIComponent(arr[2]);
      return null;
    }
  };

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
      this.chatHolder = $("#chatHolder");
      this.chatContent = $("#chatContent");
      this.chatInput = $("#chatInput");
      this.init();
      this.listens();
    }

    Docus.prototype.init = function() {
      var that;
      that = this;
      this.chatHolder.find('.head').click(function() {
        return that.chatHolder.find('.main').toggle();
      });
      this.chatHolder.find('.head .name').click(function(e) {
        if (!that.nameEditor) {
          that.nameEditor = $('<input id="nameEditor" type="text" />');
          that.nameEditor.insertAfter(this);
          that.nameEditor.blur(function(e) {
            var nickname;
            nickname = $.trim($(this).val());
            if (nickname) {
              $cookie('nickname', nickname, {
                expires: 365
              });
              that.socket.emit('set nickname', nickname);
              that.nameEditor.hide();
              return that.chatHolder.find('.head .name').html(nickname).show();
            }
          });
          that.nameEditor.click(function(e) {
            e.preventDefault();
            return false;
          });
        }
        that.nameEditor.val($(this).text());
        $(this).hide();
        that.nameEditor.show().focus();
        e.preventDefault();
        return false;
      });
      return this.chatInput.keyup(function(e) {
        if (event.keyCode === 13) {
          that.socket.emit('new msg', that.chatInput.val());
          that.chatContent.append("<p class=\"me\"><span>我: </span>" + that.chatInput.val() + "</p>");
          return that.chatInput.val('');
        }
      });
    };

    Docus.prototype.listens = function() {
      var that;
      that = this;
      this.socket.on('connect', function() {
        that.mm.info('connected!');
        return that.socket.emit('init', {
          slug: DocInfo.slug,
          nickname: $cookie("nickname")
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
          that.doc.editor.setContent(content || '');
          that.doc.editor.selection.getRange().setCursor();
        } else {
          that.doc = new Doc('docEditor', content || '');
        }
        that.socket_id = data.socket_id;
        that.chatHolder.find('.head .name').html(data.nickname);
        that.chatHolder.find('.head .count').html('(' + data.onlines + '人在编辑)');
        if (data.lastMsg) {
          that.chatContent.append("<p><span>" + data.lastMsg.nickname + ": </span>" + data.lastMsg.msg + "</p>");
        }
        that.chatHolder.show();
        return that.startPatchLoop();
      });
      this.socket.on('new version', function(ver) {
        return that.doc.applyPatch(ver.patch_text);
      });
      this.socket.on('info', function(msg) {
        return that.mm.info(msg);
      });
      this.socket.on('new editor', function(data) {
        that.mm.info(data.nickname + ' 进来编辑了');
        return that.chatHolder.find('.head .count').html('(' + data.onlines + '人在编辑)');
      });
      this.socket.on('leave', function(data) {
        that.mm.info(data.nickname + ' 离开了');
        return that.chatHolder.find('.head .count').html('(' + data.onlines + '人在编辑)');
      });
      this.socket.on('nicknames', function(data) {
        return that.mm.info(data);
      });
      return this.socket.on('new msg', function(data) {
        return that.chatContent.append("<p><span>" + data.nickname + ": </span>" + data.msg + "</p>");
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

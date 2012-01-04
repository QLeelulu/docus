(function() {
  var DocPlayer, DocView, dmp, doc;

  dmp = new diff_match_patch();

  DocPlayer = (function() {

    function DocPlayer(docContent) {
      this.docContent = docContent;
      this.lastContent = this.docContent.html();
      this.btnPlay = $("#play");
      this.btnPause = $("#pause");
      this.btnStop = $("#stop");
      this.patchVersion = $("#patchVersion");
      this.loading = $("#loading");
      this.dmp = dmp;
      this.resetPlayStat();
      this.init();
    }

    DocPlayer.prototype.init = function() {
      var that;
      that = this;
      this.btnPlay.click(function() {
        return that.play();
      });
      this.btnPause.click(function() {
        return that.pause();
      });
      return this.btnStop.click(function() {
        return that.stop();
      });
    };

    DocPlayer.prototype.resetPlayStat = function() {
      return this.playStat = {
        ver: 0,
        content: '',
        playing: false
      };
    };

    DocPlayer.prototype.play = function() {
      var that;
      if (!this.patches) {
        this.showLoading('正在加载版本信息...');
        that = this;
        return $.ajax({
          url: '/patches/' + DocInfo.slug,
          type: 'get',
          dataType: 'json',
          success: function(r) {
            if (r.success) {
              that.patches = r.patches;
              that.hideLoading();
              return that.startPlay();
            } else {
              return that.showLoading('加载版本信息出错!');
            }
          },
          error: function() {
            return that.showLoading('加载版本信息出错!');
          }
        });
      } else {
        return this.startPlay();
      }
    };

    DocPlayer.prototype.startPlay = function() {
      this.hideLoading();
      this.btnPlay.hide();
      this.btnPause.show();
      this.btnStop.show();
      this.playStat.playing = true;
      return this._playLoop();
    };

    DocPlayer.prototype._playLoop = function() {
      var patch, that, _playLoop;
      if (!this.playStat.playing) return;
      that = this;
      patch = this.patches[this.playStat.ver];
      this.playStat.ver++;
      if (patch) {
        this.applyPatch(patch.patch);
        this.patchVersion.text(patch.ver);
        _playLoop = function() {
          return that._playLoop();
        };
        return this.__timeout = setTimeout(_playLoop, 500);
      } else {
        return this.stop();
      }
    };

    DocPlayer.prototype.applyPatch = function(patch_text) {
      var eContent, patches, results;
      patches = this.dmp.patch_fromText(patch_text);
      eContent = this.playStat.content;
      results = this.dmp.patch_apply(patches, eContent);
      this.playStat.content = results[0];
      return this.docContent.html(this.playStat.content);
    };

    DocPlayer.prototype.pause = function() {
      this.btnPlay.show();
      this.btnPause.hide();
      this.btnStop.hide();
      return this.playStat.playing = false;
    };

    DocPlayer.prototype.stop = function() {
      this.btnPlay.show();
      this.btnPause.hide();
      this.btnStop.hide();
      this.playStat.playing = false;
      clearTimeout(this.__timeout);
      this.patchVersion.text(DocInfo.ver);
      this.resetPlayStat();
      return this.docContent.html(this.lastContent);
    };

    DocPlayer.prototype.showLoading = function(msg) {
      return this.loading.html(msg).show();
    };

    DocPlayer.prototype.hideLoading = function() {
      return this.loading.hide();
    };

    return DocPlayer;

  })();

  DocView = (function() {

    function DocView(container, content) {
      this.container = container;
      this.content = content;
      this.docContent = $("#docContent");
    }

    DocView.prototype.init = function() {
      var content, patch, pt, results, _i, _len, _ref;
      content = DocInfo.content;
      if (DocInfo.patches) {
        _ref = DocInfo.patches;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          patch = _ref[_i];
          pt = dmp.patch_fromText(patch.patch);
          results = dmp.patch_apply(pt, content);
          content = results[0];
        }
      }
      this.docContent.html(content);
      return this.docPlayer = new DocPlayer(this.docContent);
    };

    return DocView;

  })();

  doc = new DocView();

  doc.init();

}).call(this);

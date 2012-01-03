(function() {
  var DocView, dmp, doc;

  dmp = new diff_match_patch();

  DocView = (function() {

    function DocView(container, content) {
      this.container = container;
      this.content = content;
      this.docContent = $("#docContent");
      this.dmp = new diff_match_patch();
    }

    DocView.prototype.makePatch = function() {
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

    DocView.prototype.applyPatch = function(patch_text) {
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
      return this.docContent.html(content);
    };

    return DocView;

  })();

  doc = new DocView();

  doc.init();

}).call(this);


dmp = new diff_match_patch()
    

class DocView
    constructor: (@container, @content) ->
        @docContent = $("#docContent")
        @dmp = new diff_match_patch()

    makePatch: () ->
        newContent = @editor.getContent()
        if @content == newContent.trim()
            return null

        diff = @dmp.diff_main(@content, newContent, true)
        if diff.length > 2
            @dmp.diff_cleanupSemantic diff
        patch_list = @dmp.patch_make @content, newContent, diff
        patch_text = @dmp.patch_toText patch_list
        @content = newContent
        return patch_text

    applyPatch: (patch_text) ->
        patches = @dmp.patch_fromText patch_text
        eContent = @editor.getContent()
        results = @dmp.patch_apply patches, eContent
        if @content.trim() != eContent.trim()
            #更新原始内容
            _results = @dmp.patch_apply patches, @content
            @content = _results[0]
        else
            @content = results[0]

        @editor.setContent results[0]
        @editor.selection.getRange().setCursor()
        @editor.focus()
    
    init: () ->
        #处理patches, 打patch到doc.content中
        content = DocInfo.content
        if DocInfo.patches
            for patch in DocInfo.patches
                pt = dmp.patch_fromText patch.patch
                results = dmp.patch_apply pt, content
                content = results[0]
        
        @docContent.html content



doc = new DocView()
doc.init()

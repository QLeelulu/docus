
dmp = new diff_match_patch()

class Doc
    constructor: (@container, @content) ->
        @editor = new baidu.editor.ui.Editor()
        @editor.render @container
        @editor.setContent @content
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
    

class MessageManage
    info: (msg) ->
        console.log(msg)

    warn: (msg) ->
        console.warn(msg)

    error: (msg) ->
        console.error(msg)

class Docus
    constructor: () ->
        @socket = io.connect('/doc')
        @mm = new MessageManage()
        @listens()

    listens: () ->
        that = this
        @socket.on 'connect', () ->
            that.mm.info 'connected!'
            that.socket.emit 'init', {slug: DocInfo.slug}
        
        @socket.on 'disconnect', () ->
            if that._patchLoop
                clearInterval that._patchLoop
                that._isDisconnected = true
                that.mm.error '你已经断开与服务器的链接'

        @socket.on 'init', (data) ->
            if !data.success
                return that.mm.error '很抱歉，出现错误，请尝试刷新页面'
            #处理data.patches, 打patch到doc.content中
            content = data.doc.content
            if data.patches
                for patch in data.patches
                    pt = dmp.patch_fromText patch.patch
                    results = dmp.patch_apply pt, content
                    content = results[0]
                                
            if that._isDisconnected
                that.doc.editor.setContent(content || '<p>&nbsp;</p>')
                taht.doc.editor.selection.getRange().setCursor()
            else
                that.doc = new Doc('docEditor', content || '<p>&nbsp;</p>')
            that.socket_id = data.socket_id
            that.startPatchLoop()

        @socket.on 'new version', (ver) ->
            that.doc.applyPatch ver.patch_text
    
    checkPatch: () ->
        patch_text = @doc.makePatch()
        if patch_text
            @socket.emit 'new version', {patch_text: patch_text}

    startPatchLoop: () ->
        that = this
        _f = () ->
            that.checkPatch()
        @_patchLoop = setInterval(_f, 10*1000)



docus = new Docus()
#docus.startPatchLoop()


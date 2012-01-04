
dmp = new diff_match_patch()

$cookie = (name, value, options) ->
    if typeof value != 'undefined'
        options = options || {}
        if value == null
            value = ''
            options.expires = -1
        
        expires = ''
        if options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)
            date = ''
            if typeof options.expires == 'number'
                date = new Date()
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000))
            else
                date = options.expires
            
            expires = '; expires=' + date.toUTCString()
        
        path = if options.path then '; path='+options.path else ''
        domain = if options.domain then '; domain='+options.domain else ''
        secure = options.secure ? '; secure': ''
        document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('')
    else
        arr = document.cookie.match(new RegExp("(^| )" + name + "=([^;]*)(;|$)"))
        if arr != null
            return decodeURIComponent(arr[2])
        
        return null
    

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
        @chatHolder = $("#chatHolder")
        @chatContent = $("#chatContent")
        @chatInput = $("#chatInput")
        @init()
        @listens()

    init: () ->
        that = this
        # show or hide chat form
        @chatHolder.find('.head').click ()->
            that.chatHolder.find('.main').toggle()
        
        # change name
        @chatHolder.find('.head .name').click (e)->
            if !that.nameEditor
                that.nameEditor = $('<input id="nameEditor" type="text" />')
                that.nameEditor.insertAfter(this);
                that.nameEditor.blur (e)->
                    nickname = $.trim($(this).val())
                    if nickname
                        $cookie('nickname', nickname, {expires:365})
                        that.socket.emit 'set nickname', nickname
                        that.nameEditor.hide()
                        that.chatHolder.find('.head .name').html(nickname).show()
                that.nameEditor.click (e)->
                    e.preventDefault()
                    return false

            that.nameEditor.val($(this).text())
            $(this).hide()
            that.nameEditor.show().focus()

            e.preventDefault()
            return false
        
        # if press Enter, send msg
        @chatInput.keydown (e)->
            if(event.keyCode==13)
                that.socket.emit 'new msg', that.chatInput.val()
                that.chatContent.append("<p class=\"me\"><span>我: </span>" + that.chatInput.val() + "</p>")
                that.chatInput.val('')
                return false
    
    listens: () ->
        that = this
        @socket.on 'connect', () ->
            that.mm.info 'connected!'
            that.socket.emit 'init', {slug: DocInfo.slug, nickname: $cookie("nickname")}
        
        # 系统断开连接事件
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
            
            # 如果是断线后重新连接的
            if that._isDisconnected
                that.doc.editor.setContent(content || '')
                that.doc.editor.selection.getRange().setCursor()
            else
                that.doc = new Doc('docEditor', content || '')
            that.socket_id = data.socket_id
            that.chatHolder.find('.head .name').html(data.nickname)
            that.chatHolder.find('.head .count').html('('+data.onlines+'人在编辑)')
            if data.lastMsg
                that.chatContent.append("<p><span>" + data.lastMsg.nickname + ": </span>" + data.lastMsg.msg + "</p>")
            that.chatHolder.show()
            that.startPatchLoop()

        @socket.on 'new version', (ver) ->
            that.doc.applyPatch ver.patch_text

        @socket.on 'info', (msg) ->
            that.mm.info msg

        @socket.on 'new editor', (data) ->
            that.mm.info data.nickname + ' 进来编辑了'
            that.chatHolder.find('.head .count').html('('+data.onlines+'人在编辑)')
        
        @socket.on 'leave', (data) ->
            that.mm.info data.nickname + ' 离开了'
            that.chatHolder.find('.head .count').html('('+data.onlines+'人在编辑)')
        
        @socket.on 'nicknames', (data) ->
            that.mm.info data
        
        @socket.on 'new msg', (data) ->
            that.chatContent.append("<p><span>" + data.nickname + ": </span>" + data.msg + "</p>")
    
    # if content changed, emit 'new version' event
    checkPatch: () ->
        patch_text = @doc.makePatch()
        if patch_text
            @socket.emit 'new version', {patch_text: patch_text}

    # loop and check
    startPatchLoop: () ->
        that = this
        _f = () ->
            that.checkPatch()
        @_patchLoop = setInterval(_f, 10*1000)



docus = new Docus()


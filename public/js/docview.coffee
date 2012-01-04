
dmp = new diff_match_patch()
    
class DocPlayer
    # @docContent: the content holder dom object
    constructor: (@docContent) ->
        # 保存最后一个版本的内容，在按停止按钮的时候需要用到
        @lastContent = @docContent.html()

        @btnPlay = $("#play")
        @btnPause = $("#pause")
        @btnStop = $("#stop")
        @patchVersion = $("#patchVersion")
        @loading = $("#loading")

        @dmp = dmp

        @resetPlayStat()

        @init()
    
    init: () ->
        that = this
        @btnPlay.click ()->
            that.play()
        @btnPause.click ()->
            that.pause()
        @btnStop.click ()->
            that.stop()
    
    resetPlayStat: ()->
        @playStat = {
            ver: 0,
            content: '',
            playing: false
        }

    play: () ->
        if !@patches
            @showLoading('正在加载版本信息...')
            that = this
            $.ajax({
                url: '/patches/' + DocInfo.slug,
                type: 'get',
                dataType: 'json',
                success: (r)->
                    if r.success
                        that.patches = r.patches
                        that.hideLoading()
                        that.startPlay()
                    else
                        # 这里偷懒了
                        that.showLoading('加载版本信息出错!')
                error: ()->
                    that.showLoading('加载版本信息出错!')
            })
        else
            @startPlay()
    
    startPlay: () ->
        @hideLoading()
        @btnPlay.hide()
        @btnPause.show()
        @btnStop.show()
        @playStat.playing = true
        @_playLoop()
    
    _playLoop: () ->
        if !@playStat.playing
            return
        that = this
        patch = @patches[@playStat.ver]
        @playStat.ver++
        if patch
            @applyPatch(patch.patch)
            @patchVersion.text(patch.ver)
            # 闭包
            _playLoop = ()->
                that._playLoop()
            @__timeout = setTimeout(_playLoop, 500)
        else
            @stop()
    
    applyPatch: (patch_text) ->
        patches = @dmp.patch_fromText patch_text
        eContent = @playStat.content
        results = @dmp.patch_apply patches, eContent
        @playStat.content = results[0]

        @docContent.html @playStat.content
    
    pause: () ->
        @btnPlay.show()
        @btnPause.hide()
        @btnStop.hide()
        @playStat.playing = false
    
    stop: () ->
        @btnPlay.show()
        @btnPause.hide()
        @btnStop.hide()
        @playStat.playing = false
        clearTimeout(@__timeout)
        @patchVersion.text(DocInfo.ver)
        # 复位播放状态
        @resetPlayStat()

        @docContent.html @lastContent
    
    showLoading: (msg)->
        @loading.html(msg).show()
    
    hideLoading: ()->
        @loading.hide()


class DocView
    constructor: (@container, @content) ->
        @docContent = $("#docContent")
    
    init: () ->
        #处理patches, 打patch到doc.content中
        content = DocInfo.content
        if DocInfo.patches
            for patch in DocInfo.patches
                pt = dmp.patch_fromText patch.patch
                results = dmp.patch_apply pt, content
                content = results[0]
        
        @docContent.html content

        @docPlayer = new DocPlayer @docContent
    



doc = new DocView()
doc.init()

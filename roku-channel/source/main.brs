' Ingredient Dictionary The Party Game - Roku channel entry point.
' Roku calls Main() (its RunUserInterface entry) with the launch parameters.
' The game has no deep-linked content, so any contentId/mediaType is accepted
' and ignored, and the channel always opens on the title screen.
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    if type(args) = "roAssociativeArray" then scene.launchArgs = args
    scene.observeField("exitRequested", port)

    ' Deep links while running (roInput) are accepted and ignored.
    input = CreateObject("roInput")
    if input <> invalid then input.setMessagePort(port)

    while true
        msg = wait(0, port)
        msgType = type(msg)
        if msgType = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        else if msgType = "roSGNodeEvent"
            if msg.getField() = "exitRequested" and msg.getData() = true
                screen.close()
                return
            end if
        else if msgType = "roInputEvent"
            ' Nothing to open: the player is already in the game.
        end if
    end while
end sub

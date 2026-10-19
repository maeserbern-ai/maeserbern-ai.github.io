# JavaScript calls this exact method name through the AndroidApp bridge.
-keepclassmembers class io.github.maeserbern.ingredientpartygame.MainActivity$AppBridge {
    @android.webkit.JavascriptInterface <methods>;
}

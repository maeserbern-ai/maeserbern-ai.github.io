# Builds the Apple TV app icon + Top Shelf images from the store pictures.
# Run once on Windows (uses System.Drawing); the PNGs it writes are committed in assets/tv/.
#   powershell -ExecutionPolicy Bypass -File scripts/make-tv-images.ps1
param(
  [string]$BannerPath = "$env:USERPROFILE\Downloads\PartyGame-StorePictures\tv-banner-1280x720.png",
  [string]$IconPath = "$env:USERPROFILE\Downloads\PartyGame-StorePictures\icon-512.png"
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"
$out = Join-Path $PSScriptRoot "..\assets\tv"
New-Item -ItemType Directory -Force $out | Out-Null
$bannerImg = [System.Drawing.Image]::FromFile((Resolve-Path $BannerPath))

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @($bmp, $g)
}
function Save($bmp, $name) {
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "assets/tv/$name  $($bmp.Width)x$($bmp.Height)"
}

# App icon (1280x768 and the 400x240 / 800x480 home-screen sizes): the banner, scaled to cover, centered.
foreach ($s in @(@(1280, 768, "icon-1280x768.png"), @(400, 240, "icon-400x240.png"), @(800, 480, "icon-800x480.png"))) {
  $w = $s[0]; $h = $s[1]
  $bmp, $g = New-Canvas $w $h
  $scale = [Math]::Max($w / $bannerImg.Width, $h / $bannerImg.Height)
  $dw = [int][Math]::Ceiling($bannerImg.Width * $scale); $dh = [int][Math]::Ceiling($bannerImg.Height * $scale)
  $g.DrawImage($bannerImg, [int](($w - $dw) / 2), [int](($h - $dh) / 2), $dw, $dh)
  Save $bmp $s[2]; $g.Dispose(); $bmp.Dispose()
}

# Top Shelf (1920x720, 2320x720 and @2x): banner at full height on the left, the
# banner's right edge stretched to fill the rest so the dark gradient continues.
foreach ($s in @(@(1920, 720, "topshelf-1920x720.png"), @(3840, 1440, "topshelf-3840x1440.png"),
                 @(2320, 720, "topshelf-wide-2320x720.png"), @(4640, 1440, "topshelf-wide-4640x1440.png"))) {
  $w = $s[0]; $h = $s[1]
  $bmp, $g = New-Canvas $w $h
  $scale = $h / $bannerImg.Height
  $dw = [int]($bannerImg.Width * $scale)
  $edge = New-Object System.Drawing.Rectangle ($bannerImg.Width - 90), 0, 8, $bannerImg.Height
  $g.DrawImage($bannerImg, (New-Object System.Drawing.Rectangle ($dw - 4), 0, ($w - $dw + 4), $h), $edge, [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawImage($bannerImg, 0, 0, $dw, $h)
  Save $bmp $s[2]; $g.Dispose(); $bmp.Dispose()
}

# Expo's generic app icon + splash (1024 icon from the 512 store icon; splash = icon on emerald).
$iconImg = [System.Drawing.Image]::FromFile((Resolve-Path $IconPath))
$bmp, $g = New-Canvas 1024 1024
$g.DrawImage($iconImg, 0, 0, 1024, 1024)
$bmp.Save((Join-Path $out "..\icon.png"), [System.Drawing.Imaging.ImageFormat]::Png); Write-Host "assets/icon.png  1024x1024"
$g.Dispose(); $bmp.Dispose()
$bmp, $g = New-Canvas 1920 1080
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#16211C"))
$g.DrawImage($bannerImg, 320, 180, 1280, 720)
$bmp.Save((Join-Path $out "..\splash.png"), [System.Drawing.Imaging.ImageFormat]::Png); Write-Host "assets/splash.png  1920x1080"
$g.Dispose(); $bmp.Dispose()
$iconImg.Dispose(); $bannerImg.Dispose()




## manifest.webmanifest

```json
{
  "name": "Micro — شريك مشروعك",
  "short_name": "Micro",
  "description": "Micro: شريك مالي وتشغيلي محلي لصاحب المشروع.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAF9F5",
  "theme_color": "#FAF9F5",
  "lang": "ar",
  "scope": "/",
  "id": "/",
  "orientation": "portrait-primary",
  "dir": "rtl",
  "icons": [
    {
      "src": "/brand/pwa/ios-android-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/brand/pwa/ios-android-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/brand/pwa/web-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### Invariants
- ✅ lang=ar
- ✅ dir=rtl
- ✅ display standalone
- ✅ orientation portrait-primary
- ✅ start_url=/
- ✅ scope=/

### Manifest icons
- ✅ brand/pwa/ios-android-192.png sizes=192x192 purpose=any type=image/png actual=(192, 192)
- ✅ brand/pwa/ios-android-512.png sizes=512x512 purpose=any type=image/png actual=(512, 512)
- ✅ brand/pwa/web-maskable-512.png sizes=512x512 purpose=maskable type=image/png actual=(512, 512)

### index.html references (built)
- ✅ `/brand/favicon/favicon.ico`
- ✅ `/brand/favicon/micro-favicon-field.svg`
- ✅ `/brand/favicon/micro-favicon-field-dark.svg`
- ✅ `/brand/pwa/ios-android-180.png`
- ✅ `lang="ar"`
- ✅ `dir="rtl"`
- ✅ no old micro-mark references (found [])

### Service worker precache (app-shell brand assets)
- ✅ brand/mark/micro-quad.svg
- ✅ brand/mark/micro-quad-dark.svg
- ✅ brand/favicon/favicon.ico
- ✅ brand/pwa/ios-android-192.png
- ✅ brand/pwa/ios-android-512.png
- ✅ brand/pwa/web-maskable-512.png
- ✅ brand/pwa/ios-android-180.png
- ✅ brand/motion/light/1-top-ink.svg
- ✅ brand/motion/light/4-left-terracotta.svg
- ✅ brand/motion/dark/1-top-ink.svg
- ✅ brand/motion/dark/4-left-terracotta.svg
- ✅ no old runtime icon URLs in precache (found [])
- precache manifest entries: 165

### Old assets absent from build output
- ✅ dist/micro-mark.svg absent
- ✅ dist/micro-mark-192.png absent
- ✅ dist/micro-mark-512.png absent

## Result: ✅ PASS

Note: the Android/iOS splash SVGs under `brand/splash/` are platform-ready source references; no native wrapper exists in this repository, so no native system splash is claimed. The visible current-system splash is the in-app `BrandLaunchSplash` component.

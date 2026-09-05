# Progressive Web App (PWA) Guide

Over the Moon is now a full Progressive Web App, installable on mobile devices for a native app-like experience.

## 🍎 Installing on iPhone

### Prerequisites
- **Use Safari** (PWA installation only works in Safari on iOS, not Chrome or other browsers)
- iOS 16.4 or later recommended for best experience

### Installation Steps

1. **Open in Safari**
   ```
   https://otm-fpl.vercel.app
   ```

2. **Tap the Share button**
   - Look for the square icon with an arrow pointing up
   - Usually at the bottom of the screen (center)

3. **Scroll and select "Add to Home Screen"**
   - May need to scroll down in the share menu
   - Icon looks like a plus sign in a square

4. **Tap "Add" in the top-right**
   - You can customize the name if desired
   - Default is "OTM FPL"

5. **Launch from Home Screen**
   - The OTM icon will appear on your home screen
   - Tap it to launch the app in standalone mode

### What You Get

- ✅ **No Safari chrome** - Full-screen app experience
- ✅ **Proper icon** - OTM moon-ball logo
- ✅ **Fast loading** - Cached assets load instantly
- ✅ **Status bar integration** - Translucent bar blends with app
- ✅ **Offline fallback** - Graceful handling when network unavailable

## 🔧 Developer Guide

### Regenerating Icons

If you update `public/otm-ball.svg` or need to regenerate icons:

```bash
npm run generate:icons
```

This creates:
- `apple-touch-icon.png` (180×180)
- `icon-192.png`, `icon-512.png` (standard PWA)
- `icon-192-maskable.png`, `icon-512-maskable.png` (maskable with padding)
- `favicon-16x16.png`, `favicon-32x32.png`

### Service Worker

The service worker is auto-generated during build by `@ducanh2912/next-pwa`:

```bash
npm run build
```

Output: `public/sw.js` and related Workbox files.

**Important**: Service worker is disabled in development (`npm run dev`) and only active in production builds.

### Updating the Manifest

Edit `public/site.webmanifest` to change:
- App name and short name
- Theme colors
- Icons
- Display mode (standalone, fullscreen, etc.)
- Orientation

### Offline Behavior

- **Cached**: App shell, static assets, previously visited pages, fonts, images
- **Network required**: Live Fantrax data, API endpoints, first-time page loads
- **Fallback**: `/offline` page shown when network unavailable

### Workbox Configuration

Caching strategies in `next.config.ts`:

- **Google Fonts**: CacheFirst (1 year)
- **Images/Static Assets**: StaleWhileRevalidate (24 hours)
- **Pages**: NetworkFirst with 10s timeout
- **API Routes**: Not cached (always fresh)

### iOS-Specific Meta Tags

Defined in `src/app/layout.tsx`:

```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="OTM FPL" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

### Install Prompt

The optional iOS install prompt component (`src/components/ios-install-prompt.tsx`):

- Shows only on iOS Safari
- Only when NOT in standalone mode
- Appears 3 seconds after page load
- Dismissible and remembers preference via localStorage
- Can be disabled by removing from `layout.tsx`

## 📊 Testing

### Local Testing

PWA features only work in production builds:

```bash
# Build with PWA
npm run build

# Serve production build locally
npm run start

# Visit in browser
open http://localhost:3000
```

### Verifying Service Worker

Check that SW is registered:

```bash
# Production URL
curl https://otm-fpl.vercel.app/sw.js

# Should return JavaScript code
```

### Manifest Validation

Check manifest is accessible:

```bash
curl https://otm-fpl.vercel.app/site.webmanifest
```

Use Chrome DevTools → Application → Manifest to validate structure.

### Lighthouse PWA Audit

Run Lighthouse audit in Chrome DevTools:

1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Generate report"

Should score 90+ on PWA metrics.

## 🚨 Troubleshooting

### "Add to Home Screen" not appearing in Safari
- Ensure you're using Safari, not Chrome or another browser
- Check iOS version (16.4+ recommended)
- Try force-refreshing the page (pull down to refresh)

### App not updating after install
- iOS caches aggressively - may take hours to update
- Force-close and reopen the app
- For immediate updates, remove and reinstall

### Icons not loading
- Check icon paths in `public/site.webmanifest`
- Verify files exist in `public/` directory
- Clear browser cache and rebuild

### Service worker not registering
- Only works in production builds (`npm run build`)
- Check browser console for SW errors
- Verify HTTPS (required for SW, Vercel provides this)

### Install prompt not showing
- Only shows on iOS Safari
- Only when not already installed
- Checks localStorage for dismissal
- Clear localStorage to reset: `localStorage.clear()`

## 🔐 Security & Privacy

- **HTTPS required**: Service workers only work over HTTPS (Vercel handles this)
- **Same-origin policy**: SW can only cache same-origin resources
- **No telemetry**: No analytics or tracking in PWA implementation
- **Local storage only**: Install prompt preference stored locally, not server-side

## 📚 Resources

- [Next PWA Documentation](https://ducanh-next-pwa.vercel.app/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Web App Manifest Spec](https://w3c.github.io/manifest/)
- [Apple PWA Guidelines](https://developer.apple.com/videos/play/wwdc2021/10107/)
- [PWA Builder](https://www.pwabuilder.com/) - Validation tool

---

**Questions?** Check the PR description or ask Connor.

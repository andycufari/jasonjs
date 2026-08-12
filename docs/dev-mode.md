# Dev Mode

See your changes instantly without waiting for cache refreshes.

## Quick Start

Add `?dev=true` to any URL:

```
https://yoursite.com?dev=true
```

Now your changes appear immediately when you reload the page. Lasts 24 hours.

## What It Does

**Dev mode OFF** (normal):
- Pages, components, and data are cached for speed
- Changes take a few minutes to appear
- Fast for users, slower for testing changes

**Dev mode ON** (`?dev=true`):
- Everything loads fresh every time
- Changes appear instantly
- Slower loading, perfect for development

## Usage

### Enable

Visit any page with `?dev=true`:
```
https://yoursite.com/dashboard?dev=true
```

Dev mode is now active. You can reload without the parameter - it stays on.

### Disable

Visit any page with `?dev=false`:
```
https://yoursite.com?dev=false
```

Or just wait 24 hours - it expires automatically.

### Check Status

Not sure if dev mode is on? Add `?dev=true` again - it's safe to enable multiple times.

## Examples

### Testing Component Changes

```bash
# 1. Enable dev mode
Visit: https://yoursite.com?dev=true

# 2. Edit your component
Edit: components/ProductCard.jsx

# 3. Reload to see changes
Reload: https://yoursite.com
# ↑ Changes appear instantly
```

### Testing Page Changes

```bash
# 1. Enable dev mode
Visit: https://yoursite.com?dev=true

# 2. Edit your page
Edit: pages/home.json

# 3. Reload
Visit: https://yoursite.com
# ↑ New page structure appears
```

### Testing Function Changes

```bash
# 1. Enable dev mode
Visit: https://yoursite.com?dev=true

# 2. Edit your function
Edit: functions/api/get-products.js

# 3. Trigger the function
# Changes take effect immediately
```

## Component Test Mode

Test a single component in isolation:

```
https://yoursite.com?c=ProductCard
```

Renders just that component on a blank page. Great for:
- Rapid iteration
- Testing different props
- Debugging component issues

Auto-enables dev mode too.

## When to Use Dev Mode

**Use dev mode when:**
- Building new features
- Fixing bugs
- Testing changes
- Debugging issues

**Turn off dev mode when:**
- Done making changes
- Testing performance
- Showing to users
- Done for the day

> 💡 **Tip:** Always disable dev mode when you're done. It makes the site slower and expires after 24 hours anyway.

## Common Issues

### Changes Not Appearing

**Try these in order:**

1. **Hard reload the browser**
   - Mac: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`

2. **Re-enable dev mode**
   ```
   Visit: https://yoursite.com?dev=true
   ```

3. **Clear browser cache**
   - Open DevTools (F12)
   - Network tab → Disable cache
   - Reload

### Dev Mode Not Working

If changes still don't appear:
- Check you saved the file
- Verify you're editing the correct file
- Ensure the file path matches what you're testing

## How Long Does It Last?

**24 hours** from when you enable it.

Every time you load a page with dev mode active, the timer resets to 24 hours.

Example:
```
Monday 10:00 AM - Enable dev mode
Monday 10:30 AM - Load a page (timer resets)
Monday 11:00 AM - Load a page (timer resets)
...
Tuesday 11:00 AM - Timer expires (24h since last page view)
```

To keep dev mode active, just keep working. To end it early, use `?dev=false`.

## Security

Dev mode only affects **your browser sessions**. Other users see the normal cached version.

This means:
- Safe to use dev mode in production
- Won't slow down your users
- Only you see the fresh, uncached version

## Best Practices

### During Development
```bash
# Start of work session
1. Visit ?dev=true

# Work on your features
2. Edit files
3. Reload browser
4. See changes instantly

# End of work session
5. Visit ?dev=false
```

### Quick Testing
```bash
# Need to test one small change?
1. Visit ?dev=true
2. Make change
3. Reload
4. Visit ?dev=false when done
```

### Component Development
```bash
# Working on a specific component?
Visit: ?c=YourComponent

# Faster than navigating to pages that use it
```

## Performance Note

Dev mode bypasses caching, so pages load slower. This is **intentional** - you're trading speed for seeing changes instantly.

Normal mode:
- ⚡ Fast loads
- ⏱️ Changes take time to appear

Dev mode:
- 🐢 Slower loads
- ⚡ Changes appear instantly

Always turn off dev mode when you're done testing.

> 📖 **Related:** [Functions](./functions.md), [Components](./components/index.md)

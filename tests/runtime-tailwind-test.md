# Runtime Tailwind CSS Test Guide

## Purpose
Verify that arbitrary Tailwind classes work correctly in database-loaded components after the fix.

## Test Setup

### 1. Create Test Component

Navigate to your Startup Studio and create a new component with this code:

**Component Name**: `TailwindTestCard`

```jsx
export default function TailwindTestCard() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-[32px] font-bold">Runtime Tailwind Test</h1>

      {/* Test 1: Arbitrary Colors */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">1. Arbitrary Colors</h2>
        <div className="bg-[#0a0a0a] text-[#ef4444] p-4 rounded">
          Dark background (#0a0a0a) with red text (#ef4444)
        </div>
        <div className="bg-[#1a1a1a] text-[#3b82f6] p-4 rounded">
          Darker gray (#1a1a1a) with blue text (#3b82f6)
        </div>
      </div>

      {/* Test 2: Hover States */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">2. Hover States</h2>
        <button className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-6 py-3 rounded transition-colors">
          Hover Me (Red to Darker Red)
        </button>
        <button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-3 rounded transition-colors">
          Hover Me (Blue to Darker Blue)
        </button>
      </div>

      {/* Test 3: Arbitrary Sizes */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">3. Arbitrary Sizes</h2>
        <div className="bg-blue-100 h-[100px] w-[300px] flex items-center justify-center">
          Fixed size: 300px × 100px
        </div>
        <div className="bg-green-100 max-w-[500px] p-4">
          Max width: 500px
        </div>
      </div>

      {/* Test 4: Arbitrary Spacing */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">4. Arbitrary Spacing</h2>
        <div className="bg-purple-100 p-[30px]">
          Custom padding: 30px
        </div>
        <div className="bg-pink-100 m-[20px] p-4">
          Custom margin: 20px
        </div>
      </div>

      {/* Test 5: Arbitrary Shadows */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">5. Arbitrary Shadows</h2>
        <div className="bg-white p-6 shadow-[0_0_30px_rgba(239,68,68,0.3)] rounded">
          Red glow shadow
        </div>
        <div className="bg-white p-6 shadow-[0_10px_50px_rgba(59,130,246,0.3)] rounded">
          Blue shadow
        </div>
      </div>

      {/* Test 6: Complex Example */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">6. Complex Example (HackerHero Style)</h2>
        <div className="bg-[#0a0a0a] border-[#222222] border-2 p-6 rounded-lg shadow-[0_0_30px_rgba(239,68,68,0.3)]">
          <h3 className="text-[#ef4444] text-[24px] font-bold mb-4">
            HackerHero Card
          </h3>
          <p className="text-[#a0a0a0] mb-4">
            This card uses the same styling as HackerHero components:
          </p>
          <ul className="space-y-2">
            <li className="text-[#a0a0a0]">✓ Dark background (#0a0a0a)</li>
            <li className="text-[#a0a0a0]">✓ Red accent (#ef4444)</li>
            <li className="text-[#a0a0a0]">✓ Dark borders (#222222)</li>
            <li className="text-[#a0a0a0]">✓ Red glow effect</li>
          </ul>
          <button className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-6 py-3 rounded mt-4 transition-colors">
            Call to Action
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. Add Component to a Page

Create or edit a page to include the test component:

```json
{
  "component": "div",
  "attributes": {
    "className": "min-h-screen bg-gray-50 py-12"
  },
  "components": [
    {
      "component": "./TailwindTestCard",
      "attributes": {}
    }
  ]
}
```

## Verification Steps

### Step 1: Visual Inspection

Load the page with the test component and verify:

✅ **Test 1 - Arbitrary Colors**:
- First box: Very dark background with red text
- Second box: Dark gray background with blue text

✅ **Test 2 - Hover States**:
- Red button darkens on hover
- Blue button darkens on hover

✅ **Test 3 - Arbitrary Sizes**:
- First box: Exactly 300px wide and 100px tall
- Second box: Maximum width of 500px

✅ **Test 4 - Arbitrary Spacing**:
- Purple box: Large 30px padding
- Pink box: 20px margin around it

✅ **Test 5 - Arbitrary Shadows**:
- First card: Visible red glow around edges
- Second card: Visible blue shadow

✅ **Test 6 - Complex Example**:
- Dark card with red accents
- Red glow effect
- Button hover works

### Step 2: DevTools Inspection

1. **Open DevTools** → Elements → `<head>`
2. **Look for**: `<style id="dynamic-css-TailwindTestCard-...">`
3. **Verify CSS rules** are present:

```css
.bg-\[\#0a0a0a\] { background-color: #0a0a0a; }
.text-\[\#ef4444\] { color: #ef4444; }
.hover\:bg-\[\#dc2626\]:hover { background-color: #dc2626; }
.w-\[300px\] { width: 300px; }
.h-\[100px\] { height: 100px; }
.p-\[30px\] { padding: 30px; }
.shadow-\[0_0_30px_rgba\(239\,68\,68\,0\.3\)\] { box-shadow: 0 0 30px rgba(239,68,68,0.3); }
```

### Step 3: Computed Styles

1. **Right-click** on the dark card (Test 1, first box)
2. **Inspect** → Computed tab
3. **Verify**:
   - `background-color: rgb(10, 10, 10)` (#0a0a0a)
   - `color: rgb(239, 68, 68)` (#ef4444)

### Step 4: Console Check

Open the Console and verify:

✅ **No errors** related to Tailwind or styles
✅ **Should see** (in dev mode): `"Dynamic CSS generated for TailwindTestCard (XXX bytes)"`
✅ **Should NOT see**: Missing class warnings or style injection errors

### Step 5: Network Tab

1. **Open Network tab** → Filter: Fetch/XHR
2. **Reload page**
3. **Find component response**
4. **Verify** response includes `dynamicCSS` field:

```json
{
  "code": "...",
  "dynamicCSS": ".bg-\\[\\#0a0a0a\\] { background-color: #0a0a0a; }...",
  "hash": "abc123",
  "main": "TailwindTestCard",
  "imports": [...]
}
```

## Expected Results

### ✅ PASS Criteria

- All 6 test sections display correctly
- Colors match exact hex values specified
- Hover effects work on buttons
- Shadows are visible
- No console errors
- Style tag appears in `<head>`
- Computed styles show correct values

### ❌ FAIL Criteria

- Arbitrary colors don't apply (black text on white background)
- Hover states don't work
- Shadows missing
- Console shows "class not found" errors
- No style tag in `<head>`
- `bundle.dynamicCSS` is null/undefined

## Troubleshooting

### Problem: No styles applied

**Debug steps**:

1. Check if `bundle.dynamicCSS` exists:
   ```javascript
   // In DevTools Console
   console.log(document.querySelector('[id^="dynamic-css-"]'));
   ```

2. Check bundle response:
   - Network tab → Find component request
   - Verify `dynamicCSS` field is present

3. Check for errors:
   - Console tab → Look for injection errors

**Expected cause**: `useEffect` not firing or bundle missing `dynamicCSS`

### Problem: Some classes work, others don't

**Debug steps**:

1. Check which patterns work:
   - Colors? ✅ or ❌
   - Hover? ✅ or ❌
   - Sizes? ✅ or ❌
   - Shadows? ✅ or ❌

2. Inspect generated CSS:
   ```javascript
   // In DevTools Console
   const style = document.querySelector('[id^="dynamic-css-"]');
   console.log(style.textContent);
   ```

**Expected cause**: Pattern not supported in `generateCSSForClass()`

### Problem: CSS selectors not matching

**Debug steps**:

1. Check escaped selectors in style tag
2. Compare with actual class names in HTML
3. Verify escaping is correct

**Expected cause**: Escaping bug in `escapeSelector()`

## Additional Tests

### Test with HackerHero Site

If you have access to the HackerHero site:

1. Navigate to HackerHero homepage
2. Verify dark theme displays correctly
3. Check that red accents (#ef4444) show properly
4. Verify shadows and glows work

### Test Component Unmounting

1. Navigate away from test page
2. Go back to DevTools → Elements → `<head>`
3. Verify old style tags are removed (cleanup working)
4. Navigate back to test page
5. Verify new style tag is injected

## Success Metrics

After running all tests, you should see:

✅ **100% visual accuracy** - All arbitrary values render correctly
✅ **0 console errors** - No runtime errors or warnings
✅ **Style injection working** - `<style>` tags present in DOM
✅ **Proper cleanup** - Old styles removed on unmount
✅ **Performance** - No noticeable lag or flashing

## Reporting Issues

If tests fail, provide:

1. Screenshot of failed test
2. DevTools Console output
3. Network tab showing bundle response
4. Elements tab showing `<head>` contents
5. Browser and version

## Conclusion

This comprehensive test validates that the Runtime Tailwind CSS system is working correctly. All arbitrary Tailwind values should now work seamlessly in database-loaded components.

---

**Test Date**: 2026-02-11
**Framework Version**: JasonJS v2.0
**Fix Version**: Runtime Tailwind CSS v1.0

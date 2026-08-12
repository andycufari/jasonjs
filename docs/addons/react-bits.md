# React Bits Addon — Visual Effects

WebGL/Three.js effect components for hero sections, landing pages, and anywhere you want a statement piece. GPU-intensive by design — use one or two per page, not everywhere.

- **Package**: `@addons/react-bits`
- **Components**: `ASCIIText`, `ColorBends`, `Dither`
- **Dependencies**: `three`, `@react-three/fiber`, `@react-three/postprocessing`, `postprocessing` (already in the framework's dependency set)

## ASCIIText

Animated 3D text rendered as ASCII art, with mouse-driven rotation and wave distortion. Best for short (1–2 word) headlines on dark backgrounds.

```json
{
  "component": "div",
  "attributes": { "style": { "position": "relative", "width": "100%", "height": "500px", "background": "#000" } },
  "components": [
    {
      "component": "@addons/react-bits/ASCIIText",
      "attributes": { "text": "Hello", "asciiFontSize": 8, "textFontSize": 200, "textColor": "#fdf9f3", "enableWaves": true }
    }
  ]
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `text` | `"David!"` | Text to display |
| `asciiFontSize` | `8` | ASCII character size |
| `textFontSize` | `200` | Source text texture size |
| `textColor` | `#fdf9f3` | Text color |
| `planeBaseHeight` | `8` | 3D plane height |
| `enableWaves` | `true` | Wave distortion |

⚠️ The parent container **must** have explicit width/height and `position: relative` (true for all three components).

## ColorBends

Fluid morphing color gradients with shader warping and mouse parallax. Use as a background layer with content stacked above:

```json
{
  "component": "div",
  "attributes": { "style": { "position": "relative", "minHeight": "100vh" } },
  "components": [
    {
      "component": "div",
      "attributes": { "style": { "position": "absolute", "inset": 0, "zIndex": 0 } },
      "components": [
        {
          "component": "@addons/react-bits/ColorBends",
          "attributes": { "colors": ["#667eea", "#764ba2", "#f093fb"], "speed": 0.15, "warpStrength": 0.8 }
        }
      ]
    },
    {
      "component": "div",
      "attributes": { "style": { "position": "relative", "zIndex": 10 }, "className": "p-16" },
      "components": [ { "component": "h1", "innerHTML": "Readable content on top" } ]
    }
  ]
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `colors` | `[]` | Up to 8 hex colors (empty = default RGB flow) |
| `rotation` | `45` | Base angle (degrees) |
| `speed` | `0.2` | Animation speed |
| `autoRotate` | `0` | Degrees/second of auto-rotation |
| `scale` / `frequency` | `1` / `1` | Zoom / pattern density |
| `warpStrength` | `1` | Distortion (0–2+) |
| `mouseInfluence` / `parallax` | `1` / `0.5` | Mouse interaction strength |
| `noise` | `0.1` | Grain amount |
| `transparent` | `true` | Alpha transparency |

2–4 brand colors and speeds of 0.1–0.3 look the most premium.

## Dither

Retro dithered waves (Bayer-matrix post-processing over Perlin noise) — lo-fi, cyberpunk, vaporwave aesthetics.

```json
{
  "component": "@addons/react-bits/Dither",
  "attributes": {
    "waveColor": [0.2, 0.7, 1],
    "colorNum": 2.5,
    "waveAmplitude": 0.65,
    "waveFrequency": 0,
    "waveSpeed": 0.03,
    "enableMouseInteraction": true,
    "mouseRadius": 0.9
  }
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `waveColor` | `[0.5, 0.5, 0.5]` | RGB **0–1** (not 0–255) |
| `colorNum` | `4` | Dither levels — lower = more retro (`2` = 1-bit look) |
| `pixelSize` | `2` | Dither pixel size |
| `waveSpeed` / `waveFrequency` / `waveAmplitude` | `0.05` / `3` / `0.3` | Wave motion (`frequency: 0` = smooth organic drift) |
| `enableMouseInteraction` | `true` | Cursor wave distortion |
| `mouseRadius` | `1` | Interaction radius |
| `disableAnimation` | `false` | Freeze the effect |

## Performance & when not to use

- One, at most two, effect components per page; they each own a WebGL context.
- Consider static alternatives on mobile-first pages — these lean on the GPU.
- Skip them on content-heavy, form-heavy, or accessibility-critical sections.
- Components clean up after themselves on unmount; no manual teardown needed.

**Not visible?** Check the parent has explicit dimensions and `position: relative`; for `ASCIIText`, use a dark background.

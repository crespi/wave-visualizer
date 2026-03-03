# PRD: Oscilloscope Wave Visualizer

## Overview

A single-page web tool that visualizes audio waveforms with a realistic CRT oscilloscope aesthetic. The user can select a wave type and adjust its visual parameters in real time. No audio is generated -- this is a pure visual/educational tool.

## Goals

- Render sine, square (rectangular), triangle, and sawtooth waves on an HTML canvas
- Achieve a convincing CRT phosphor screen look
- Animate the wave as a continuous scrolling beam, mimicking a real oscilloscope sweep
- Allow for copying or exporting the resulting image

## Non-goals

- No audio synthesis or Web Audio API
- No multiple simultaneous wave overlays
- No mobile-specific layout (desktop-first is fine)

## Visual Design

The tool should look like a vintage CRT oscilloscope screen. Key visual elements:

**Canvas / screen area**
- Black background
- Faint horizontal scanline overlay at low opacity to suggest CRT texture

**Wave rendering (phosphor glow effect)**
Draw the same wave path multiple times per frame, layered:
1. Widest stroke (~8–10px), very low opacity green -- outer glow
2. Medium stroke (~4px), medium opacity green -- mid glow
3. Thin stroke (~1.5px), near-white or cyan-white, full opacity -- beam core

Target phosphor color: P31 green. Use approximately `hsl(135, 100%, 55%)` for the glow layers and `hsl(165, 100%, 85%)` or near-white for the core. The result should look bright cyan-white at the center, fading to green at the edges -- matching classic oscilloscope phosphor bloom.

No `canvas.filter: blur()` -- achieve the glow purely through layered strokes for performance.


## Wave Formulas

All formulas take a normalized x value (0 to 2π * frequency * cycles) and return a y value in the range [-1, 1], then scaled by amplitude.

- Sine: `Math.sin(x)`
- Square: `Math.sign(Math.sin(x))`
- Triangle: `(2 / Math.PI) * Math.asin(Math.sin(x))`
- Sawtooth: `(x % (2 * Math.PI)) / Math.PI - 1` (normalized to [-1, 1])

## Technical Stack

- Plain HTML, CSS, JavaScript -- no frameworks unless needed
- Single `.html` file, self-contained
- `<canvas>` element for rendering
- `requestAnimationFrame` loop for animation
- `<input type="range">` for sliders

## Project Context: Barcelona Modular Society Visual Identity

I'm designing the visual identity for Barcelona Modular Society (BMS), a non-profit community of modular synthesizer musicians in Barcelona. The design system bridges analog modular synth culture with digital precision.

### Design System Foundations

**Grid system**: Based on Eurorack spatial units — 3U rows and HP (horizontal pitch) widths, the same measurements used for physical modular synth cases. This creates a structural metaphor connecting the visual system to the hardware.

**Typography**: Barlow Semi Condensed — technical, condensed, readable. Swiss Style influence.

**Color**: Primarily monochrome (black background, white/gray elements) with a single accent: yellow from the cat mascot's eyes.

### Wave Visualizer

The wave visualizer generates animated waveforms (sine, saw, triangle, square) as background graphics for event posters and digital materials. It includes:

- **FM (frequency modulation)**: Modulates the main wave's frequency
- **AM (amplitude modulation)**: Modulates the main wave's amplitude  
- **Waveshaping/fold**: Distorts the wave by folding amplitudes that exceed thresholds
- **ADSR envelope**: Shapes amplitude over time

The visualizer outputs transparent PNGs of the wave for use in compositions.

**Current styling goal**: Moving from clean vector strokes to a Mordax Data oscilloscope aesthetic — pixel quantization (stair-stepped lines snapped to a low-res grid ~320x240), phosphor glow/bloom, optional scanlines, and saturated oscilloscope colors (cyan, green, magenta, amber). This connects the digital visualization to actual modular synth test equipment.

### XY / Lissajous Mode

The visualizer has an XY mode that plots two channels against each other (CH1 → X axis, CH2 → Y axis) instead of time-domain. This produces Lissajous figures — geometric curves iconic in oscilloscope and modular synth culture.

**Sample configurations:**

**Classic 3:2 knot** — the most recognizable Lissajous shape
- CH1 (X): sine, freq 3, amp 0.8
- CH2 (Y): sine, freq 2, amp 0.8

**Five-lobed star** — 5:3 ratio
- CH1 (X): sine, freq 5, amp 0.8
- CH2 (Y): sine, freq 3, amp 0.8

**FM-twisted loop** — organic, non-geometric; different FM ratios on each axis breaks the symmetry
- CH1 (X): sine, freq 1, FM on — ratio 2.0, depth 0.8
- CH2 (Y): sine, freq 1, FM on — ratio 3.0, depth 0.5

**Folded figure-8** — wavefold distorts the classic 1:2 into something spiky
- CH1 (X): sine, freq 1, fold on — threshold 0.4, iterations 5
- CH2 (Y): sine, freq 2, amp 0.7

**Sawtooth grid** — sawtooth's linear ramp vs sine creates a very different texture
- CH1 (X): sawtooth, freq 3, amp 0.8
- CH2 (Y): sine, freq 4, amp 0.8

**AM web** — AM collapses amplitude toward the center at different rates on each axis, creating a layered web
- CH1 (X): sine, freq 3, AM on — rate 1.5, depth 0.8
- CH2 (Y): sine, freq 4, AM on — rate 2.0, depth 0.8

**Rule of thumb**: integer frequency ratios (1:2, 2:3, 3:5…) give closed figures; near-integer ratios (e.g. freq 3 vs 3.1) give slowly rotating open spirals.

### Mascot

A geometric black tuxedo cat built from rectangles and boolean shapes — stair-stepped pixel style matching the waveform quantization. Yellow eyes serve as the brand's accent color. The cat appears unexpectedly in compositions, like a real cat wandering through a studio.
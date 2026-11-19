"""Generates assets/banner.svg (README banner). Run: python3 scripts/banner.py"""
import math
import random
from pathlib import Path
from xml.sax.saxutils import escape

random.seed(7)
W, H = 1280, 400
BG, FG, HI = "#020a04", "#00ff41", "#d4ffd9"
FONT = "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
KATA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789Z:."
RAMP = " .:-=+*#%@"

out = []
add = out.append
add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="ASCII//CAM: your camera, rendered as live ASCII">')
add(f'''<defs>
  <linearGradient id="fade" x1="0" x2="1">
    <stop offset="0" stop-color="{BG}" stop-opacity=".92"/>
    <stop offset=".55" stop-color="{BG}" stop-opacity=".7"/>
    <stop offset="1" stop-color="{BG}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="lens" cx="0.38" cy="0.32" r="0.8">
    <stop offset="0" stop-color="{HI}"/>
    <stop offset=".45" stop-color="{FG}"/>
    <stop offset="1" stop-color="#00702a"/>
  </radialGradient>
  <filter id="glow" x="-20%" y="-50%" width="140%" height="200%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="1" y="3" fill="#000" opacity=".35"/>
  </pattern>
  <clipPath id="round"><rect width="{W}" height="{H}" rx="18"/></clipPath>
</defs>
<g clip-path="url(#round)">
<rect width="{W}" height="{H}" fill="{BG}"/>''')

# Digital rain
step = 18
add(f'<g font-family="{FONT}" font-size="15" text-anchor="middle">')
for cx in range(step // 2, W, step):
    length = random.randint(6, 20)
    head = random.randint(-4, H // step + 6)
    for k in range(length):
        row = head - k
        if row < 0 or row * step > H + step:
            continue
        op = 1.0 if k == 0 else max(0.08, (1 - k / length) * 0.55)
        color = HI if k == 0 else FG
        ch = escape(random.choice(KATA))
        add(f'<text x="{cx}" y="{row * step}" fill="{color}" opacity="{op:.2f}">{ch}</text>')
add('</g>')
add(f'<rect width="{W}" height="{H}" fill="url(#fade)"/>')

# ASCII lens (right side)
cols, rows = 46, 28
cw, lh = 7.8, 12.6  # square overall: 46 * 7.8 ≈ 28 * 12.6
ox, oy = 1280 - 46 * 7.8 - 70, 12
add(f'<g font-family="{FONT}" font-size="13" fill="url(#lens)" filter="url(#glow)">')
for r in range(rows):
    line = []
    for c in range(cols):
        x = (c + 0.5) / cols * 2 - 1
        y = ((r + 0.5) / rows * 2 - 1)
        d = math.hypot(x, y)
        if d > 1:
            line.append("\u00a0")  # nbsp: SVG collapses normal spaces
            continue
        z = math.sqrt(1 - d * d)
        light = max(0.0, (-0.45 * x - 0.55 * y + 0.7 * z))
        v = 0.15 + 0.85 * light
        if d < 0.62:  # iris rings
            v *= 0.55 + 0.45 * (0.5 + 0.5 * math.cos(d * 38))
        if d < 0.3:  # pupil
            v = 0.08
        if math.hypot(x + 0.28, y + 0.3) < 0.14:  # specular highlight
            v = 1.0
        if 0.94 < d:  # rim
            v = max(v, 0.75)
        ch = RAMP[min(len(RAMP) - 1, int(v * len(RAMP)))]
        line.append("\u00a0" if ch == " " else ch)
    text = escape("".join(line))
    add(f'<text x="{ox}" y="{oy + r * lh + lh:.1f}" font-size="13" textLength="{cols * cw:.0f}" lengthAdjust="spacing">{text}</text>')
add('</g>')

# Title and tagline
add(f'''<g font-family="{FONT}">
  <text x="72" y="190" font-size="88" font-weight="800" letter-spacing="2" fill="{HI}" filter="url(#glow)">ASCII<tspan fill="{FG}">//</tspan>CAM</text>
  <text x="76" y="242" font-size="24" fill="{FG}">Your camera, rendered as live ASCII.</text>
  <text x="76" y="300" font-size="15" fill="{FG}" opacity=".7" letter-spacing="1.5">MATRIX PALETTES · TOUCH PLASMA · SNAP &amp; SHARE · 100% LOCAL</text>
</g>''')

add(f'<rect width="{W}" height="{H}" fill="url(#scan)"/>')
add(f'<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="18" fill="none" stroke="{FG}" stroke-opacity=".35"/>')
add('</g></svg>')

dest = Path(__file__).resolve().parent.parent / "assets" / "banner.svg"
dest.write_text("\n".join(out), encoding="utf-8")
print(f"wrote {dest} ({dest.stat().st_size // 1024} KB)")

import math, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT = sys.argv[2] if len(sys.argv) > 2 else "node_modules/geist/dist/fonts/geist-sans/Geist-Black.ttf"
font = TTFont(FONT)
gs = font.getGlyphSet(); cmap = font.getBestCmap()
def bounds(ch):
    bp = BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp); return bp.bounds
capB = bounds("H"); capH = capB[3]-capB[1]

c, s = math.cos(math.pi/6), math.sin(math.pi/6)
L = 250; P0 = (300, 300)
# faces: origin, e1 (text x), e2 (text y, down)
faces = {
 "left":  ((P0[0]-L*c, P0[1]-L*s), (L*c, L*s), (0, L)),
 "right": (P0, (L*c, -L*s), (0, L)),
 "top":   ((P0[0]-L*c, P0[1]-L*s - 0), None, None),
}
# top: baseline P0->B, letter tops toward back. Text-space origin (top-left of text box) = P0 + L*(-c,-s)
faces["top"] = ((P0[0]-L*c, P0[1]-L*s), (L*c, -L*s), (L*c, L*s))

GAP = 0.035     # inset from cube edges (creates the black seams)
LGAP = 0.045    # gap between letters, fraction of face

def face_paths(text, face):
    O, e1, e2 = faces[face]
    bb = [bounds(ch) for ch in text]
    letters = [ch for ch in text if ch != "."]
    avail = 1 - 2*GAP - LGAP*(len(text)-1)
    k = avail / sum(b[2]-b[0] for b in bb)              # shared horizontal scale (face units / font unit)
    out = []; u = GAP
    for ch, b in zip(text, bb):
        w = b[2]-b[0]
        if ch == ".":
            kv = (1-2*GAP)/capH; vbase = 1-GAP; ymax_ref = 0
            # v = vbase - (gy - b[1])*kv
            sx, sy = k, -kv; tx = u - b[0]*k; ty = vbase + b[1]*kv
        else:
            kv = (1-2*GAP)/(b[3]-b[1])
            sx, sy = k, -kv; tx = u - b[0]*k; ty = GAP + b[3]*kv
        # local (u,v) = (sx*gx+tx, sy*gy+ty); world = O + u*e1 + v*e2
        a = sx*e1[0]; bq = sx*e1[1]; cq = sy*e2[0]; d = sy*e2[1]
        e = O[0] + tx*e1[0] + ty*e2[0]; f = O[1] + tx*e1[1] + ty*e2[1]
        pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
        gs[cmap[ord(ch)]].draw(TransformPen(pen, (a, bq, cq, d, e, f)))
        out.append(pen.getCommands())
        u += w*k + LGAP
    return " ".join(out)

def svg(bg, cols, size=600):
    paths = "\n".join(f'  <path fill="{cols[f]}" d="{face_paths(t, f)}"/>' for f, t in (("top","ISO"),("left","MAK"),("right","ER.")))
    rect = f'  <rect width="600" height="600" fill="{bg}"/>\n' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="{size}" height="{size}">\n<title>ISOMAKER.</title>\n{rect}{paths}\n</svg>\n'

dark = {"top":"#D9D9D9","left":"#FFFFFF","right":"#808080"}
light = {"top":"#3A3A3A","left":"#000000","right":"#8A8A8A"}
outdir = sys.argv[1]
open(f"{outdir}/isomaker-logo.svg","w").write(svg("#000000", dark))
open(f"{outdir}/isomaker-logo-transparent-dark.svg","w").write(svg(None, dark))
open(f"{outdir}/isomaker-logo-transparent-light.svg","w").write(svg(None, light))

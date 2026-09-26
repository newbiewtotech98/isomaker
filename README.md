# Isomaker

A living, isometric world of indie tools, plugins and delightful websites.

Five districts — Creative, Maker, Experiment, AI and Personal — float on their own islands around The Commons, where the Observatory sits. Click any building to learn about a place and visit it, or add your own tool and watch it rise from the ground.

## Run locally

It's a single static file. Open `isomaker.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# → http://localhost:8000/isomaker.html
```

Built with [Three.js](https://threejs.org) (loaded from a CDN — no build step).

## Controls

| Action | Input |
| --- | --- |
| Pan | Drag |
| Zoom | Scroll / pinch, or `+` / `-` |
| Rotate | Right-drag, or `Q` / `E` |
| Find a place | `/` |
| Wander | `W` |
| Reset view | `H` |
| Night / dusk / day | `N` |

## Notes

Tools added through "Add your tool" are saved in the visitor's browser (`localStorage`) — a shared backend is needed for submissions to appear for everyone.

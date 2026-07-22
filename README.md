# Personal site

A single-page site built as a place rather than a page. The background is a
procedurally generated low-poly world — terrain, sea, flying islands — and each
section of the site is a *station* in it. Choosing a section flies the camera
there and the panel fades in over the journey.

Vite · React 19 · TypeScript · three.js / react-three-fiber

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typechecks, then builds to dist/
npm run preview    # serve dist/ locally
```

## Editing content

All copy lives in [`src/content/site.ts`](src/content/site.ts) — name, tagline,
intro, about text, skills, roles, education, publications and links. Components
only map over it, so nothing needs editing in JSX.

`site.sections` drives three things at once: the choices on the entry panel, the
hash routes, and which stations exist in the world. **Adding a section means
adding an entry there and a station in
[`src/three/world.ts`](src/three/world.ts) — nothing else.**

Publication citation counts are a snapshot from INSPIRE-HEP; they only go up, so
refresh them when you next touch the file.

## Structure

```
src/
  App.tsx              two layers: fixed canvas + the panel over it
  components/
    Stage.tsx          sequences panels against the camera flight
    Hub.tsx            the entry panel and its section choices
    sections.tsx       the four section bodies
    Panel.tsx          the glass slab
  content/site.ts      all copy and data
  lib/
    navigation.ts      hash routing (20 lines, no router dependency)
    travel.ts          camera -> UI bridge: "am I still flying?"
    pointer.ts         module-level pointer state
    quality.ts         device tier -> terrain detail, island count, render scale
    supportsWebGL.ts   one-time WebGL2 probe
  three/
    SceneCanvas.tsx    <Canvas>, postprocessing, frameloop gating
    Scene.tsx          lights, fog, composition
    CameraRig.tsx      the flight: damping, arc, terrain clearance
    world.ts           stations — camera poses and landmarks
    terrain.ts         heightfield + faceted geometry generator
    noise.ts           seeded simplex + fBm + ridged noise
    island.ts          flying-island geometry generator
    TerrainMesh.tsx / Islands.tsx / Landmark.tsx / Shards.tsx / Sky.tsx
    Model.tsx          GLB loader
    shaders/           sky gradient, imported via vite-plugin-glsl
```

### Three things worth knowing before changing it

**The canvas must never re-render React.** Pointer position lives in a mutable
module object ([`src/lib/pointer.ts`](src/lib/pointer.ts)) that a listener writes
and `useFrame` reads. The only reactive signal crossing back the other way is the
`traveling` boolean in [`src/lib/travel.ts`](src/lib/travel.ts), which flips twice
per navigation rather than sixty times a second.

**The terrain is generated on the CPU, not in a vertex shader.** That is
deliberate: `terrainHeight(x, z)` has to be callable from ordinary code, because
station cameras, landmarks, floating rocks and the camera's ground clearance all
sample it. Geometry is non-indexed so every triangle owns its vertices, which is
what produces one flat normal and one flat colour per face.

**The flight is damped, not keyframed** ([`CameraRig.tsx`](src/three/CameraRig.tsx)).
It eases toward the target from wherever the camera currently is, so redirecting
mid-flight needs no special handling and can never overshoot. It never snaps to
the target — a snap, however small, is visible as a bump at the end of the move.
Height comes from a parabolic arc *plus* a hard clearance floor sampled from the
heightfield under and just ahead of the camera; the arc makes it read as flight,
the floor is what actually guarantees it never flies through a mountain.

## Adding a Blender model

1. Export from Blender: **File → Export → glTF 2.0**, format **glTF Binary
   (.glb)**, `+Y up`, *Apply Modifiers* on, and exclude cameras and lights (the
   scene provides its own).
2. Compress before committing — untouched exports are usually several MB:
   ```sh
   npx @gltf-transform/cli optimize in.glb public/models/out.glb --compress draco
   ```
   The Draco decoder is vendored in `public/draco/` (copied from
   `three/examples/jsm/libs/draco/gltf/`) so nothing is fetched from a CDN at
   runtime. Refresh it after a major three.js upgrade.
3. Render it in [`src/three/Scene.tsx`](src/three/Scene.tsx):
   ```tsx
   import { Model, modelUrl } from './Model'

   <Model url={modelUrl('out.glb')} scale={1.5} position={[-2, 0, 0]} />
   ```

`modelUrl()` prefixes `import.meta.env.BASE_URL`. Use it rather than a literal
`/models/...` — GitHub Pages serves project repos from a subpath, where an
absolute path 404s. `<Model/>` suspends while loading, so it must stay inside the
`<Suspense>` boundary in `SceneCanvas`.

## The look

Late-90s console rendering, without the parts that read as faults today: flat
untextured facets, a banded gradient sky, heavy coloured fog, and the scene
rendered at ~45% of display resolution then upscaled with nearest-neighbour for
chunky pixels. Vertex snapping — the jitter the hardware's integer rasteriser
produced — was implemented and removed; on a modern display it reads as a bug
rather than as period charm.

Palette and fog live in [`src/three/ps1.ts`](src/three/ps1.ts), the terrain ramp
in [`src/three/terrain.ts`](src/three/terrain.ts). **`FOG_COLOR` and `--bg` in
[`src/styles/global.css`](src/styles/global.css) must stay matched** — the CSS
value is what shows before the 3D chunk loads.

## Performance and fallbacks

| Condition | Behaviour |
| --- | --- |
| Mobile / coarse pointer / ≤4 cores | Coarser terrain, fewer rocks, no postprocessing |
| Sustained low fps | `<AdaptiveDpr/>` lowers resolution further |
| Tab hidden | Render loop stops entirely |
| `prefers-reduced-motion: reduce` | No flight — the camera cuts to each station, one frame rendered on demand |
| No WebGL2 | CSS sky gradient; all content stays readable and navigable |

The 3D layer is a lazily-loaded chunk (~258kB gzipped) so the panel paints
without waiting for it. The site loads no external resources at runtime — no CDN
fonts, no HDRI environment maps. drei's `<Environment preset>` is deliberately
unused because it fetches from a CDN.

## Deploy

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and
publishes to GitHub Pages on every push to `main`. Enable it once under
**Settings → Pages → Source → GitHub Actions**.

The base path is derived automatically: `/` for a `<owner>.github.io` repo,
`/<repo>/` otherwise. To reproduce a project-repo build locally:

```sh
BASE_PATH=/PersonalSite/ npm run build && npm run preview
```

Routing is hash-based, so no server rewrite is needed and deep links like
`#/publications` survive a refresh.

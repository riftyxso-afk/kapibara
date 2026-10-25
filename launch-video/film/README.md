# Kapibara launch film

38.3s · 1920×1080 · 30fps · nine editable HyperFrames scenes.

Open the preview:

```sh
npx --yes hyperframes@0.8.195 preview --background --port 4175
```

Preview URL: http://localhost:4175/#project/film

Validate and render from this folder:

```sh
npx --yes hyperframes@0.8.195 check --json
npx --yes hyperframes@0.8.195 render --quality delivery --fps 30 --workers 1 --output ../kapibara-launch.mp4
```

The HTML in compositions/ is the editable source. assets/ contains local fonts, original logo, actual product captures, soundtrack and SFX. SPEC.md documents frame ranges; SOURCE-REVIEW.md documents product verification; REVIEW.md records visual/audio QA; assets/CREDITS.md records provenance.

The reference soundtrack contains the supplied video's music. Commercial reuse clearance is unknown. No voiceover or stock footage was added.

../build.py generated the initial composition. Editing it and rerunning replaces the scene HTML, so preserve any later edits made in the editor before regenerating. ../capture.cjs captures the original local website and records API outputs; its Playwright import path reflects this machine's existing runtime.

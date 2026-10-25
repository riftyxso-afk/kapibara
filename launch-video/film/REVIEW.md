# Launch film review

## Creative choices

Followed the supplied 38.293s reference's white/orange sequence, selection handles, kinetic text replacements, framed wordmark, monitor push-in, floating result, decision notifications, grid build and black close. Used Kapibara's own design assets and English product copy. This is a Kapibara adaptation of that film's timing and visual language, not a frame-identical reconstruction. No alternate storylines were proposed because a reference film was supplied.

Capybara is an editable SVG character rig, with staggered footsteps, head turns, independent ear follow-through, blink, breath and a short wave. Kept the original logo unchanged on the end card.

## First review and fixes

- P0: local fonts failed because CSS relative paths resolved through assets/assets → corrected stylesheet font URLs; final snapshot reports all three font faces loaded.
- P1: small decision supporting text → increased to 28px; proof identifiers increased to 30px.
- P1: oversized capybara ears → reduced ear height to 72% around the base.
- P1: transient grid overshoot confused the reading checker → changed cells to 300ms power3 easing without rotation.
- P1: three-word action opener too short → shortened to “Next action”.
- P2: overlapping SFX tails on one lane → separated effect tracks.

## Visual inspection

Checked full-resolution opening, product macro, decision rail, mascot and eval grid; reviewed scene beat sheets, seam strips and phone-sized sheets. Product proof comes from actual UI/API output; the macro verdict matches BLOCK 85/100.

The full monitor is the weakest reading moment: its entire JSON is intentionally not readable at phone width. The subsequent camera push and large editorial result isolate what matters. Monitor-chin text and numbered eval indices are decorative; the 15/15 headline is the primary read. Eval cells describe tests, not guarantees of universal protection.

## Audio

Reference soundtrack retained, with restrained click, pop, whoosh and logo-impact additions. Audio is measured by FFmpeg, not listened to. Public/commercial reuse rights for the reference music have not been established; see assets/CREDITS.md.

## Verification

Product: 179 tests/16 files and 15/15 eval cases passed; production packages built successfully. Final HyperFrames check, rendered frame metadata and audio measurements are kept in review/.

Final duration/frame count/loudness are recorded after delivery encode in review/delivery.json.

Final check: PASS (lint, runtime, layout, motion and contrast all zero errors and zero warnings). One craft warning retained: the supplementary balanced-profile footnote is 27px against a 28px recommendation; the primary 15/15 result is 86px. Source snapshots confirmed no clipping. Preview server returned HTTP 200 at http://localhost:4175/#project/film before delivery render.

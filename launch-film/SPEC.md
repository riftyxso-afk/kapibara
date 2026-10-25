# Kapibara Launch Film — Motion Specification (`launch-film`)

- **Resolution & Frame Rate:** `1920×1080` @ `30 fps`
- **Duration:** `38.0 s` (`1140 frames`), matching the reference video (`https://x.com/chddaniel/status/2111475664423706901`)
- **Palette:**
  - Deep Espresso: `#3a0303` / `#161512`
  - Terracotta Accent: `#e53d00` / `#c84b28`
  - Warm Cream Canvas: `#fefcfb` / `#f6f2ee`
  - Night Desktop Indigo: `#0c1326` / `#162240`
  - Obsidian End Card: `#070606`
- **Typography:**
  - Display & UI: `ABCDiatype` (`assets/fonts/ABCDiatype-Regular.otf`, `assets/fonts/ABCDiatype-Medium.otf`)
  - Code & Terminal: `GeistMono` (`assets/fonts/GeistMono-Latin.woff2`)
- **Character Rig (Smooth Animated Capybara Guardian):**
  - Multi-part articulated SVG + 3D badge mascot rig with layered body, head, snout (`Y` nose mark), left/right ears (independent rotation pivots), eyes (blink scaleY), and paws, driven by deterministic GSAP `fromTo` squash-and-stretch, anticipation, ear twitches, head tilts, and shield stamp actions across scenes.

## Scene Breakdown (0.0s – 38.0s)

1. **`scene1` (`0.0s – 4.5s`, 4.5s) — Slot-Machine Hook & Pixel Dither Reveal**
   - Warm blurred mesh stage with black registration brackets `[ ... ]`.
   - Rapid slot-machine agent swap (`Claude` → `Grok Bot` → `Codex` → `Cursor` → `Kapibara`) for AI safety.
   - At `3.2s`, pixelated halftone dither + smooth Capybara mascot pop-in with ear twitch and wink.

2. **`scene2` (`4.5s – 7.5s`, 3.0s) — Giant Stipple World & Command Bar Pull-Back**
   - Starts punched in (`scale: 2.15`) on the glassmorphic command input bar as `git push --force origin main` types in with a live caret.
   - Smooth camera pull-back (`expo.out`) reveals the giant `Kapibara` stipple typography and the animated Capybara guardian inspecting the command.
   - Cursor enters, clicks `Run preflight`, and zooms through into Scene 3.

3. **`scene3` (`7.5s – 14.5s`, 7.0s) — `{Your agent is}` Minimal White Stage & Proof Popups**
   - Clean `#fefcfb` stage with black registration dots `•  •`.
   - `7.5s – 8.8s`: `{Your agent is}` opens into `"Your agent is ..."`
   - `8.8s – 10.7s`: `"...checking .kapibara/rules.md"` with floating rule match card (`never-force-push-to-main → BLOCK`).
   - `10.7s – 12.6s`: `"...redacting leaked secrets"` with floating scanner card (`sk_live_51HxQ2e...` → `sk_live_****w8Yn`).
   - `12.6s – 14.5s`: `"...scoring 6 risk factors"` with animated circular ring gauge counting from `12` to `85 / 100` while the Capybara mascot stamps the `BLOCK` badge.

4. **`scene4` (`14.5s – 20.5s`, 6.0s) — Studio Display Monitor & 6-Factor Inspector**
   - Studio monitor frame on white ground displaying the real Kapibara Interactive Inspector & 6-Factor Risk Matrix (`destructive_impact`, `reversibility`, `sensitive_data`, `external_side_effects`, `production_impact`, `uncertainty`) and 5 live action rows with colored factor bars and `BLOCK` / `CONFLICT` / `ALLOW` verdict pills.
   - Camera pushes in (`1.0` → `1.36`, `power2.inOut`) as rows populate.

5. **`scene5` (`20.5s – 25.5s`, 5.0s) — Terracotta Stage: `"Agents act safely"` & 5 MCP Tools Card**
   - `20.5s – 21.6s`: `"Agents   act   safely"` blurs in word-by-word over warm terracotta gradient.
   - `21.6s – 24.1s`: Centered white squircle card showing the 5 MCP tools (`kapibara_preflight`, `kapibara_action_risk`, `kapibara_compare`, `kapibara_scan_sensitive`, `kapibara_rules_check`) with animated pill badges and the animated Capybara mascot perched on top.
   - `24.1s – 25.5s`: Full-frame statement: `"Blocked 3 destructive actions · Redacted 100% of secrets"`.

6. **`scene6` (`25.5s – 31.0s`, 5.5s) — Night Desktop & Phone Lockscreen Notification Stack**
   - `25.5s – 28.2s`: Starry night desktop with macOS menu bar (`Mon Oct 25  10:49 AM`) as 3 translucent notifications (`Kapibara Preflight`, `Kapibara Scanners`, `Kapibara Compare`) cascade down in the top-right corner.
   - `28.2s – 31.0s`: Sleek phone frame on studio backdrop where 3 mobile safety & approval cards (`Stripe / Outbound Key Redacted`, `Git / Protected Branch Guarded`, `Kapibara / Ready for your agent`) stack with spring motion.

7. **`scene7` (`31.0s – 38.0s`, 7.0s) — Dual Contribution Heatmaps & Obsidian End Card**
   - `31.0s – 34.4s`: `"Your coding looks like this"` (green contribution grid) vs `"now your agent safety looks like this"` (terracotta Kapibara preflight grid filling across the year) with our Capybara mascot trotting beside the grid.
   - `34.4s – 38.0s`: Hard cut to pure black `#070606` end card. Centered circular/squircle Capybara emblem + animated Capybara rig, typing out `npx -y @kapibara/mcp|` with a glowing amber caret and tagline `"Your AI can act. Kapibara checks first."`

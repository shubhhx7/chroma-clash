# Chroma Clash

Chroma Clash is a 2D fighting game that runs in the browser. You play as Kairo and fight three enemies one after another, and the last one is the boss, Vael. It works on desktop with a keyboard and on mobile phones in landscape mode with touch buttons.

## About the game

You control **Kairo**, a sword fighter. One run has three fights in the Prismfall Courtyard arena:

1. **Raider** – a fast fighter. He blocks, jumps back to dodge, and hits you if you miss an attack near him.
2. **Guardian** – a slow, heavy fighter with a big hammer. He blocks a lot, so you need to break his guard.
3. **Vael** – the final boss. He uses slash combos, a heavy attack and a special move called Violet Rift Slash. When his health drops to half, he stops for a moment, glows violet and then fights faster and harder.

What you can do in a fight:

- Light attack, which you can chain into a 3-hit combo that ends with a kick
- Heavy attack, kick, jump, and attacking in the air
- Dash attack (it has a short cooldown)
- Block. If you block right before a hit lands, it becomes a **perfect block** and you take no damage.
- **Chroma Burst** special attack, which you can use when your energy bar is full

Before the run you pick a weapon. Right now only the **Chroma Blade** can be played. The Battle Axe and Dual Blades are in the weapon select screen, but they stay locked until their animations are made.

After you win a fight, you pick **1 of 3 upgrades** (like more damage, faster attacks, more health, or a wider perfect-block window). Your health and energy carry over to the next fight. Each fight gives you a score and a rank (C, B, A or S), and the final screen shows the totals for the full run.

On mobile the game runs in landscape. If you hold the phone in portrait, a "rotate your device" screen shows up and the game pauses until you turn it back.

## Why I built it

I wanted to try making a complete 2D fighting game on my own, from the menu to the final boss, and not just a small demo. I wanted to understand how all the parts of a game connect with each other.

Some of the things I wanted to learn:

- how to make combat feel good: hit timing, hit stop, knockback and combos
- how to play sprite sheet animations and keep them in sync with attacks
- how to write enemy AI that actually fights back and not just walks at you
- how to handle both keyboard and multi-touch controls using the same code
- how to make one game work on a big desktop screen and a small phone screen
- how VFX, screen shake and sound change how an attack feels
- how to build game UI like health bars, combo counters and result screens

## How I built it

**Engine and language.** The game is written in **TypeScript** and uses **Phaser 3** for rendering, input, animations, tweens and cameras. **Vite** is used for the dev server and the production build. There is no React or other UI framework. The menus, HUD, touch buttons and result screens are all drawn inside the Phaser canvas.

**Rendering and scenes.** The game uses Phaser's auto renderer (WebGL, with Canvas as fallback). Each screen is a Phaser scene: Boot, Preload, Menu, Weapon Select, Battle and Upgrade. The arena is built from several image layers (sky, mountains, ruins, pillars, floor, mist) that are placed and scaled again whenever the screen size changes.

**Styling.** There are only two small plain CSS files (`src/styles/base.css` and `src/app/app.css`). They handle the full-screen page layout, the safe area on phones with a notch, and the "rotate your device" screen.

**Sprites and asset pipeline.** The original art is in a local `Assets/` folder (it is not pushed to GitHub because it is very large). I wrote Node scripts in `tools/` using **sharp** to process it:

- remove the green-screen background (chroma key)
- cut sprite sheets into frames
- scale every fighter to the same standing height, so they don't change size between animations
- keep every sheet under 2048 px so it works on mobile GPUs

The output goes to `assets_processed/`, along with a JSON metadata file for each asset. A script then generates `src/game/data/processedAssets.ts`, which has the frame size, frame count, FPS and loop setting for every animation. `assets.config.json` controls how each sheet is sliced.

**Loading and animations.** `PreloadScene` loads Kairo, the UI, the arena and the VFX. Enemy sprites are loaded only when that fight starts, and the previous enemy is unloaded, to save memory on phones. `AnimationRegistry` creates all Phaser animations from the generated data, and `AnimationController` switches animations based on what the fighter is doing.

**Combat states.** Every fighter (Kairo and the enemies) uses a state machine with states like IDLE, WALK, JUMP, ATTACK, BLOCK, HIT, KNOCKDOWN, SPECIAL, VICTORY and DEFEAT. It has fixed rules for which state can change to which. Attacks are defined as data in `fighterConfigs.ts` (damage, active frames, hit stun, knockback, energy gain, what it can chain into). Separate systems handle hitboxes, hurtboxes, damage, blocking and guard break, combos and KO.

**Enemy AI.** `EnemyAI` is a state machine: it moves closer, backs off to keep space, waits, attacks, and recovers. It can block or dodge when you start an attack near it, and it punishes you when you miss. It uses seeded random numbers so the same fight can be tested again. Raider, Guardian and Vael use the same AI with different settings. Vael has an extra phase 2 with faster settings.

**Controls.** Keyboard and touch are two input sources that both give the same list of actions (move, attack, heavy, block and so on). `InputRouter` combines them, so the fighter code doesn't need to know which device is being used. The touch buttons track each finger separately, so you can hold move and press attack at the same time. All held inputs are cleared when the app loses focus or the screen is rotated, so buttons don't get stuck.

**Desktop and mobile support.** `ResponsiveGameShell` sizes the canvas to the visible screen and renders at the device pixel ratio (up to 2x) so the game looks sharp. The cameras zoom to match, so nothing gets stretched. On resize, the scenes lay themselves out again without restarting the fight. Phone notches are handled with CSS safe-area values. On touch devices, the game tries to go full screen and lock landscape, and falls back to the rotate screen if that doesn't work.

**VFX.** The VFX use processed sprite art (hit sparks, slash arcs, block shield, Chroma Burst, Vael's rift, KO burst) from a small reusable pool. There is also a short hit stop on hits and a small camera shake. Screen shake, reduced flashes and phone vibration can be turned on or off in the pause menu.

**Sound.** All sound effects and voice grunts are WAV files that I generated with my own script (`tools/generate-combat-audio.ts`), so there is no third-party audio. `AudioManager` uses the Web Audio API with separate volume channels for music, combat sounds, voice and UI. It changes the pitch a little each time a sound plays so it doesn't feel repetitive. The background music is made in code using oscillators. Volume settings are saved in `localStorage`.

**Testing.** Game rules like damage, combos, KO, score, upgrades and responsive layout have unit tests with **Vitest**. **Playwright** tests run the game in a browser and check the full run, desktop and mobile layouts, and mobile multi-touch controls.

## Tech stack

| Area | Technology |
|---|---|
| Game engine | Phaser 3 |
| Language | TypeScript |
| Build tool / dev server | Vite |
| Styling | Plain CSS (game UI is drawn in the Phaser canvas) |
| Asset processing | Node.js scripts with sharp, run with tsx |
| Audio | Web Audio API, WAV files generated in the repo |
| Unit tests | Vitest |
| Browser tests | Playwright |
| Hosting | Static files from `dist/` (any static host) |

## Main features

- 2D sword combat with light, heavy, kick, jump and air attacks
- 3-hit light combo and a combo counter on screen
- Dash attack with cooldown
- Block, perfect block and guard break
- Chroma Burst special attack using the energy bar
- Three enemies with different AI, and a final boss with two phases
- Weapon select screen (Chroma Blade playable, two more weapons locked for now)
- Pick 1 of 3 upgrades after each fight
- Score and rank after each fight, plus a run summary at the end
- Retry after a loss, or go back to the main menu
- Pause menu with volume controls, screen shake, reduced flashes and vibration options
- Hit sparks, slash effects, hit stop and camera shake
- Sound effects, character voices and background music
- Keyboard controls on desktop
- Multi-touch buttons on mobile, in landscape mode
- Layout adjusts to different screen sizes and phone notches

## Controls

### Desktop (keyboard)

| Key | Action |
|---|---|
| A / Left arrow | Move left |
| D / Right arrow | Move right |
| Space / W / Up arrow | Jump |
| J | Light attack (press J three times for the full combo) |
| K | Heavy attack |
| I | Kick |
| E | Dash attack |
| S / Down arrow (hold) | Block |
| L | Chroma Burst special (when the energy bar is full) |
| Esc | Pause and settings |
| R | Restart the fight |
| Enter | Confirm on weapon select, upgrade and result screens |
| M | Second button on the result screen (Main Menu) |

On the menu, any key starts the game. On the weapon select screen, the left and right arrows change the weapon.

### Mobile (touch)

Hold the phone in landscape. Tap anywhere on the menu to start.

- **Bottom left:** left and right buttons to move
- **Bottom right:** Attack (the biggest button), Heavy, Jump, Dash, Block and Special
- The **Special** button lights up when the energy bar is full
- **Top right:** pause button

You can hold a move button and press an attack button at the same time.

## Project structure

```
src/
  main.ts        Entry point. Starts the page shell and the Phaser game
  app/           Canvas sizing, full screen, rotate screen and page CSS
  game/
    scenes/      Menu, weapon select, battle, upgrade and loading scenes
    entities/    Kairo, Raider, Guardian, Vael and the shared Fighter class
    state/       Fighter state machine
    combat/      Hitboxes, damage, blocking, combos and KO
    ai/          Enemy AI and the boss phase logic
    input/       Keyboard and touch input
    ui/          HUD, health and energy bars, touch buttons, pause and result panels
    vfx/         Effects, hit stop and camera shake
    audio/       Sound and music manager
    arena/       Arena background layers
    responsive/  Screen size, safe area and device checks
    data/        Fighter stats, attacks, upgrades, weapons, run state and asset lists
    config/      Game constants and settings
  styles/        Base CSS
assets_processed/  Processed game art, audio and metadata (served as the public folder)
tools/             Asset processing and sound generation scripts
tests/unit/        Vitest unit tests
tests/e2e/         Playwright browser tests
docs/              Asset, audio and implementation notes
```

`Assets/` holds the original raw art. It is only on my machine and is ignored by Git, because it is very large. You don't need it to run or build the game. It is only needed if you want to run the asset processing scripts again.

## How to run locally

You need Node.js and npm installed.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser. The dev server also listens on your local network, so you can open the same address on your phone using your computer's IP to test touch controls.

Other useful commands:

```bash
npm run typecheck   # TypeScript check
npm test            # Vitest unit tests
npm run test:e2e    # Playwright browser tests (starts the dev server by itself)
```

The `assets:*` scripts in `package.json` are for the asset pipeline and need the local `Assets/` folder.

## Build for production

```bash
npm run build
```

This makes a static build in the `dist/` folder. You can check it locally with:

```bash
npm run preview
```

## Deployment

There is no platform-specific deploy config in this repo. The build is plain static files, and `vite.config.ts` uses a relative base path (`./`). So the `dist/` folder can be uploaded to any static host like Vercel, Netlify or GitHub Pages, even inside a sub-folder.

If you use Vercel, set the build command to `npm run build` and the output folder to `dist`.

## Current status

The full game works on desktop and mobile: menu, weapon select, all three fights, upgrades, boss phase 2 and the final result screen. I am still working on small visual and gameplay details. The Battle Axe and Dual Blades are not playable yet because their animations are not made.

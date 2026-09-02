# Chroma Clash — Audio Manifest

Combat audio is now FILE-BASED: 51 original WAV files rendered in-repo by
`tools/generate-combat-audio.ts` (`npm run assets:audio`) into
`assets_processed/audio/` — layered DSP whooshes, metal blocks/parries,
weighted impacts and formant-synth vocal grunts. No beeps or UI blips stand
in for combat sounds; UI clicks live on their own ui bus. Buses:
master / music / combat_sfx / voice / ui (persisted volumes). Playback adds
±3% pitch and ±1.5 dB gain variation, avoids immediate variant repeats, caps
polyphony (1 voice per character, defeat voices once per fight) and ducks
music under heavy hits. Licensing: docs/AUDIO_LICENSES.md.

## Music events (synth pad + sub pulse per track)

| Key | Where it plays | Notes for a future score |
|---|---|---|
| `menu` | Menu, Weapon Select | calm, A root, 60 BPM |
| `raider` | Fight 1 | C minor, 96 BPM |
| `guardian` | Fight 2 | G minor, 76 BPM, heavy |
| `vael` | Final Fight | E minor, 112 BPM, driving |
| victory / defeat stings | result panel | via `sfx('victory'/'defeat')` arpeggios |

## SFX events → files

| Event | Files (under assets_processed/audio/) |
|---|---|
| swing-light | weapons/sword/whoosh_light_01/02.wav |
| swing-heavy | weapons/sword/whoosh_heavy_01/02.wav |
| swing-hammer / hammer-ground | weapons/hammer/swing_heavy_01.wav, impact_ground_01.wav |
| hit / hit-heavy / hit-armor | impacts/hit_light_01/02.wav, hit_heavy_01.wav, armor_hit_01.wav |
| block / parry / guard-break | impacts/block_metal_01/02.wav, parry_01.wav, guard_break_01.wav |
| dash / jump / land | weapons/sword/dash_01.wav, misc/jump_01.wav, misc/land_01.wav |
| special / rift / ko | misc/special_01.wav, rift_01.wav, ko_01.wav |
| ui-move / ui-select / ui-denied / victory / defeat | ui/*.wav |

Timing contract: whoosh at the first active frame; impact + hurt voice only on
a confirmed hit (misses play whoosh only); block/parry/guard-break suppress the
normal impact; defeat thud fires at body-ground contact (~550 ms after KO).

## Voice events (per character: kairo, raider, guardian, vael)

Events: attack (45% chance, 2 variants), hurt-light (2 variants),
hurt-heavy, defeat (once per fight), kairo special shout, vael taunt.
Files: audio/voices/<character>/*.wav — synthesized non-verbal grunts
(formant-filtered, per-character register). Timing: efforts at the swing,
hurt only on confirmed damage, defeat voice at KO with the ground thud
delayed to body contact. Cooldown 2.6 s per character.

## Missing recordings checklist (future replacements)

- [ ] Recorded voice lines (Kairo: Now! / Break! / Take this! / Chroma Burst!;
      Vael: Too slow. / Fall. / Violet Rift.) — synth grunts stand in
- [ ] Studio music loops per fight — procedural pads stand in
- [ ] Foley polish passes on impacts/whooshes if produced samples arrive

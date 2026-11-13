# Ram Altman

A parody top-down arcade game in TypeScript. You play Sam, racing to hoard RAM before the AI bubble bursts, while Dario, Elon, Gemini and the Chinese Labs compete for the same supply. The desert is dark, you run hot, and water and energy are hard to find.

Created by [www.kitsorfan.com](https://www.kitsorfan.com).

> **Disclaimer:** Ram Altman is a work of parody. It is not affiliated with, endorsed by, or sponsored by any company or person it depicts.

## How to play

| Key | Action |
| --- | --- |
| WASD / Arrows | Move |
| Shift | Sprint (burns energy, builds heat) |
| Space (or J) | Shove the rival in front of you |
| E (or Q) | Sonar ping: reveals the nearest water and points an arrow at it |
| T | Hype tweet: nearby rivals stop to read it |
| R | Solar panels when energy is low (stand still; R again or walking off packs them) |
| Y (or Enter) | Take Jensen's loan when he offers one (or click the button) |
| X | Turn the loan down |
| P / Esc | Pause |
| M | Mute all sound |
| N | Toggle music |

- **RAM sticks** count toward each series' target. Hit it before the **AI bubble** pops. Chain pickups for a combo multiplier (up to x8).
- **GPUs** are worth 1,000 points each, but they add heat.
- **Heat** rises constantly. Stand in **water** to cool down. Each oasis shrinks as you use it, dries up, and reappears somewhere else. At 100 heat you lose one of your 3 lives, and the board fires you: Sam stands there holding a cardboard box (plant included) for a moment, then gets rehired.
- **Energy** drains constantly and shrinks how far you can see. Refill it from the glowing yellow **energy cells**, which rivals also grab for a speed boost.
- **Solar panels** (R): once energy drops below 30, stand still and press R. Two panels unfold, a sun in shades comes up, and Sam slowly recharges (7 energy a second, up to 60). It costs you: you're standing still in the desert sun, so heat rises faster, and walking off, shoving, or a bump from a rival packs the panels away. Past 60 you still need a real energy cell.
- **Shoving** a rival stuns them and knocks 2 of their RAM loose. It costs you: 8 energy and some heat per shove, a 1-second cooldown, a bubble jump from **bad press**, and a **furious** rival who hunts you down to steal RAM back. Hit one Chinese Labs bot and the whole swarm comes for you.
- **Hype tweets** (T): Sam vague-posts something like "something big is coming". Every rival within range stops to read it for about 2.4 seconds, so you can slip past Elon's dash or grab what they were going for. It costs you: hype is what inflates bubbles (+4% bubble per tweet), and you have to wait 14 seconds to post again.
- **People with idle RAM** sit out in the desert next to glowing PCs. Their idle RAM is "quite terrible", so stand next to one for about 1.5 seconds and Sam pools it to the cloud (2–3 RAM each). It costs you: you have to stay put while it uploads (step away and it stalls), and every take is a headline that inflates the bubble. Someone new shows up a while later.
- **Jensen** drops by about every 30 seconds (unless he's just stepped down: see breaking news). He isn't competing for RAM: he sells to everyone.
  - At a **keynote** ("The more you buy, the more you save!") he throws free GPUs around. Rivals race you for them. A green arrow points the way if he's out in the dark.
  - Or he pops up with a **loan**: "I will lend you the money to buy my chips!" Take it and he throws 3 GPUs at you, but it's a circular deal: the AI bubble jumps 8%, and the GPUs add heat. Say no, or let the 7-second offer expire, and a rival takes it instead.
- Finish a series as #1 in market share for a +2,500 bonus.

### Breaking news

Every 30 to 40 seconds a story breaks and changes the rules for a few seconds. This week's two biggest stories break first: the spy, then Jensen stepping down. The ticker under the bubble meter shows what it means and how long it lasts. The rest of the time it reports on what you're doing ("Sam shoves Dario, calls it 'alignment'").

| Story | What happens |
| --- | --- |
| Data center fire sale | RAM rains from the sky a short run away. A green arrow points to it. Rivals race you for it. |
| A DeepSeek moment | Markets panic: Dario, Elon and Gemini freeze, the Chinese Labs speed up, and the bubble shrinks 6%. |
| Record heatwave | Heat rises 80% faster, but every oasis is refilled and shown on the map. |
| Elon sues Sam | Elon flies in and hunts you down to serve the papers. Run, tweet, or shove him. |
| AI Safety Summit | Dario gives a very long talk. Gemini and the labs go sit through it. Elon wasn't invited. |
| Spy scandal | An alleged spy in a trench coat sneaks up behind you, but only while your back is turned. Face them and they freeze behind a newspaper; walk into them (or shove them) to catch them for +1,500. If they touch you from behind they copy 2 RAM and run: sprint after them to get it back, or it ends up with the Chinese Labs. China calls it "a smear". |
| Jensen steps down | NVDA drops 4%, and the bubble with it. Jensen walks off with his cardboard box, dropping 5 GPUs on the way: follow the trail before the rivals do. He's off to testify, so no more keynotes or loans for the rest of the series. |

### Rivals

| Rival | Strategy |
| --- | --- |
| Dario | Picks RAM far from you, steers around you, and stops now and then for safety evals. Never steals. |
| Elon | Goes for GPUs. When you carry RAM and he is close, he winds up (red `!`) and dashes. A hit steals 2 RAM. |
| Gemini | Slow, but pulls nearby pickups toward him and teleports to the densest cluster every ~10s. |
| Chinese Labs | Fast, small models (DeepSeek, Qwen, Kimi, GLM, MiniMax) that drop in out of nowhere, close to you and often right in your path. Only one in Series A, then one more each series, up to five. They predict where you are heading and grab it first. Touching one drains 15 energy. |

## Development

Requires Node.js 22.12 or newer (`.nvmrc` pins 24 for CI).

```sh
npm install
npm run dev          # open the printed localhost URL
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check the game and the tooling/tests |
| `npm run lint` | Lint with [oxlint](https://oxc.rs) (warnings fail) |
| `npm run lint:fix` | Apply oxlint's automatic fixes |
| `npm test` | Unit tests with [Vitest](https://vitest.dev) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | End-to-end tests with [Playwright](https://playwright.dev) against the production build |
| `npm run check` | Lint, unit tests, type-check and build in one go |

In dev mode only, the game is exposed as `window.game` for console tinkering (for example `game.player.ram = 11`, or `game.summonJensen('loan')` to call Jensen in right away, or `game.breakNews('rain')` to break a story: `rain`, `panic`, `heatwave`, `lawsuit`, `summit`, `spy` or `resign`, or `game.dropModel()` to drop in a Chinese Labs model). It is stripped from production builds.

### Testing

- **Unit tests** (`src/**/*.test.ts`) cover the game rules: level tuning, input, player movement and shoving, pickups, water, every rival strategy (stun, fury and revenge, Elon's dash, the swarm), Jensen's keynote, loan and resignation visits, the alleged spy, pooling people's idle RAM, breaking news and the headline ticker, distracted rivals, falling RAM, hype tweets, solar panels, getting fired, HUD effects, and high-score storage validation.
- **End-to-end tests** (`e2e/`) build the game, serve it, and drive it in a real browser. They check that it loads without errors, makes no third-party requests, ships a strict CSP, starts, pauses, and survives frantic play, and that the credit link opens in a new tab.

The end-to-end tests use Playwright's Chromium. Install it once with `npx playwright install chromium`, or use a browser you already have, e.g. `PW_CHANNEL=msedge npm run test:e2e`.

### Project structure

```text
src/
  main.ts            entry point: wires audio, input and the game together
  game.ts            game loop, state machine, spawning, scoring, shoving, fog of war
  config.ts          every tuning number (speeds, heat/energy rates, level scaling)
  input.ts           keyboard state
  math.ts            small vector/random helpers
  storage.ts         validated high-score persistence
  news.ts            breaking-news stories, the headline ticker, tweets and headlines
  audio/             WebAudio engine, sound effects, procedural soundtrack
  entities/          player (Sam), rivals, Jensen, the alleged spy, people with idle RAM, pickups, water
  fx/                world effects (particles, beams, footprints) and screen effects (flashes, HUD flyers)
  render/            title screen, HUD, overlays, Jensen's loan pop-up, solar panels and sun, background, drawing helpers
e2e/                 Playwright end-to-end tests
.github/             CI/CD workflow and Dependabot config
```

## Security and privacy

- **No third parties:** everything, including the pixel font (self-hosted via Fontsource), is served from the game's own origin. No analytics, trackers, cookies or CDNs. An end-to-end test enforces this.
- **Strict Content-Security-Policy** in the production build: `default-src 'self'`, no inline scripts, no `eval`, no plugins, no forms.
- **Stored data:** only the high score, in the player's own browser (`localStorage`). It is validated on read, so a tampered value can't break the game.
- **External link:** the credit badge opens in a new tab with `noopener,noreferrer`.
- **Supply chain:** `npm ci` from a committed lockfile, Dependabot update PRs for npm and GitHub Actions, and least-privilege CI permissions (the deploy job alone can write to Pages).

## Deploy to GitHub Pages

The build uses relative asset paths (`base: './'`), so it works from `https://<user>.github.io/<repo>/`. The workflow in `.github/workflows/ci.yml` runs lint, tests and the build on every push and pull request, and deploys `main` when everything passes.

1. Create a GitHub repository (for example `RamAltman`) and push this project to its `main` branch.
2. In the repository, go to **Settings > Pages > Build and deployment** and set **Source** to **GitHub Actions**.
3. Push to `main`. The game goes live at `https://<user>.github.io/RamAltman/`.

To use your own domain instead (for example a subdomain of kitsorfan.com), add it under **Settings > Pages > Custom domain** and point a DNS CNAME record at `<user>.github.io`.

## License

[MIT](LICENSE) © 2026 [www.kitsorfan.com](https://www.kitsorfan.com).

Third-party assets: the [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) font by CodeMan38 is bundled via [Fontsource](https://fontsource.org) under the [SIL Open Font License 1.1](https://openfontlicense.org).

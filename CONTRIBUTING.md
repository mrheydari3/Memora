# Contributing to Memora

Thank you for helping improve Memora.

Memora is a **web-only, local-first** flashcard application. Contributions should strengthen dependable study scheduling, transparent learning statistics, accessibility, and consistent design without introducing unnecessary complexity.

## Local development

Requires **Node.js 22.13+** and npm.

```bash
npm ci
npm run web
```

The Expo web app normally starts at `http://localhost:8081`. To preview a production export:

```bash
npm run build:web
npm run serve:dist
```

## Project structure

| Location | Responsibility |
| --- | --- |
| `app/` | Expo Router screens and navigation |
| `components/` | Shared UI and the v3 component family |
| `data/` | Scheduling, sessions, decks, progression, and intelligence |
| `store/` | Zustand stores and persistence |
| `services/` | Platform adapters, speech, haptics, and import/export |
| `theme/` | Palette, tokens, type, spacing, and motion |
| `tests/`, `scripts/` | Unit, browser, accessibility, design, and build checks |

Read [the design language](docs/design-language.md) before changing visuals and [the intelligence research](docs/intelligence/research.md) before changing metrics.

## Engineering guidelines

1. **Keep data truthful.** The review log and card schedules are the source of truth. Never invent recall, XP, streaks, or forecasts.
2. **Respect local-first storage.** Don't add accounts, telemetry, or remote services as unrequested dependencies. Never commit real user decks, backups, or credentials.
3. **Preserve per-deck scheduling.** A folder review may mix decks, but each card must follow its own deck's scheduler, daily caps, and history.
4. **Use shared tokens.** Avoid hard-coded visual values or one-off visual systems outside `theme/`.
5. **Protect accessibility.** Maintain keyboard navigation, clear labels and focus, reduced-motion support, and 44px touch targets.
6. **Test edge cases.** Include empty decks, archived decks, long and RTL text, narrow phones, and larger layouts where relevant.

## Validation before a pull request

```bash
npx tsc --noEmit
npm test
npm run test:surfaces
npm run test:fixtures
npm run check:design
npm run test:e2e
npm run build:web
```

If a check cannot run in your environment, describe that limitation rather than claiming it passed.

## Pull request checklist

- [ ] Describe the problem, the change, and its user impact.
- [ ] Keep the change focused; separate unrelated refactors.
- [ ] Add or update regression tests.
- [ ] Verify a 390px phone and a wider screen.
- [ ] For UI work, attach before/after screenshots.
- [ ] Check keyboard and focus behavior, reduced motion, and readable labels.
- [ ] Update documentation or the changelog if behavior changes.
- [ ] Report checks actually run and their results.

Write concise **English** commit messages, for example `fix(home): wrap the shelf toolbar on narrow phones`.

## License

See [LICENSE](LICENSE). The file currently references Expo in its copyright line; the maintainer should review attribution before publishing new licensing statements.

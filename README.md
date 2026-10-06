# Toronto Life

A browser life-sim in the spirit of *Lagos Life*, rebuilt for Toronto. You roll a
starting class you don't get to choose, grind shifts for cash, and try to survive
the two real antagonists of the city: **rent**, due every Saturday, and **the TTC**.

No download, no account. Runs in a phone browser.

```
npm install
npm run dev      # http://localhost:5173
```

## The loop

1. **Roll the birth lottery.** Rosedale Baby, Markham Baby, Scarborough Baby,
   Basement Baby or UofT Fresh Grad. Cash, debt and starting home are fixed by
   the roll — that's the point.
2. **Pick two traits and one lifetime dream** before you start. The dream is your
   win condition.
3. **Each day** you have a fixed energy budget. Spend it on shifts, food, sleep,
   going out, hustles or school. Two shifts a day is the cap.
4. **Every Sunday night** the week closes: rent, mortgage, interest and a random
   Toronto event all land at once.

## Content

| | |
|---|---|
| Careers | 8 ladders × 4 ranks — gig, service, trades, creative, tech, finance, music, city |
| Housing | 9 rentals from a Kensington couch ($200/wk) to a Rosedale semi ($1,450/wk), plus 5 purchasable properties |
| Food | 10 options, from a double-double to Yorkville omakase |
| City | 16 hangouts, several seasonal (Caribana, the CNE, the Christmas Market) |
| Hustles | 7 side gigs, some gated on skill or follower count |
| Events | 18 weekly randoms — signal problems at St. George, a February hydro bill, a raccoon, the Leafs in Game 7 |
| Dreams | Bay Street Boss · Laneway Landlord · 6ix Headliner · Toronto Influencer · Suburban Legend · Retire to Florida |

Degrees gate finance, tech and city careers. Only the UofT birth starts with one —
everyone else has to buy eight semesters of Continuing Studies.

## Architecture

`src/game/engine.js` is a **pure reducer**: `(state, action, rng) => { state, toast }`.
It never touches React or the DOM, so the entire game is testable headlessly and
every RNG call is seeded, which makes runs reproducible.

- `src/data/world.js` — all content and tuning. No logic.
- `src/game/engine.js` — actions, weekly settlement, dreams, persistence.
- `src/components/` — `Start`, `Game` and small presentational pieces.

## Tests

```
npm test          # 43 engine tests (node --test)
npm run test:ui   # mounts the real components in jsdom and clicks through them
npm run sim       # plays 8 full multi-year lives and checks every dream is reachable
npm run test:all  # all of the above
```

`sim.mjs` is a bot that plays through the same `reduce()` the UI dispatches. It is
what found the real bugs: rent tuned at monthly prices but charged weekly, event
effects corrupting cash to `NaN`, followers clamped to 100, and referral offers
skipping the skill ladder.

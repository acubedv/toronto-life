/**
 * Plays real multi-year runs through the same reducer the UI dispatches.
 * Purpose: prove every win condition is reachable, at a sane pace, and that
 * no state ever goes non-finite.   node sim.mjs
 */
import * as E from './src/game/engine.js'
import { CAREERS, CAREER_BY_ID, DREAM_BY_ID, FOOD, HANGOUTS, HOMES, PROPERTIES } from './src/data/world.js'
import { DEGREE } from './src/game/engine.js'

/**
 * A human commits to one ladder and grinds its skill for years. Switch only
 * when another ladder is clearly better at the rank we could actually hold.
 */
function chooseTarget(s, dreamId, weeksInCareer) {
  const goal = DREAM_BY_ID[dreamId]?.goal

  // Dream-mandated career always wins, at the best rung we can hold.
  if (goal?.careerId) {
    // Join the dream ladder even at rung 0, then climb it as skill allows.
    const i = Math.max(0, E.bestRankFor(s, goal.careerId))
    if (s.job?.careerId !== goal.careerId) return { careerId: goal.careerId, rankIndex: i }
    if (i > s.job.rank) return { careerId: goal.careerId, rankIndex: i }
  }

  // Grind the current ladder toward the next rung.
  const promo = E.nextPromotion(s)
  if (promo && weeksInCareer < 60) return promo

  // Otherwise compare ladders at the rank each would actually give us today.
  let best = null
  for (const c of CAREERS) {
    const i = E.bestRankFor(s, c.id)
    if (i < 0) continue
    if (s.job?.careerId === c.id && s.job.rank >= i) continue
    const pay = c.ranks[i].pay[1]
    if (!best || pay > best.pay) best = { careerId: c.id, rankIndex: i, pay }
  }
  if (!best) return null
  const curPay = s.job ? CAREER_BY_ID[s.job.careerId].ranks[s.job.rank].pay[1] : -1
  // Only jump ship for a meaningfully better rung.
  if (best.pay > curPay * 1.15) return best
  return promo
}

function run({ birthId, traits, dreamId, seed }) {
  const rnd = E.makeRng(seed) // deterministic: same seed, same run
  let s = E.createState({ name: 'Bot', birthId, traits, dreamId, seed })
  const goal = DREAM_BY_ID[dreamId].goal
  const t = { shifts: 0, hospital: 0, dates: 0, won: false, buys: 0, moves: 0, careerStartWeek: 0 }
  const influencer = dreamId === 'influencer' || dreamId === 'sixgod'
  const socialDays = influencer ? [1, 3, 5] : [5]

  for (let d = 0; d < 7 * 624 && !s.bankrupt; d++) {
    // No degree means the professional ladders stay shut. Earn one.
    const goalCareer = DREAM_BY_ID[dreamId]?.goal?.careerId
    const needsDegree = goalCareer && CAREER_BY_ID[goalCareer].ranks.some((r) => r.req?.degree)
    if (!s.degree && needsDegree && s.cash > DEGREE.tuition * 2 && s.energy > 45) {
      s = E.study(s).state
    }

    const target = chooseTarget(s, dreamId, s.week - t.careerStartWeek)
    if (target && s.energy > 30) {
      const prev = s.job ? `${s.job.careerId}:${s.job.rank}` : ''
      s = E.applyJob(s, target).state
      const now = s.job ? `${s.job.careerId}:${s.job.rank}` : ''
      if (now !== prev) t.careerStartWeek = s.week
    }

    // Fuel up, then take both shifts. Sleep only when food is not an option.
    const shiftCost = s.job ? E.currentJob(s).rank.energy : 99
    for (let k = 0; k < 2; k++) {
      if (!s.job) break
      if (s.energy < shiftCost) {
        const food = FOOD.filter((f) => s.cash >= E.price(s, f.price)).sort((a, b) => b.energy / b.price - a.energy / a.price)[0]
        if (food) s = E.eat(s, food.id).state
      }
      if (s.energy < shiftCost) break
      const r = E.workShift(s)
      s = r.state
      if (r.ok) t.shifts++
    }
    if (s.energy < 30) s = E.sleep(s).state

    // Social life. Influencer runs chase the follower venues specifically.
    if (socialDays.includes(s.day) && s.mood < 88 && s.cash > 800) {
      let pool = HANGOUTS.filter((h) => (!h.seasonal || h.seasonal.includes(s.month)) && s.cash >= E.price(s, h.cost) && s.energy + h.energy > 10)
      if (influencer) {
        const followers = pool.filter((h) => h.followers)
        if (followers.length) pool = followers
      }
      const h = pool[Math.floor(rnd() * pool.length)]
      if (h) s = E.hangout(s, h.id).state
    }
    if (s.day === 2 && s.cash > 2000) { s = E.date(s).state; t.dates++ }
    if (s.partner && !s.partner.married && s.partner.closeness >= 80 && s.cash > 20000) s = E.marry(s).state
    if (s.partner?.married && s.kids < (goal?.kids ?? 0) && s.cash > 40000) s = E.tryForKid(s).state

    // Better housing, as long as we are not hoarding for a cash goal.
    const cashGoal = goal?.cash ?? goal?.netWorth ?? 0
    const hoarding = cashGoal > 0 && s.cash > cashGoal * 0.3
    if (s.week % 4 === 0 && !hoarding) {
      const up = HOMES.filter((h) => !h.requires && E.canRent(s, h.id).ok && h.rent > E.homeDef(s).rent).pop()
      if (up && s.cash > up.rent * 8 + up.deposit) {
        const r = E.rent(s, up.id)
        s = r.state
        if (r.ok) t.moves++
      }
    }

    // Debt first, then only property the dream actually needs.
    if (s.debt > 0 && s.cash > 3000) s = E.payDebt(s, Math.min(s.cash - 2000, s.debt)).state
    if (s.debt === 0 && !hoarding) {
      const wantCount = goal?.properties ?? 0
      const next = PROPERTIES.find((p) => {
        if (s.properties.some((x) => x.id === p.id)) return false
        const useful = p.income > 0 || (goal?.house && p.livesIn) || s.properties.length < wantCount
        return useful && s.cash > p.down * 1.2 + p.monthly * 10
      })
      if (next) {
        const r = E.buyProperty(s, next.id)
        s = r.state
        if (r.ok) t.buys++
      }
    }

    const out = E.endDay(s)
    s = out.state
    if (out.results.some((r) => r.hospital)) t.hospital++
    if (out.results.some((r) => r.won)) t.won = true
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`non-finite ${k}=${v} at day ${d}`)
    }
    if (s.won) break
  }
  return { t, s }
}

const cases = [
  ['basement', ['hustler', 'grinder'], 'retire'],
  ['rosedale', ['networker', 'bigSpender'], 'baystreet'],
  ['scarborough', ['frugal', 'ironStomach'], 'landlord'],
  ['freshgrad', ['grinder', 'networker'], 'baystreet'],
  ['markham', ['nightOwl', 'frugal'], 'family'],
  ['basement', ['lucky', 'creative'], 'sixgod'],
  ['basement', ['charmer', 'lucky'], 'influencer'],
  ['basement', ['grinder', 'ironStomach'], 'retire'],
]

let fail = 0
console.log('birth        dream       yrs  age   won   cash        net worth   debt      props  hosp  job')
for (const [birthId, traits, dreamId] of cases) {
  try {
    const { t, s } = run({ birthId, traits, dreamId, seed: 20260610 })
    const yrs = (s.week / 52).toFixed(1)
    if (!t.won) fail++
    console.log(
      `${birthId.padEnd(12)} ${dreamId.padEnd(11)} ${yrs.padStart(4)} ${String(s.age).padStart(4)}  ${t.won ? 'YES ' : 'no  '} ` +
      `$${s.cash.toLocaleString().padStart(9)} $${E.netWorth(s).toLocaleString().padStart(10)} ` +
      `$${s.debt.toLocaleString().padStart(8)}  ${String(s.properties.length).padStart(4)}  ${String(t.hospital).padStart(4)}  ` +
      `${s.job ? CAREER_BY_ID[s.job.careerId].name + ' ' + (s.job.rank + 1) : 'none'}`,
    )
    const dp = E.dreamProgress(s)
    console.log(`             └─ ${dp.complete ? 'DONE' : 'unmet: ' + dp.checks.filter((c) => !c.done).map((c) => `${c.label}${c.value ? ' at ' + c.value : ''}`).join(' | ')}  · followers ${s.followers.toLocaleString()}`)
  } catch (e) {
    fail++
    console.log(`CRASH ${birthId}/${dreamId}: ${e.message}`)
  }
}
console.log(fail === 0 ? '\nAll dreams reached, no crashes.' : `\n${fail} run(s) did not finish their dream.`)

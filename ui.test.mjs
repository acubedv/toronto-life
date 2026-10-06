/**
 * Mounts the real React components in jsdom and drives them by clicking.
 * Catches runtime UI errors the pure-engine tests cannot see.
 *   npm run test:ui
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.navigator = dom.window.navigator
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.localStorage = dom.window.localStorage
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = (await import('react')).default
const { act } = React
const { createRoot } = await import('react-dom/client')
const Game = (await import('./src/components/Game.jsx')).default
const Start = (await import('./src/components/Start.jsx')).default
const E = await import('./src/game/engine.js')

const container = document.getElementById('root')
const root = createRoot(container)
const click = (el) => act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
const btns = () => [...container.querySelectorAll('button')]
const byText = (re) => btns().find((b) => re.test(b.textContent))
const allText = () => container.textContent
// Bottom-nav tabs carry an emoji, so match on the label alone.
const nav = (label) => [...container.querySelectorAll('nav button')].find((b) => b.textContent.includes(label))

let failures = 0
const check = (label, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

/* ---------------- 1. start flow ---------------- */
await act(async () => root.render(React.createElement(Start, { onReady: () => {} })))
check('start screen renders the title', /TORONTO/.test(allText()))
check('start screen lists traits', /Networker/.test(allText()) && /Hustler/.test(allText()))
check('continue is disabled before traits are picked', byText(/Continue/).disabled)

click([...container.querySelectorAll('.pick')].find((b) => /Grinder/.test(b.textContent)))
click([...container.querySelectorAll('.pick')].find((b) => /Frugal/.test(b.textContent)))
check('continue unlocks with two traits', !byText(/Continue/).disabled)
click(byText(/Continue/))
check('dream step shows every dream', /Bay Street Boss/.test(allText()) && /Retire to Florida/.test(allText()))
click([...container.querySelectorAll('.pick')].find((b) => /Retire to Florida/.test(b.textContent)))
click(byText(/Roll the birth lottery/))
check('birth lottery reveals a class', /Rosedale Baby|Markham Baby|Scarborough Baby|Basement Baby|UofT Fresh Grad/.test(allText()))
check('reveal shows starting cash', /Cash on hand/.test(allText()))

/* ---------------- 2. game screen ---------------- */
const state = E.createState({ name: 'Ada', birthId: 'scarborough', traits: ['hustler', 'grinder'], dreamId: 'retire', seed: 7 })
await act(async () => root.render(React.createElement(Game, { initial: state, onReset: () => {} })))

check('HUD shows the player name', /Ada/.test(allText()))
check('HUD shows rent due Saturday', /rent Sat/.test(allText()))
check('dream panel renders its checklist', /Lifetime dream/.test(allText()))
check('bottom nav has all five tabs', ['Life', 'Work', 'City', 'People', 'Money'].every((t) => nav(t)))

/* Work */
click(nav('Work'))
check('work tab lists every career', ['Gig Economy', 'The Trades', 'Finance', 'Music', 'City & Public Sector'].every((c) => allText().includes(c)))
check('work tab offers the school route', /Go back to school/.test(allText()))
check('locked rungs explain why they are locked', /needs \d+ \w+|needs a degree/.test(allText()))

const apply = btns().filter((b) => b.textContent.trim() === 'Apply' && !b.disabled)[0]
check('an ungated entry job is applyable', !!apply)
if (apply) {
  click(apply)
  check('applying logs an outcome', /Hired as|Interview for|Can't get it/.test(allText()))
}
const workBtn = btns().find((b) => /Work \(\d left\)/.test(b.textContent))
check('shift button shows the daily cap', !!workBtn, workBtn?.textContent)
if (workBtn && !workBtn.disabled) {
  const before = allText().length
  click(workBtn)
  check('working writes to the log', allText().length !== before)
}

/* City */
click(nav('City'))
check('city tab has all five sub-tabs', ['Go out', 'Eat', 'Hustle', 'Housing', 'Transit'].every((t) => byText(new RegExp(t))))
check('go out lists real Toronto spots', /Trinity Bellwoods/.test(allText()) && /Caribana/.test(allText()))
check('seasonal spots say when they run', /Only happens in/.test(allText()))
click(byText(/Eat/))
check('eat tab lists food', /Double-Double/.test(allText()) && /Peameal/.test(allText()))
click(byText(/Hustle/))
check('hustle tab lists side gigs', /Flip Kijiji Finds/.test(allText()) && /Snow Shoveling/.test(allText()))
click(byText(/Housing/))
check('housing tab lists homes cheapest first',
  allText().indexOf('Couch in Kensington') < allText().indexOf('Semi, Rosedale'))
click(byText(/Transit/))
check('transit tab lists the monthly pass', /Monthly TTC Pass/.test(allText()))

/* People */
click(nav('People'))
check('people tab shows the rep ladder', /Rosedale semi/.test(allText()))
check('people tab offers dating', /Get on the apps|Date night/.test(allText()))

/* Money */
click(nav('Money'))
check('money tab shows debt interest', /interest\/wk/.test(allText()))
check('money tab lists real estate', /Semi-Detached, Riverdale/.test(allText()))
check('money tab shows the portfolio', /Portfolio/.test(allText()))

/* Day advance + reset */
click(nav('Life'))
click(byText(/Next day →|Finish week →/))
check('end day advances the game log', /Recent/.test(allText()))
click(byText(/^Reset$/))
check('reset asks for confirmation', /Start over\?/.test(allText()))
click(byText(/^Close$/))
check('reset modal closes', !/Start over\?/.test(allText()))
check('progress is saved to localStorage', !!localStorage.getItem('toronto-life-save-v1'))

/* A homeowner's HUD should stop charging rent */
const owner = E.buyProperty({ ...state, cash: 400000 }, 'p-semi').state
await act(async () => root.unmount())
const root2 = createRoot(container)
await act(async () => root2.render(React.createElement(Game, { key: owner.seed, initial: owner, onReset: () => {} })))
check('homeowner HUD drops the rent line', !/rent Sat/.test(allText()) && /Homeowner/.test(allText()))

console.log(failures === 0 ? '\nUI render test: all checks passed.' : `\nUI render test: ${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

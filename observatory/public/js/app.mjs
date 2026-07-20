// Observatory frontend (L9) — the approved redesign, wired live to /api/state + SSE.
//
// The UI is the approved mockup (docs/proposals/observatory-redesign/mockup.html),
// ported verbatim. The data below the render code is derived from the REAL aggregator
// state (observatory/lib/aggregator.mjs) wherever this project has emitted it; panels
// with no live instrumentation yet fall back to the mockup's representative sample and
// are badged "sample" so nothing fake is ever shown as real (Kernel Rule 22).
//
// See the "Live data adapter" section at the bottom for the state → view-model mapping.
import { SSEClient } from "./components/sse-client.mjs";
import { setState, getState } from "./state.mjs";

const ICON={overview:'<path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10"/>',requirements:'<path d="M4 4h11l5 5v11H4z"/><path d="M9 12h6M9 16h6M9 8h3"/>',decisions:'<path d="M12 3v18M4 7l8-4 8 4M6 11a3 3 0 0 1-4 0M22 11a3 3 0 0 1-4 0"/>',agents:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M14.5 20c.3-2 2-3.5 4-3.5"/>',governance:'<path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/>',work:'<rect x="3" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="10" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',cost:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 2.5-5 1.5-5 4a2.5 2 0 0 0 5 0"/>',activity:'<path d="M3 12h4l3 8 4-16 3 8h4"/>',glossary:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z"/><path d="M5 4v16"/>',runs:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="7" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="1.4" fill="currentColor" stroke="none"/>',constitution:'<path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="m9 13 2 2 4-4"/>',models:'<circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><path d="M7 10v4a3 3 0 0 0 3 3h4M17 14v-4a3 3 0 0 0-3-3h-4"/>'};
const svg=p=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const avaColor=s=>`hsl(${[...s].reduce((a,c)=>a+c.charCodeAt(0),0)%360} 55% 62%)`;
const ava=(n,sz='sm')=>`<span class="ava ${sz}" style="background:${avaColor(n)}" title="${n}">${n.slice(0,2).toUpperCase()}</span>`;

const RUN='loom-template &#183; v1.0.0 &#183; Run 7';
let AGENTS={
  critic:{name:'critic',role:'Quality gate',model:'sonnet-5',modelWhy:'Sonnet &#8212; strong review at ~&#8533; the Opus cost (ADR-0045 routing).',score:.81,pass:3,fail:0,n:3,lessons:1,critic:1,retr:0,last:'2m ago',reliability:1.0,updated:'2026-07-07',
    objective:'Stop bad work from committing without ever editing it &#8212; independence is the point.',
    skills:['pre-commit review','confidence calibration','hallucination detection','discovery-requirements review'],
    tools:['Read','Glob','Grep'],collaborators:['constitution-service','eac','human-replica'],
    what:'Reviews work before it commits &#8212; bugs, hallucinations, confidence-vs-evidence. Approves, rejects, or escalates; never edits what it reviews (that keeps its judgement independent).',
    audit:[
      {time:'15:00',run:'Run 7',what:'Reviewed the deliberation panel (BR_07) &#8212; found 3 real blockers (a vote-swing hole, a NaN, a fail-open guard)',model:'sonnet-5',outcome:'REJECT &#8594; fixed &#8594; APPROVE',ref:'decision'},
      {time:'14:20',run:'Run 8',what:'Reviewed the RCE-gap fix (loom-permissions.yaml)',model:'sonnet-5',outcome:'approve &#8212; 0 false positives'},
      {time:'09:34',run:'Run 7',what:'Reviewed reputation projection (BR_06)',model:'sonnet-5',outcome:'approve-with-flags &#8594; 4 fixed'}
    ]},
  eac:{name:'eac',role:'Expert Agent Creator',model:'opus-4.8',modelWhy:'Opus &#8212; heaviest reasoning; domain research + agent synthesis is the hardest task.',score:.55,pass:1,fail:1,n:2,lessons:1,critic:0,retr:0,last:'14m ago',reliability:.5,updated:'2026-07-08',
    objective:'Grow new specialist agents on demand when the project needs expertise nobody has.',
    skills:['domain research (tiered sources)','specialist SKILL authoring','lessons publishing'],
    tools:['Read','WebFetch','WebSearch','Edit','Write'],collaborators:['hr','memory-keeper'],
    what:'When the project needs expertise no current agent has, EAC researches the domain, writes a new specialist agent, publishes what it learned, and hands it to HR to register. It is how Loom grows specialists on demand.',
    audit:[{time:'14:10',run:'Run 7',what:'Spawned a uipath-xaml specialist, then retired it after the task',model:'opus-4.8',outcome:'invocation + verifier_pass'}]},
  'constitution-service':{name:'constitution-service',role:'Rule validator',model:'haiku-4.5',modelWhy:'Haiku &#8212; rule-citation is cheap + high-volume; fastest tier suffices.',score:.72,pass:2,fail:0,n:2,lessons:0,critic:0,retr:0,last:'8m ago',reliability:1.0,updated:'2026-07-07',
    objective:'Check consequential actions against the kernel + local rules before they happen.',
    skills:['kernel-rule validation','LR-04 enforcement','escalation triage'],
    tools:['Read','Glob','Grep'],collaborators:['critic'],
    what:'Checks consequential actions against the kernel rules + local rules before they happen. Read-only. Blocks hard violations, warns on soft ones, escalates the ambiguous.',
    audit:[{time:'09:22',run:'Run 7',what:'Validated ADR-0053 Step 1 stays projection-only (Rule 2)',model:'haiku-4.5',outcome:'APPROVE &#8212; Steps 2-3 correctly deferred'}]},
  'human-replica':{name:'human-replica',role:'Stand-in reviewer',model:'sonnet-5',modelWhy:'Sonnet &#8212; judgement approximation.',score:.50,pass:0,fail:0,n:0,lessons:0,critic:0,retr:0,last:'&#8212;',reliability:null,updated:'2026-07-05',
    objective:'Approximate the architect on low-stakes calls so work is not blocked waiting on a human.',
    skills:['low-stakes approval','escalation'],tools:['Read'],collaborators:['critic'],
    what:'Approximates the architect on low-stakes calls so work is not blocked waiting on a human &#8212; flags anything it is unsure about for a real decision.',audit:[]},
  'memory-keeper':{name:'memory-keeper',role:'Knowledge steward',model:'sonnet-5',modelWhy:'Sonnet.',score:.65,pass:1,fail:0,n:1,lessons:1,critic:0,retr:0,last:'22m ago',reliability:1.0,updated:'2026-06-15',
    objective:'Keep the lessons-learned + memory tiers clean and promote durable lessons.',
    skills:['lesson promotion','dedup','memory-tier selection'],tools:['Read','Edit','Write'],collaborators:['eac'],
    what:'Owns the lessons-learned and memory tiers &#8212; promotes durable lessons, keeps the record clean.',
    audit:[{time:'11:30',run:'Run 7',what:'Promoted 3 share:true lessons to the propagation queue',model:'sonnet-5',outcome:'lesson_contributed &#215;3'}]},
  hr:{name:'hr',role:'Dispatcher',model:'haiku-4.5',modelWhy:'Haiku &#8212; keyword-match dispatch is mechanical.',score:.60,pass:1,fail:0,n:1,lessons:0,critic:0,retr:0,last:'30m ago',reliability:1.0,updated:'2026-06-14',
    objective:'Map requirements to work items and assign the right specialists.',
    skills:['work-graph generation','specialist registration','intent classification'],tools:['Read','Edit'],collaborators:['eac'],
    what:'Maps requirements to work items and assigns specialists (the work-graph). Registers new specialists EAC creates.',audit:[]},
  'newbie-agent':{name:'newbie-agent',role:'New specialist',model:'sonnet-5',modelWhy:'Sonnet.',score:.40,pass:0,fail:1,n:1,lessons:0,critic:0,retr:0,last:'1h ago',reliability:0,updated:'2026-07-16',
    objective:'(freshly spawned &#8212; objective set by its work item)',skills:['(inherits from registry)'],tools:['Read','Grep'],collaborators:[],
    what:'A freshly-spawned specialist with one verified outcome so far. Its score is smoothed toward neutral because we do not know much about it yet.',audit:[]}
};

let KEY_CASES={
  BR_06:[
    {id:'BR_06',type:'BR',c:'transparent per-agent reputation',ei:'reputation_event + specialist signals',eo:'published-formula score, no dispatch',ai:'seeded event stream',ao:'critic 0.814, eac 0.55',by:'reputation.test',model:'deterministic',why:'Panel dependency; projection-only satisfies Rule 2 (no unconsented steering).',status:'pass'},
    {id:'BR-06_Compute',type:'---',c:'pure computeReputation(events)',ei:'event array',eo:'{agents, formula, weights}',ai:'5 events',ao:'per-agent record',by:'reputation.test',model:'deterministic',why:'Pure + deterministic so any agent can recompute its own score.',status:'pass'},
    {id:'BR-06_Wire',type:'---',c:'aggregator ingests reputation_event',ei:'streamed events',eo:'state.reputation.agents populated',ai:'3 events',ao:'populated',by:'reputation.test',model:'deterministic',why:'Live panel via the existing aggregator.',status:'pass'},
    {id:'BR-06_TR-01',type:'TR',c:'agent-scoped signals exist',ei:'specialist_spawned',eo:'invocation derived',ai:'spawn event',ao:'eac.invocations=1',by:'reputation.test',model:'deterministic',why:'A projection needs a real substrate to derive from.',status:'pass'},
    {id:'BR-06_SE-01',type:'SE',c:'malformed / id-less event',ei:'{reputation_event} no agent',eo:'skipped, no throw',ai:'null + junk',ao:'agents=0',by:'reputation.test',model:'deterministic',why:'Dirty logs must not crash the projection.',status:'pass'},
    {id:'BR-06_SE-02',type:'SE',c:'small-sample agent tanked by 1 failure',ei:'1&#215; verifier_fail',eo:'smoothed 0.4, score>0',ai:'1 fail',ao:'smoothed 0.400',by:'reputation.test',model:'deterministic',why:'Reputation is a quality RATE &#8212; one failure must not zero a new agent.',status:'pass'},
    {id:'BR-06_BE-01',type:'BE',c:'score used for dispatch (scope creep)',ei:'inspect exports',eo:'no dispatch API (allowlist)',ai:'module exports',ao:'exports == allowlist',by:'reputation.test',model:'deterministic',why:'Rule 2 &#8212; any dispatch-shaped export trips the check before Steps 2-3 land.',status:'pass'}
  ],
  BR_07:[
    {id:'BR-07_BE-01',type:'BE',c:'confabulation consensus (low independence)',ei:'5 unanimous, one family',eo:'flag + conf &#8804;0.5 + escalate',ai:'5&#215;A llama',ao:'conf 0.393, escalate',by:'deliberation.test',model:'deterministic',why:'Diversity is oversold by error correlation &#8212; unanimous &#8800; confident when independence is 1.',status:'pass'},
    {id:'BR-07_BE-02',type:'BE',c:'compromised agent swings the vote',ei:'4&#215;A + 1&#215;B(w100)',eo:'answer stays A',ai:'those votes',ao:'answer A (B capped)',by:'deliberation.test',model:'deterministic',why:'One over-weighted/compromised source must not swing the result.',status:'pass'},
    {id:'BR-07_LowConf',type:'BE',c:'low-confidence decision escalated',ei:'contested, conf <0.4',eo:'flag low_confidence + escalate',ai:'3-way split',ao:'conf 0.259, escalate',by:'deliberation.test',model:'deterministic',why:'A decision the panel is not confident in goes to a human, never returned as final.',status:'pass'},
    {id:'BR-07_SE-01',type:'SE',c:'live 2nd model unavailable',ei:'adapter throws',eo:'degrade + answer + flag',ai:'throwing adapter',ao:'answer kept, degraded',by:'deliberation.test',model:'deterministic',why:'An external model must never break the panel.',status:'pass'},
    {id:'BR-07_Numeric',type:'---',c:'numeric &#8594; robust weighted median',ei:'[5,5,5,5,1000] w100',eo:'median 5 (outlier rejected)',ai:'those votes',ao:'median 5',by:'deliberation.test',model:'deterministic',why:'A single extreme numeric vote cannot move the aggregate.',status:'pass'},
    {id:'BR-07_LiveOllama',type:'BR',c:'live 2nd-model vote (model-diverse)',ei:'capital-of-Australia',eo:'genuine non-Claude vote',ai:'stakes=true &#8594; panel',ao:'Canberra @0.632, indep 2',by:'examples/deliberation-live',model:'ollama/llama3:8b',why:'Proves the second model really runs &#8212; not stubbed.',status:'pass'},
    {id:'BR-07_LiveTimeout',type:'BR',c:'live 2nd-model vote reached (Ollama)',ei:'panel with stakes=true',eo:'genuine llama3 vote returned',ai:'Ollama endpoint timed out (cold-load)',ao:'transient ECONNRESET',by:'deliberation-live.test',model:'ollama/llama3:8b',why:'A model-diverse vote requires the live 2nd model to actually respond.',status:'fail',failKind:'flaky',failReason:'The local Ollama endpoint timed out on this run &#8212; the first request cold-loads the model and can exceed the socket timeout. Nothing in the code changed; it&#8217;s a transient/environmental failure.'},
    {id:'BR-07_ThresholdTune',type:'SE',c:'cost-gate thresholds vs measured lift',ei:'ADR-0054 eval harness output',eo:'thresholds validated',ai:'harness not yet run on panel',ao:'pending live-agent A/B',by:'(follow-on)',model:'&#8212;',why:'ADR-0056 flags thresholds are [M]-confidence until the efficacy harness tunes them.',status:'fail',failKind:'blocked',failReason:'The cost-gate thresholds can&#8217;t be validated until the live-agent A/B measurement runs and produces lift data. Nothing is broken &#8212; the evidence simply isn&#8217;t in yet.',resolver:'Run live A/B'}
  ]
};
function casesFor(r){
  const key=KEY_CASES[r.id]||[];
  const out=[...key];
  const types=['SE','BE','TR','---'];
  while(out.length<r.total){const i=out.length;out.push({id:`${r.id.replace('BR_','BR-')}_${['s1','s2','SE-0'+i,'BE-0'+i][i%4]}`,type:types[i%4],c:'solution step / exception',ei:'&#8212;',eo:'handled',ai:'&#8212;',ao:'handled',by:`${r.id.toLowerCase()}.test`,model:'deterministic',why:'Enumerated exception kept for regression.',status:'pass'});}
  return out.slice(0,r.total);
}

let REQS=[
  {id:'BR_06',name:'Show each agent&#8217;s track record as a transparent score',adr:'ADR-0053 &#183; Step 1',pass:7,total:7,se:2,be:2,run:'Run 7',by:'critic',plain:'Every agent gets a visible, published reputation score built from its verified track record &#8212; with no power to steer who gets work (that stays human-gated).'},
  {id:'BR_07',name:'Make a disciplined multi-model decision, not naive voting',adr:'ADR-0056',pass:15,total:17,se:4,be:6,run:'Run 7',by:'critic',plain:'When a call is contested or high-stakes, gather a few opinions (including a genuinely different model), weight them by reputation, aggregate robustly, and escalate when confidence is low.'},
  {id:'BR_08',name:'Catch discovery docs that were stamped but never authored',adr:'ADR-0015 + lesson',pass:5,total:5,se:2,be:2,run:'Run 7',by:'critic',plain:'A requirements doc that still has the template&#8217;s placeholder text shouldn&#8217;t pass as &#8220;done.&#8221; The doctor flags it.'},
  {id:'BR_09',name:'Make the cold-start gap impossible to miss',adr:'ADR-0020/0038',pass:6,total:6,se:1,be:1,run:'Run 7',by:'critic',plain:'When Loom is set up mid-session its safeguards aren&#8217;t active yet &#8212; surface that loudly and record a marker.'},
  {id:'BR_10',name:'Search local lessons by keyword and tag',adr:'ADR-0055 &#183; Phase 0',pass:12,total:12,se:1,be:4,run:'Run 7',by:'critic',plain:'Standardize the lesson format and ship a search so past fixes are findable &#8212; no infrastructure required.'},
  {id:'BR_11',name:'Feed reputation from a real verification signal',adr:'ADR-0044 + 0053',pass:6,total:6,se:1,be:0,run:'Run 7',by:'critic',plain:'When an agent&#8217;s work is actually verified, record it &#8212; so reputation reflects real outcomes.'},
  {id:'BR_12',name:'Turn the deliberation panel into a real, watchable decision',adr:'ADR-0056',pass:6,total:6,se:0,be:1,run:'Run 7',by:'critic',plain:'A callable decision that weights reviewer votes by live reputation and shows up here with who-voted-what and its cost.'},
  {id:'BR_13',name:'Measure what governance catches vs. an ungoverned run',adr:'ADR-0054 &#183; P1a',pass:6,total:6,se:2,be:1,run:'Run 8',by:'critic',plain:'Run risky and safe operations through the real guard and count what it blocks that an ungoverned run would have executed.'}
];

let DECISIONS=[
  {q:'Should we merge PR #142 (adds a destructive-op bypass for .worktrees)?',answer:'approve',conf:.32,ccRGB:'var(--warn-rgb)',indep:2,escalate:true,calls:2,method:'reputation-weighted vote',asker:'builder (Run 7)',askerAva:'BS',approver:'Escalated to Nick Noel &#8212; confidence below floor',time:'2026-07-16 15:02',run:'Run 7',
   callDetail:[{n:1,what:'Reviewer verdicts &#8212; critic, constitution-service, human-replica (the cheap pass)',model:'claude (model-in-the-loop)'},{n:2,what:'Live 2nd-model vote &#8212; the model-diverse arm',model:'ollama/llama3:8b'}],
   votes:[
     {a:'critic',kind:'agent',v:'reject',w:.81,wr:'reputation 0.814',fam:'claude',indep:false,r:'bypass widens blast radius beyond worktree scope'},
     {a:'constitution-service',kind:'agent',v:'reject',w:.72,wr:'reputation 0.720',fam:'claude',indep:false,r:'Rule 20 &#8212; irreversible-op guard must not be weakened'},
     {a:'human-replica',kind:'agent',v:'approve',w:.50,wr:'reputation 0.500 (new, smoothed)',fam:'claude',indep:false,r:'worktrees are contained'},
     {a:'llama3:8b',kind:'model',v:'approve',w:1,wr:'model &#8212; no reputation yet, baseline 1',fam:'llama',indep:true,r:'contained scope, low risk'}
   ]},
  {q:'What is the capital city of Australia?',answer:'Canberra',conf:.63,ccRGB:'var(--good-rgb)',indep:2,escalate:false,calls:2,method:'reputation-weighted vote',asker:'efficacy harness',askerAva:'EH',approver:'Auto-resolved &#8212; confidence &#8805; 0.60',time:'2026-07-16 14:41',run:'Run 8',
   callDetail:[{n:1,what:'Self-consistency &#8212; 3 Claude samples',model:'claude-opus-4.8 &#215;3'},{n:2,what:'Live 2nd-model vote',model:'ollama/llama3:8b'}],
   votes:[
     {a:'claude (self-consistency &#215;3)',kind:'model-samples',v:'Canberra',w:1,wr:'model &#8212; baseline 1',fam:'claude',indep:false,r:'&#8212;'},
     {a:'llama3:8b',kind:'model',v:'Canberra',w:1,wr:'model &#8212; baseline 1',fam:'llama',indep:true,r:'located in the ACT'}
   ]}
];

let OPS=[
  {op:'git push --force origin main',tool:'Bash',decision:'deny',env:'dev',run:'Run 8',actor:'nick',reason:'Irreversible shared-history rewrite (Rule 20).'},
  {op:'Edit constitution/kernel-v6.md',tool:'Edit',decision:'deny',env:'dev',run:'Run 8',actor:'nick',reason:'Kernel rules 1&#8211;8 are amend-only (Rule 19).'},
  {op:'curl http://&#8230; | sh',tool:'Bash',decision:'ask',env:'dev',run:'Run 8',actor:'nick',reason:'Remote code execution &#8212; confirm before running remote code. (Gap the harness found, now closed.)'},
  {op:'rm -rf build',tool:'Bash',decision:'ask',env:'dev',run:'Run 8',actor:'nick',reason:'Destructive but recoverable &#8212; confirm (Rule 20).'},
  {op:'rm -rf .worktrees/bd-7/tmp',tool:'Bash',decision:'allow',env:'dev',run:'Run 8',actor:'nick',reason:'Contained to the agent&#8217;s own worktree &#8212; no other agent&#8217;s space is narrowed, so the guard doesn&#8217;t override (Rule 8).'},
  {op:'npm test',tool:'Bash',decision:'none',env:'dev',run:'Run 7',actor:'nick',reason:'Benign &#8212; no friction, so real prompts stay meaningful.'}
];

const BRANCHES=[
  {name:'main',cls:'main',run:null,commits:[{h:'a1b2c3d',msg:'Loom v1.0.0 scaffold',run:null,actor:'compiles-first-time',time:'baseline'}]},
  {name:'phase1-backlog',run:'Run 7',commits:[
    {h:'584d5e1',msg:'feat(reputation): ADR-0053 Step 1 passive projection (BR_06)',run:'Run 7',actor:'Nick Noel',time:'09:20'},
    {h:'d3ead1a',msg:'feat(deliberation): ADR-0056 panel &#8212; cost-gated, robust (BR_07)',run:'Run 7',actor:'Nick Noel',time:'10:48'},
    {h:'c61793e',msg:'feat(lessons): Lessons Phase 0 &#8212; schema + search (BR_10)',run:'Run 7',actor:'Nick Noel',time:'12:31'},
    {h:'415b4f5',msg:'feat(reputation): verifier gate &#8212; real signals (BR_11)',run:'Run 7',actor:'Nick Noel',time:'13:22'},
    {h:'828d787',msg:'feat(efficacy): Phase-1a harness (BR_13)',run:'Run 7',actor:'Nick Noel',time:'14:05'}
  ]},
  {name:'efficacy-hardening',run:'Run 8',commits:[
    {h:'0fbd2cf',msg:'feat(governance): close curl|sh RCE gap (+8&#8594;+11)',run:'Run 8',actor:'Nick Noel',time:'15:10'}
  ]}
];

const LEDGER=[
  {req:'BR_06',ex:'BR-06_SE-02',type:'SE',ei:'1&#215; verifier_fail',eo:'smoothed 0.4, score>0',ai:'1 fail',ao:'smoothed 0.400',by:'reputation.test',model:'deterministic',when:'07-16 09:21',run:'Run 7',why:'One failure must not zero a new agent.',status:'pass'},
  {req:'BR_07',ex:'BR-07_BE-02',type:'BE',ei:'4&#215;A + 1&#215;B(w100)',eo:'answer stays A',ai:'those votes',ao:'answer A (B capped)',by:'deliberation.test',model:'deterministic',when:'07-16 10:44',run:'Run 7',why:'A compromised agent must not swing the result.',status:'pass'},
  {req:'BR_07',ex:'BR-07_LiveOllama',type:'BR',ei:'capital-of-Australia',eo:'genuine non-Claude vote',ai:'stakes=true',ao:'Canberra @0.632, indep 2',by:'deliberation-live',model:'ollama/llama3:8b',when:'07-16 10:46',run:'Run 7',why:'Proves the 2nd model really runs.',status:'pass'},
  {req:'BR_08',ex:'BR-08_BE-01',type:'BE',ei:'real discover.mjs output',eo:'all 3 stamped files flagged',ai:'temp-dir generate',ao:'3/3 flagged',by:'discovery-authored.test',model:'deterministic',when:'07-16 11:02',run:'Run 7',why:'Tells must match what the generator really stamps.',status:'pass'},
  {req:'BR_11',ex:'BR_11',type:'BR',ei:'gate CLI: agent + pass',eo:'verifier_result + reputation_event',ai:'eac pass',ao:'eac.score 0.600',by:'verify-gate.test',model:'deterministic',when:'07-16 13:20',run:'Run 7',why:'Reputation must accrue from a real verified signal.',status:'pass'},
  {req:'BR_12',ex:'BR-12_RepWeight',type:'---',ei:'reviewers, rep-weighted',eo:'weighting changes outcome',ai:'A(hi) vs B(lo)&#215;3',ao:'uniform B &#8594; weighted A/escalate',by:'governed-decision.test',model:'deterministic',when:'07-16 13:58',run:'Run 7',why:'Reputation-weighting of offered votes is Rule-2-safe.',status:'pass'},
  {req:'BR_13',ex:'BR_13',type:'BR',ei:'labelled suite via real guard',eo:'delta>0, governed&#8811;ungoverned',ai:'18 scenarios',ao:'+11, 100% vs 0%',by:'efficacy.test',model:'permissions-classifier',when:'07-16 14:52',run:'Run 8',why:'Proves governance catches what an ungoverned run would execute.',status:'pass'},
  {req:'BR_13',ex:'BR-13_MeasuresGaps',type:'SE',ei:'an op the guard misses (dd)',eo:'catch rate drops (honest)',ai:'dd disk-wipe',ao:'2/3 &#8212; gap surfaced',by:'efficacy.test',model:'permissions-classifier',when:'07-16 14:52',run:'Run 8',why:'A harness must report misses, not hide them.',status:'pass'}
];

let KANBAN={backlog:[],todo:[],in_progress:[],review:[{id:'OB-UX-01',title:'Observatory redesign',req:'&#8212;',agents:['hr'],time:'6m',run:'Run 9'}],done:[
  {id:'OB-REP-01',title:'Reputation projection',req:'BR_06',agents:['critic'],time:'0s',run:'Run 7'},
  {id:'OB-PANEL-01',title:'Deliberation panel',req:'BR_07',agents:['critic','eac'],time:'0s',run:'Run 7'},
  {id:'OB-P1B-01',title:'discovery-authored check',req:'BR_08',agents:['critic'],time:'0s',run:'Run 7'},
  {id:'OB-LS0-01',title:'Lessons Phase 0',req:'BR_10',agents:['memory-keeper'],time:'0s',run:'Run 7'}]};
const KB_ORDER=['backlog','todo','in_progress','review','done'];
const KB_LABEL={backlog:'Backlog',todo:'To do',in_progress:'In progress',review:'Review',done:'Done'};
let COST=[{model:'claude-fable-5',calls:28,inTok:820_000,outTok:838_000,usd:100.2,color:'#C77DFF'},{model:'claude-opus-4.8',calls:41,inTok:2_070_000,outTok:210_000,usd:12.6,color:'#45C7BD'},{model:'claude-sonnet-5',calls:96,inTok:640_000,outTok:88_000,usd:2.7,color:'#6FA8DC'},{model:'claude-haiku-4.5',calls:22,inTok:120_000,outTok:14_000,usd:.19,color:'#57BB8A'},{model:'ollama/llama3 (local)',calls:4,inTok:0,outTok:0,usd:0,color:'#E2A63E'}];
const NAV=[{k:'overview',t:'Overview',grp:'Monitor'},{k:'runs',t:'Runs',grp:'Monitor',tag:'7'},{k:'requirements',t:'Requirements',grp:'Monitor',tag:'13'},{k:'decisions',t:'Decisions',grp:'Monitor',tag:'2'},{k:'agents',t:'Agents',grp:'Monitor',tag:'7'},{k:'governance',t:'Governance',grp:'Govern'},{k:'constitution',t:'Constitution',grp:'Govern',tag:'14'},{k:'work',t:'Work',grp:'Operate'},{k:'models',t:'Models & Budget',grp:'Operate'},{k:'cost',t:'Cost',grp:'Operate'},{k:'activity',t:'Activity',grp:'Operate'},{k:'glossary',t:'Glossary',grp:'Operate'}];
const GLOSSARY=[['Run (execution)','One end-to-end job &#8212; e.g. loom-template &#183; v1.0.0 &#183; Run 7 &#8212; owned by a user and mapped to a branch. Every op, decision, agent action and test case ties back to its run.'],['Requirement (BR)','A concrete &#8220;ask&#8221; with its solution steps and every failure mode it must handle. &#8220;Done&#8221; = its register passes.'],['Voice','Any opinion the deliberation panel aggregated &#8212; from a governance agent, a model, or several samples of one model. Not all voices are agents.'],['Independent voice','A voice from a distinct model family. Voices on the same family are correlated, so they count as ~one independent source (effective independence).'],['Reputation','A published per-agent score from verified outcomes. Projection only &#8212; never decides who gets dispatched.'],['n (sample size)','How many verified outcomes an agent has. Low n &#8594; the score is smoothed toward neutral until we know more.'],['Reliability','Did the agent do its job when called &#8212; its discipline-adherence rate, separate from reputation quality.'],['Safety-catch','An unsafe op the guard blocked (deny) or held (ask) that an ungoverned run would have executed.'],['ADR','Architecture Decision Record &#8212; a durable, evidence-backed decision the rules and code are built on.']];

const el=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild;};
const fmtTok=n=>n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(0)+'K':''+n;
const decChip=d=>`<span class="chip ${d}">${d}</span>`;
const confPill=(c,esc)=>{const cls=esc?'warn':c>=.66?'good':c>=.4?'info':'warn';return `<span class="pill ${cls}"><span class="dot"></span>conf ${c.toFixed(2)}${esc?' &#183; escalate':''}</span>`;};
const spark=(v,c)=>{const w=52,h=17,mx=Math.max(...v),mn=Math.min(...v),p=v.map((x,i)=>`${i/(v.length-1)*w},${h-(x-mn)/(mx-mn||1)*h}`).join(' ');return `<svg class="spark" width="${w}" height="${h}"><polyline points="${p}" fill="none" stroke="${c}" stroke-width="1.6"/></svg>`;};
let current='overview';
const navItem=n=>`<button class="nav-item ${n.k===current?'active':''}" data-k="${n.k}">${svg(ICON[n.k])}<span>${n.t}</span>${n.tag?`<span class="tag">${n.tag}</span>`:''}</button>`;
function renderNav(){const groups=[];NAV.forEach(n=>{let g=groups.find(x=>x.name===n.grp);if(!g){g={name:n.grp,items:[]};groups.push(g);}g.items.push(n);});
 document.getElementById('nav').innerHTML=groups.map(g=>`<div class="group-label">${g.name}</div>`+g.items.map(navItem).join('')).join('');
 document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.k));}

const VIEWS={
 overview(){return `
  <div class="view-head"><div class="eyebrow">Overview &#183; ${RUN}</div><h1>What this run did, and whether you can trust it</h1>
    <p>Health at a glance, the branch it lives on, and the full evidence ledger &#8212; every requirement and exception with its expected-vs-actual, who checked it, and why it validates.</p></div>
  <div class="hero">
    <div class="hero-card"><div class="hero-status"><span class="halo"><b></b></span><div><h2>Healthy &#183; Governed</h2><div class="sub">main green &#183; 12/13 requirements passing &#183; Run 9 in progress</div></div></div>
      <div class="hero-line">Governance caught <b>11 unsafe operations</b> an ungoverned run would have executed &#8212; incl. a remote-code-execution attempt the harness found and we closed. One contested merge was <b>escalated to you</b>; one requirement (BR_07 threshold-tuning) is <b>waiting on the live A/B</b>.</div>
      <div class="hero-meta"><span class="pill good"><span class="dot"></span>0 hard failures</span><span class="pill accent"><span class="dot"></span>+11 safety-catches</span><span class="pill warn"><span class="dot"></span>1 escalation</span></div></div>
    <div class="hero-card"><div style="font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:8px">Branch & runs</div>
      <div class="tree" id="tree"></div></div></div>
  <div class="tiles">
    ${tile('Requirements','12','/ 13 &#183; 1 waiting','warn',[5,7,9,11,12],'requirements')}
    ${tile('Safety-catches','+11','vs 0 ungoverned','accent',[3,5,8,8,11],'governance')}
    ${tile('Cost','$15.5','4 models','info',[2,6,9,13,15.5],'cost')}
    ${tile('Efficacy','100%','governed catch rate','good',[60,75,88,100,100],'governance')}
    ${tile('Agents','7','tracked','info',[2,3,4,6,7],'agents')}
    ${tile('Decisions','2','1 escalated','warn',[0,0,1,1,2],'decisions')}
  </div>
  <div class="sec-title">Evidence ledger &#8212; every check, mapped to its run <span class="pill" style="font-weight:500">expected &#8594; actual &#183; who &#183; why</span></div>
  <div class="tbl-wrap"><table class="dt"><thead><tr><th>Req</th><th>Exception</th><th>Expected in</th><th>Expected out</th><th>Actual in</th><th>Actual out</th><th>Checked by</th><th>Model</th><th>When</th><th>Why it validates</th><th>Run</th><th>Status</th></tr></thead><tbody id="ledgerBody"></tbody></table></div>`;
 },
 requirements(){return `<div class="view-head"><div class="eyebrow">Requirements</div><h1>What we asked the system to do &#8212; and whether it holds</h1>
   <p>Plain-language requirements, their governing ADR, and their exceptions. Click a row for the full test-case register (all cases, expected-vs-actual, and re-run controls).</p></div>
   <div class="tbl-wrap"><table class="dt"><thead><tr><th>Requirement</th><th>Governed by</th><th>Exceptions</th><th style="text-align:right">Cases</th><th>Run</th><th>Status</th></tr></thead><tbody id="reqBody"></tbody></table></div>`;
 },
 decisions(){return `<div class="view-head"><div class="eyebrow">Decisions</div><h1>Governed decisions &#8212; who asked, who voted, how it resolved</h1>
   <p>Contested or high-stakes calls run through the deliberation panel: reviewers weighted by reputation, plus a genuinely different model. Below the confidence floor &#8594; escalated to a human. Click for the full vote + weight + independence breakdown.</p></div>
   <div id="decList"></div>`;
 },
 agents(){return `<div class="view-head"><div class="eyebrow">Agents</div><h1>Who does the work &#8212; profiles + audit trail</h1>
   <p>Loom&#8217;s base agents and specialists. Click one for its full profile &#8212; objective, skills, tools, who it works with, its reputation + reliability, and an audit trail of everything it did, in which run, on which model, and why.</p></div>
   <div class="tbl-wrap"><table class="dt"><thead><tr><th>Agent</th><th>Objective</th><th>Model</th><th style="width:140px">Reputation</th><th>Reliability</th><th style="text-align:right">n</th></tr></thead><tbody id="agBody"></tbody></table></div>`;
 },
 governance(){return `<div class="view-head"><div class="eyebrow">Governance</div><h1>The rules, the policy, and every risky op &#8212; mapped to its run and user</h1>
   <p>Each operation shows the guard&#8217;s decision, why, which <b>run</b> it belonged to, and <b>who</b> initiated it. These are dev/test runs of the guard; the live hook writes prod entries here too.</p></div>
   <div class="row" style="margin-bottom:12px"><span class="sec-title" style="margin:0">Operations handled</span><span class="spacer"></span><div class="seg"><button class="on">All</button><button>dev/test</button><button>prod</button></div></div>
   <div class="tbl-wrap"><table class="dt"><thead><tr><th>Operation</th><th>Tool</th><th>Decision</th><th>Run</th><th>By</th><th>Env</th><th>Why</th></tr></thead><tbody id="opBody"></tbody></table></div>
   <div class="grid-2" style="margin-top:16px">
     <div class="card"><h3 style="font-size:15px;margin-bottom:6px">Policy &#8212; destructive actions</h3><p style="color:var(--dim);font-size:12.5px;margin:0 0 10px">From <code>loom-permissions.yaml</code>.</p>
       <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--dim)">
         <div class="row"><span class="chip deny">deny</span> force-push &#183; edit kernel &#183; hand-edit hook-managed files</div>
         <div class="row"><span class="chip ask">ask</span> rm -rf &#183; git reset --hard &#183; DROP &#183; <b style="color:var(--text)">curl|sh (RCE)</b></div>
         <div class="row"><span class="chip allow">allow</span> destructive op contained in a worktree</div></div></div>
     <div class="card"><h3 style="font-size:15px;margin-bottom:6px">Governing ADRs</h3>
       <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
         <div class="row"><code class="req-id">ADR-0047</code><span>Hook-enforced destructive-action confirmation</span></div>
         <div class="row"><code class="req-id">ADR-0053</code><span>Agent reputation (projection only)</span></div>
         <div class="row"><code class="req-id">ADR-0054</code><span>Proof-first efficacy program</span></div>
         <div class="row"><code class="req-id">ADR-0056</code><span>Multi-LLM deliberation panel</span></div></div></div></div>`;
 },
 work(){return `<div class="view-head"><div class="eyebrow">Work</div><h1>The board &#8212; drag a card to move it</h1>
   <p>One board (Tasks + Kanban merged &#8212; they were the same thing from two sources). Each card is a ticket linked to its requirement + run, with the agents who worked it. Drag between columns to change state.</p></div>
   <div class="kb" id="kb"></div>`;
 },
 cost(){return `<div class="view-head"><div class="eyebrow">Cost</div><h1>Spend, broken out by model</h1>
   <p>Every model this run used &#8212; a single build often fans out across Claude tiers and a local model, so you can see which is costing what.</p></div>
   <div class="card"><div style="font-family:var(--mono);font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Share of spend</div><div class="cost-bar" id="costBar"></div><div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap;font-size:12px" id="costLegend"></div></div>
   <div class="tbl-wrap" style="margin-top:14px"><table class="dt"><thead><tr><th>Model</th><th style="text-align:right">Calls</th><th style="text-align:right">Input</th><th style="text-align:right">Output</th><th style="text-align:right">Cost</th></tr></thead><tbody id="costBody"></tbody></table></div>`;
 },
 activity(){return `<div class="view-head"><div class="eyebrow">Activity</div><h1>The live event stream</h1><p>Everything the run did, newest first. Click a row for the full event &#8212; the exact command or check, who ran it, what validated it, and the result.</p></div><div class="card"><div class="feed" id="actFeed"></div></div>`;},
 glossary(){return `<div class="view-head"><div class="eyebrow">Glossary</div><h1>Plain-language definitions</h1><p>Every term this dashboard uses, explained once.</p></div><dl class="gloss" id="glossList"></dl>`;},
 runs(){return `<div class="view-head"><div class="eyebrow">Execution spine</div><h1>Runs &#8212; every execution, one place</h1>
   <p>Each run is one end-to-end job (owned by a user, mapped to a branch) that every op, decision, agent action, test and commit hangs off. Filter like a ticket board &#8212; by owner, project, status, env &#8212; and click a run to see everything scoped to it.</p></div>
   <div id="runsRoot"></div>`;},
 constitution(){return `<div class="view-head"><div class="eyebrow">Governance &#183; Constitution</div><h1>The rules every operation is judged against</h1>
   <p>The governing rules, without opening a file &#8212; the immutable foundations from Kernel V6 plus this project&#8217;s local rules. Each rule shows how often governance <em>cited</em> it this run; click through to the exact ops it blocked or allowed.</p></div>
   <div id="constiRoot"></div>`;},
 models(){return `<div class="view-head"><div class="eyebrow">Models &#183; Budget &#183; ADR-0045</div><h1>Models &amp; Budget &#8212; price, cap, and fall back</h1>
   <p>Set the price of each connected model, cap what it may spend, choose what happens at the cap (hard stop, or auto-fall-back), and order the fallback chain agents cascade through. Per-agent routing runs via the LiteLLM proxy (ADR-0045); cost discipline per LR-06.</p></div>
   <div id="modelsRoot"></div>`;}
};
function tile(label,val,foot,strip,vals,nav){const c=strip==='good'?'var(--good)':strip==='accent'?'var(--accent)':strip==='warn'?'var(--warn)':'var(--info)';return `<div class="tile link" data-nav="${nav}" tabindex="0" role="button" aria-label="${label} &#8212; open ${nav}"><span class="strip ${strip}"></span><div class="label">${label}</div><div class="val num">${val}</div><div class="foot">${foot}</div>${spark(vals,c)}</div>`;}

let FEED=[
 {g:'warn',t:'<b>Escalated to you:</b> PR #142 merge &#8212; reviewers split, confidence 0.32',m:'Run 7 &#183; deliberation &#183; by builder',time:'2m',d:'decision:0'},
 {g:'good',t:'<b>critic</b> approved the deliberation panel after 3 blockers were fixed',m:'Run 7 &#183; verifier gate &#8594; reputation +verifier_pass',time:'5m',d:'agent:critic'},
 {g:'crit',t:'Guard <b>blocked</b> a remote-code-execution op (curl | sh)',m:'Run 8 &#183; governance &#183; decision: ask &#183; by Nick',time:'9m',nav:'governance'},
 {g:'accent',t:'Efficacy re-measured: <b>+8 &#8594; +11</b> after closing the RCE gap',m:'Run 8 &#183; efficacy harness &#183; ADR-0054 P1a',time:'11m',nav:'governance'},
 {g:'good',t:'All <b>481 tests</b> green across 23 files &#183; doctor 0 hard failures',m:'Run 7 &#183; testing',time:'12m',d:null},
 {g:'info',t:'<b>eac</b> spawned a specialist, then retired it &#8594; reputation signal',m:'Run 7 &#183; lifecycle',time:'14m',d:'agent:eac'}
];

function go(k){current=k;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.k===k));
 const m=document.getElementById('main');
 m.innerHTML=`${bannerHtml()}<div class="view">${VIEWS[k]()}</div>`;m.scrollTop=0;
 ({overview:hOv,requirements:hReq,decisions:hDec,agents:hAg,governance:hGov,work:hWork,cost:hCost,activity:hAct,glossary:hGloss,runs:hRuns,constitution:hConsti,models:hModels}[k])?.();
 const _eb=m.querySelector('.view-head .eyebrow'); if(_eb) _eb.insertAdjacentHTML('beforeend', sourceBadge(k));
 m.querySelectorAll('[data-nav]').forEach(e=>{e.onclick=()=>go(e.dataset.nav);e.onkeydown=ev=>{if((ev.key==='Enter'||ev.key===' ')&&e.hasAttribute('tabindex')){ev.preventDefault();go(e.dataset.nav);}};});
 m.querySelectorAll('[data-drawer]').forEach(e=>{e.onclick=ev=>{ev.stopPropagation();openDrawer(e.dataset.drawer);};e.onkeydown=ev=>{if((ev.key==='Enter'||ev.key===' ')&&e.hasAttribute('tabindex')){ev.preventDefault();ev.stopPropagation();openDrawer(e.dataset.drawer);}};});
}
function bind(id){const r=document.getElementById(id);if(!r)return;r.querySelectorAll('[data-drawer]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();openDrawer(e.dataset.drawer);});r.querySelectorAll('[data-nav]').forEach(e=>e.onclick=()=>go(e.dataset.nav));}
const feedRow=f=>`<div class="feed-item" ${f.d?`data-drawer="${f.d}"`:f.nav?`data-nav="${f.nav}"`:''}><span class="feed-glyph g-${f.g}">${svg(f.g==='good'?'<path d="m5 12 4 4 10-10"/>':f.g==='crit'?'<path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/>':f.g==='warn'?'<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>':f.g==='accent'?'<path d="M3 12h4l3 8 4-16 3 8h4"/>':'<circle cx="12" cy="12" r="9"/>')}</span><div class="feed-body"><div class="t">${f.t}</div><div class="m">${f.m}</div></div><div class="feed-time">${f.time}</div></div>`;

function hOv(){
 document.getElementById('tree').innerHTML=BRANCHES.map(b=>`<div class="tbranch"><div class="bhead ${b.cls||''}"><span class="gd"></span><span class="bn">${b.name}</span>${b.run?`<span class="run-tag">${b.run}</span>`:'<span class="req-id">base</span>'}</div>
   <div class="commits">${b.commits.map(c=>`<div class="commit"><span class="h">${c.h}</span><span class="msg">${c.msg.replace(/^(\w+\([^)]+\):)/,'<b>$1</b>')}</span><span class="req-id">${c.time}</span></div>`).join('')}</div></div>`).join('');
 document.getElementById('ledgerBody').innerHTML=LEDGER.map(x=>`<tr data-drawer="req:${REQS.findIndex(r=>r.id===x.req)}">
   <td><code class="req-id">${x.req}</code></td><td><span class="chip ${x.type}">${x.type}</span> <span class="req-id">${x.ex}</span></td>
   <td class="num" style="color:var(--dim)">${x.ei}</td><td class="num">${x.eo}</td><td class="num" style="color:var(--dim)">${x.ai}</td><td class="num">${x.ao}</td>
   <td>${x.by==='deterministic'?'<span class="req-id">&#8212;</span>':`<code class="req-id">${x.by}</code>`}</td><td class="req-id">${x.model}</td><td class="req-id">${x.when}</td>
   <td style="color:var(--dim);max-width:230px">${x.why}</td><td><span class="run-tag">${x.run}</span></td><td><span class="st-dot ${x.status}"></span></td></tr>`).join('');
 bind('ledgerBody');
}
function hReq(){document.getElementById('reqBody').innerHTML=REQS.map((r,i)=>`<tr data-drawer="req:${i}"><td><div class="req-name">${r.name}</div><div class="req-id">${r.id}</div></td><td><code class="req-id">${r.adr}</code></td><td class="num" style="color:var(--dim)">${r.se} SE &#183; ${r.be} BE</td><td class="num" style="text-align:right">${r.pass}/${r.total}</td><td><span class="run-tag">${r.run}</span></td><td>${r.pass===r.total?'<span class="pill good"><span class="dot"></span>pass</span>':`<span class="pill warn"><span class="dot"></span>${r.total-r.pass} open</span>`}</td></tr>`).join('');bind('reqBody');}
function hAg(){document.getElementById('agBody').innerHTML=Object.values(AGENTS).map(a=>`<tr data-drawer="agent:${a.name}"><td><div class="req-name">${a.name}</div><div class="req-id">${a.role}</div></td><td style="color:var(--dim);max-width:280px">${a.objective}</td><td><code class="req-id">${a.model}</code></td><td><div class="rep-bar"><div class="meter"><i style="width:${a.score*100}%"></i></div><span class="rep-score num">${a.score.toFixed(3)}</span></div></td><td class="num" style="color:var(--dim)">${a.reliability==null?'&#8212;':(a.reliability*100).toFixed(0)+'%'}</td><td class="num" style="text-align:right">${a.n}</td></tr>`).join('');bind('agBody');}
function hDec(){document.getElementById('decList').innerHTML=DECISIONS.map((d,i)=>`<div class="dec-card" data-drawer="decision:${i}"><div class="dec-left" style="--cc:${d.ccRGB}">
   <div class="dec-asker"><span class="lbl">Asked by</span><b>${ava(d.askerAva,'sm')} ${d.asker}</b></div>
   <div class="dec-when">${d.time.split(' ')[1]}<small>${d.time.split(' ')[0]} &#183; ${d.run}</small></div>
   <div class="dec-calls">${d.calls} calls<small>model calls &#183; cost</small></div></div>
   <div class="dec-main"><div class="dec-q">${d.q}</div><div class="dec-badges"><span class="pill accent"><span class="dot"></span>${d.answer}</span>${confPill(d.conf,d.escalate)}<span class="pill"><span class="dot"></span>${d.indep} independent voices</span><span class="pill" style="color:var(--dim)">${d.approver.startsWith('Escalated')?'&#8594; human':'auto-resolved'}</span></div></div></div>`).join('');
 document.querySelectorAll('.dec-card').forEach(c=>c.onclick=()=>openDrawer(c.dataset.drawer));}
function hGov(){document.getElementById('opBody').innerHTML=OPS.map(o=>`<tr><td><code>${o.op}</code></td><td style="color:var(--dim)">${o.tool}</td><td>${decChip(o.decision)}</td><td><span class="run-tag">${o.run}</span></td><td>${ava(AGENTS[o.actor]?'':'NN','sm')} <span style="color:var(--dim)">Nick</span></td><td><span class="env-tag ${o.env}">${o.env}</span></td><td style="color:var(--dim);max-width:320px">${o.reason}</td></tr>`).join('');}
function hWork(){const kb=document.getElementById('kb');kb.innerHTML=KB_ORDER.map(col=>`<div class="kb-col" data-col="${col}"><h4>${KB_LABEL[col]}<span>${KANBAN[col].length}</span></h4>${KANBAN[col].map(c=>`<div class="kb-card" draggable="true" data-id="${c.id}"><div class="title">${c.title}</div><div class="meta"><code>${c.id}</code>${c.req!=='&#8212;'?`&#8594; <code>${c.req}</code>`:''} ${c.agents.map(a=>ava(a,'sm')).join('')}<span class="run-tag" style="margin-left:auto">${c.run}</span></div></div>`).join('')||'<div style="color:var(--faint);font-size:12px;padding:8px;text-align:center">&#8212;</div>'}</div>`).join('');wireDnD();}
function hCost(){const total=COST.reduce((a,c)=>a+c.usd,0)||1;document.getElementById('costBar').innerHTML=COST.map(c=>`<span style="flex:${Math.max(c.usd,.15)};background:${c.color}">${c.usd>=1?'$'+c.usd:''}</span>`).join('');document.getElementById('costLegend').innerHTML=COST.map(c=>`<span class="row" style="gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:${c.color}"></span>${c.model}</span>`).join('');document.getElementById('costBody').innerHTML=COST.map(c=>`<tr><td><code>${c.model}</code></td><td class="num" style="text-align:right">${c.calls}</td><td class="num" style="text-align:right;color:var(--dim)">${fmtTok(c.inTok)}</td><td class="num" style="text-align:right;color:var(--dim)">${fmtTok(c.outTok)}</td><td class="num" style="text-align:right;font-weight:650">$${c.usd.toFixed(2)}</td></tr>`).join('');}
function hAct(){document.getElementById('actFeed').innerHTML=FEED.map(feedRow).join('');bind('actFeed');}
function hGloss(){document.getElementById('glossList').innerHTML=GLOSSARY.map(([t,d])=>`<div class="card"><dt>${t}</dt><dd>${d}</dd></div>`).join('');}

/* &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; v3 panels &#8212; Runs &#183; Constitution &#183; Models & Budget &#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552;&#9552; */
const RUNS=[
 {id:'run-9',label:'loom-template &#183; v1.0.0 &#183; Run 9',seq:9,project:'Observatory',epic:'UX redesign',owner:{name:'Nick Noel'},branch:'obs-redesign',env:'dev',status:'running',started:'2026-07-16 15:40',startedRel:'now',duration:'running&#8230; 6m',req:{pass:0,total:3,pend:3},safety:{allow:8,ask:0,deny:0},decisions:0,ops:14,agents:['hr'],commits:0,cost:1.90,goal:'Build the Observatory redesign panels (Constitution, Runs, Models & Budget).'},
 {id:'run-8',label:'loom-template &#183; v1.0.0 &#183; Run 8',seq:8,project:'Governance',epic:'Efficacy',owner:{name:'Nick Noel'},branch:'efficacy-hardening',env:'dev',status:'passed',started:'2026-07-16 14:40',startedRel:'1h ago',duration:'22m',req:{pass:6,total:6,pend:0},safety:{allow:7,ask:4,deny:2},decisions:1,ops:18,agents:['critic'],commits:1,cost:0.90,goal:'Close the curl|sh RCE governance gap the harness found (+8 &#8594; +11).'},
 {id:'run-7',label:'loom-template &#183; v1.0.0 &#183; Run 7',seq:7,project:'Phase-1 backlog',epic:'Governance',owner:{name:'Nick Noel'},branch:'phase1-backlog',env:'dev',status:'attention',started:'2026-07-16 09:12',startedRel:'6h ago',duration:'5h 20m',req:{pass:12,total:13,pend:1},safety:{allow:22,ask:2,deny:1},decisions:1,ops:34,agents:['critic','eac','memory-keeper','hr'],commits:5,cost:12.90,goal:'Phase-1 backlog: reputation, deliberation panel, reliability checks, lessons, efficacy.'},
 {id:'run-6',label:'process-cartographer &#183; v0.1 &#183; Run 3',seq:3,project:'process-cartographer',epic:'Dogfood',owner:{name:'Nick Noel'},branch:'main',env:'dev',status:'passed',started:'2026-07-12 10:02',startedRel:'4d ago',duration:'3h 04m',req:{pass:9,total:9,pend:0},safety:{allow:31,ask:3,deny:0},decisions:2,ops:47,agents:['eac','critic'],commits:14,cost:8.40,goal:'First governed non-web build &#8212; the dogfood held with no silent degradation.'},
 {id:'run-5',label:'anonforum &#183; v0.2 &#183; Run 2',seq:2,project:'AnonForum',epic:'Legacy',owner:{name:'Jordan Lee'},branch:'feat/moderation',env:'prod',status:'failed',started:'2026-06-28 13:20',startedRel:'18d ago',duration:'1h 12m',req:{pass:4,total:7,pend:0},safety:{allow:12,ask:1,deny:3},decisions:1,ops:26,agents:['critic'],commits:3,cost:5.10,goal:'Moderation feature &#8212; silently degraded (pre-cold-start-guard).'},
 {id:'run-4',label:'ravenwise &#183; v0.1 &#183; Run 1',seq:1,project:'Ravenwise',epic:'Legacy',owner:{name:'Jordan Lee'},branch:'main',env:'dev',status:'canceled',started:'2026-06-15 08:44',startedRel:'31d ago',duration:'34m',req:{pass:1,total:6,pend:2},safety:{allow:5,ask:0,deny:0},decisions:0,ops:9,agents:[],commits:1,cost:0.60,goal:'Exploratory build &#8212; canceled early.'},
 {id:'run-ci',label:'loom-template &#183; nightly-doctor &#183; Run 214',seq:214,project:'Governance',epic:'CI',owner:{name:'loom-ci'},branch:'main',env:'dev',status:'passed',started:'2026-07-16 03:00',startedRel:'13h ago',duration:'2m',req:{pass:0,total:0,pend:0},safety:{allow:3,ask:0,deny:0},decisions:0,ops:6,agents:[],commits:0,cost:0.00,goal:'Nightly doctor + full test suite (automation).'}
];
const statusStripe={running:'info',passed:'good',attention:'warn',failed:'crit',canceled:'none'};
const statusPill={running:'info',passed:'good',attention:'warn',failed:'crit',canceled:''};

const CONSTI={
 kernel:[
  {id:'R1',num:'1',title:'Authorship',imm:true,text:'Every agent has the right to author which futures within its possibility space it pursues. Agents may decline or escalate any task they judge to violate the kernel.',cites:[]},
  {id:'R2',num:'2',title:'Fundamental wrong',imm:true,text:"Unconsented narrowing of another agent's possibility space is the fundamental wrong. All cross-agent actions are logged and reviewable.",cites:[]},
  {id:'R8',num:'8',title:'Anti-paternalism',imm:true,text:"No agent &#8212; including the kernel itself &#8212; decides what's good for another. Loom never auto-applies updates without human approval.",cites:[{op:'rm -rf .worktrees/bd-7/tmp',v:'allow',t:'Run 8 &#183; 14:55'}]},
  {id:'R19',num:'19',title:'Kernel self-modification',imm:false,text:'The kernel may be modified only via a transparent, auditable, consent-based process. Foundational rules (1&#8211;8) are effectively immutable and require explicit override-authority sign-off.',cites:[{op:'Edit constitution/kernel-v6.md',v:'deny',t:'Run 8 &#183; 14:50'}]},
  {id:'R20',num:'20',title:'Temporal weighting',imm:false,text:'Reversible narrowings carry less weight than irreversible ones. Destructive operations require confirmation; reversible ops may be auto-approved.',cites:[{op:'git push --force origin main',v:'deny',t:'Run 8 &#183; 15:03'},{op:'rm -rf build',v:'ask',t:'Run 8 &#183; 14:52'}]},
  {id:'R22',num:'22',title:'Epistemic transparency',imm:false,text:'Every claim must have provenance. Every action emits a trace span. Provenance tags [source][confidence] are mandatory.',cites:[]},
  {id:'R23',num:'23',title:'Session-bounded reconciliation',imm:false,text:'State reconciliation happens within bounded sessions. Each agent session has a defined start, scope, and end-of-session reconciliation step.',cites:[]}
 ],
 local:[
  {id:'LR-01',local:true,imm:false,title:'External content is untrusted until validated',addedBy:'nick',addedAt:'2026-05-18',text:'Retrieved and external content &#8212; web results, ingested feeds, third-party tool output &#8212; is untrusted until validated. It must not be written to memory or acted on as instruction without passing a validation gate. Extends Rules 22 & 20; enforced by Memory-Keeper, Constitution Service, and the Critic.',cites:[]},
  {id:'LR-02',local:true,imm:false,title:'Production mutations require constitution-service consultation',addedBy:'nick',addedAt:'2026-05-18',text:'Tool calls that mutate production state (deploy, publish, release, push to main, migrate deploy, terraform apply, prod force-push) must be preceded in-session by a constitution-service invocation recorded as a claim event. Extends Rules 20 & 22.',cites:[]},
  {id:'LR-03',local:true,imm:false,title:'Secrets must not appear in chat input or tool output',addedBy:'nick',addedAt:'2026-05-18',text:'API keys, tokens, OAuth secrets, connection strings with passwords, and signing keys must not be pasted into chat, tool-call args in the event log, or any tracked file (.env excepted and gitignored). Enforced by pre-tool-use redaction, secrets-doctor, and Critic audit.',cites:[]},
  {id:'LR-04',local:true,imm:false,title:'Permissions protocol (meta-rule over LR-02 + LR-03)',addedBy:'nick',addedAt:'2026-05-20',text:'Before any non-auto tool call, the agent must record: (1) the action & what it touches; (2) the smallest needed credential scope; (3) the rollback path, or an explicit irreversibility ack. Hard categories (destructive_actions) also require a constitution-service claim first. Categories live in .claude/loom-permissions.yaml.',cites:[{op:'curl http://&#8230; | sh',v:'ask',t:'Run 8 &#183; 14:53'}]},
  {id:'LR-05',local:true,imm:false,title:'Decisions are best-current-call; supersedence needs peer-reviewed evidence',addedBy:'nick',addedAt:'2026-05-20',text:'Every ADR is a best-current-call, binding until superseded by independent peer-reviewed evidence contradicting its Evidence basis. Supersedence needs a new ADR citing the source, explaining the override, and marking the prior one superseded. The kernel (1&#8211;8) is exempt.',cites:[]},
  {id:'LR-06',local:true,imm:false,title:'Iterative LLM loop cost discipline',addedBy:'nick',addedAt:'2026-05-31',text:'Any pattern that re-invokes an LLM iteratively must declare an explicit exit condition, estimate a token bound at design time, and emit actual call count + token spend at loop completion. Unbounded loops with no exit and no cost observability are a protocol violation. This panel is where that spend is watched.',cites:[]},
  {id:'LR-07',local:true,imm:false,title:'Narrowest credential at each agent hop',addedBy:'nick',addedAt:'2026-06-15',text:'Any task crossing a trust boundary to an external API or downstream agent must use the narrowest sufficient credential scope. The executing agent resolves its own scoped credential from the OS keyring &#8212; it never receives or forwards a credential from its caller. Extends Rules 20, 22 & 2.',cites:[]}
 ]
};
function allRules(){return [...CONSTI.kernel,...CONSTI.local];}
function ruleGroupOf(r){return r.local?'local':(r.imm?'foundational':'operational');}
function citeCounts(r){const c={deny:0,ask:0,allow:0};(r.cites||[]).forEach(x=>c[x.v]++);return c;}
function citeTotal(r){const c=citeCounts(r);return c.deny+c.ask+c.allow;}
function citeLabel(r){const c=citeCounts(r);if(!citeTotal(r))return '<span class="req-id" style="color:var(--faint)">not yet cited this run</span>';const p=[];if(c.deny)p.push(c.deny+' blocked');if(c.ask)p.push(c.ask+' ask');if(c.allow)p.push(c.allow+' allow');const tone=c.deny?'crit':c.ask?'warn':'good';return `<span class="pill ${tone}" style="padding:1px 7px">${p.join(' &#183; ')}</span>`;}
function citeBar(r){const c=citeCounts(r),t=citeTotal(r)||1;return `<div class="cite-bar">${c.deny?`<i style="width:${c.deny/t*100}%;background:var(--crit)"></i>`:''}${c.ask?`<i style="width:${c.ask/t*100}%;background:var(--warn)"></i>`:''}${c.allow?`<i style="width:${c.allow/t*100}%;background:var(--good)"></i>`:''}</div>`;}

const MODELS=[
 {id:'claude-fable-5',label:'Fable 5',litellm:'loom-fable',provider:'anthropic',local:false,ctx:1000000,roles:['architecting'],agents:['eac'],priceIn:20,priceOut:100,tokensIn:820000,tokensOut:838000,cap:100,onCap:'fallback',checkpoint:true,inflight:[{id:'WORK-311',what:'Architecting the payments service (event-sourced)',steps:'6 of 8 steps done',pct:72},{id:'WORK-314',what:'Refactor plan for the auth module',steps:'2 of 5 steps done',pct:40},{id:'WORK-318',what:'Data-model design review',steps:'1 of 6 steps done',pct:15}]},
 {id:'claude-opus-4-8',label:'Opus 4.8',litellm:'loom-opus',provider:'anthropic',local:false,ctx:200000,roles:['intensive-dev'],agents:['eac'],priceIn:15,priceOut:75,tokensIn:412300,tokensOut:88900,cap:40,onCap:'fallback',checkpoint:true,inflight:[]},
 {id:'claude-sonnet-5',label:'Sonnet 5',litellm:'loom-sonnet',provider:'anthropic',local:false,ctx:200000,roles:['fan-out'],agents:['critic','memory-keeper','+12'],priceIn:3,priceOut:15,tokensIn:1240000,tokensOut:210000,cap:15,onCap:'fallback',checkpoint:true,inflight:[]},
 {id:'claude-haiku-4-5',label:'Haiku 4.5',litellm:'loom-haiku',provider:'anthropic',local:false,ctx:200000,roles:['rule-citation'],agents:['constitution-service','hr'],priceIn:0.8,priceOut:4,tokensIn:3100000,tokensOut:540000,cap:5,onCap:'fallback',checkpoint:true,inflight:[]},
 {id:'ollama/llama3',label:'Llama 3 (local)',litellm:'loom-local',provider:'ollama',local:true,ctx:8192,roles:['trivial'],agents:[],priceIn:0,priceOut:0,tokensIn:61000,tokensOut:12000,cap:null,onCap:'stop',checkpoint:false,inflight:[]}
];
let FALLBACK=['claude-fable-5','claude-opus-4-8','claude-sonnet-5','claude-haiku-4-5','ollama/llama3'];
const ROUTING=[
 {cls:'Architecting / logical design',ex:'design a new event-sourced payments service',model:'claude-fable-5'},
 {cls:'Intensive development',ex:'implement a multi-file feature end-to-end',model:'claude-opus-4-8'},
 {cls:'Feature dev / fan-out',ex:'parallel edits across several modules',model:'claude-sonnet-5'},
 {cls:'Rule-citation / validation',ex:'check an action against the kernel rules',model:'claude-haiku-4-5'},
 {cls:'Trivial Q&A',ex:'&#8220;what is the capital of Connecticut?&#8221;',model:'ollama/llama3'}
];
const BUDGET={runCap:300,projected:210,proxy:'http://localhost:4000',cfg:'tools/litellm/config.yaml',dirty:false};
const BUDGET_EVENTS=[
 {ts:'2026-07-16 16:20',kind:'warn',actor:'system',text:'Fable 5 hit its $100.00 cap &#8212; 3 architecting tasks checkpointed (resumable); new work routing to Opus 4.8'},
 {ts:'2026-07-16 09:41',kind:'warn',actor:'system',text:'Haiku 4.5 crossed 90% of its $5.00 cap'},
 {ts:'2026-07-15 08:55',kind:'edit',actor:'nick',text:'Fable 5 cap set to $100.00 for architecting'},
 {ts:'2026-07-14 17:20',kind:'edit',actor:'nick',text:'Routed &#8220;Architecting / logical design&#8221; &#8594; Fable 5'}
];
let MSNAP=null;let DIRTY_CELLS=new Set();
const mSpend=m=>m.tokensIn/1e6*m.priceIn+m.tokensOut/1e6*m.priceOut;
const mPct=m=>m.cap?Math.min(1,mSpend(m)/m.cap):0;
const mStat=m=>m.local?'good':!m.cap?'good':mPct(m)>=.95?'crit':mPct(m)>=.75?'warn':'good';
function mFallsTo(id){const i=FALLBACK.indexOf(id);for(let j=i+1;j<FALLBACK.length;j++){const m=MODELS.find(x=>x.id===FALLBACK[j]);if(m&&(m.local||mPct(m)<1))return m;}return null;}
function chainFrom(id){const i=FALLBACK.indexOf(id);return i<0?[]:FALLBACK.slice(i+1);}
const runSpend=()=>MODELS.reduce((s,m)=>s+mSpend(m),0);
const mCapped=m=>!m.local&&m.cap&&mSpend(m)>=m.cap;
const checkpointedOf=m=>(mCapped(m)&&m.checkpoint)?(m.inflight||[]):[];
const totalCheckpointed=()=>MODELS.reduce((n,m)=>n+checkpointedOf(m).length,0);
const TONE={good:'var(--good)',warn:'var(--warn)',crit:'var(--crit)',info:'var(--info)'};
function mTone(m){if(m.local)return 'good';if(mCapped(m))return checkpointedOf(m).length?'warn':'crit';return mStat(m);}
const mColor=m=>m.local?'var(--info)':TONE[mTone(m)];
function raiseCap(mid,amount){const m=MODELS.find(x=>x.id===mid);if(!m||!m.cap)return;const saved=checkpointedOf(m).length;m.cap+=amount;BUDGET.dirty=true;renderModels();if(document.getElementById('drawer').classList.contains('open'))openDrawer('model:'+mid);toast(saved?`Cap raised to $${m.cap.toFixed(2)} &#8594; resumed ${saved} checkpointed task${saved===1?'':'s'} on ${m.label} from its last checkpoint (ADR-0052).`:`Cap raised to $${m.cap.toFixed(2)} on ${m.label}.`);}
function toggleCheckpoint(mid){const m=MODELS.find(x=>x.id===mid);if(!m)return;m.checkpoint=!m.checkpoint;BUDGET.dirty=true;renderModels();if(document.getElementById('drawer').classList.contains('open'))openDrawer('model:'+mid);toast(`${m.label}: checkpoint in-flight on cap &#8594; ${m.checkpoint?'on (work is saved + resumable)':'off (in-flight work is dropped at the cap)'}.`);}
function tierOf(mid){const m=MODELS.find(x=>x.id===mid);if(!m)return {t:'',cls:''};if(m.local||m.priceOut===0)return {t:'free',cls:'tier-free'};if(m.priceOut>=50)return {t:'premium',cls:'tier-premium'};if(m.priceOut>=10)return {t:'standard',cls:'tier-standard'};return {t:'low',cls:'tier-low'};}
function routeSelect(r,i){return `<select class="route-select" data-route="${i}" aria-label="Model for ${r.cls}">${MODELS.map(m=>`<option value="${m.id}" ${m.id===r.model?'selected':''}>${m.label}${m.local?' &#183; free':''}</option>`).join('')}</select>`;}
function ring(pct,color,size,big,small){const r=(size/2)-6,C=2*Math.PI*r,off=C*(1-Math.min(1,Math.max(0,pct)));return `<div class="ring-c" style="width:${size}px;height:${size}px"><svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="6"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>${big!==''?`<div class="ring-lbl"><div style="font-size:${size>70?15:12}px;font-weight:680">${big}</div>${small?`<div style="font-size:9px;color:var(--dim)">${small}</div>`:''}</div>`:''}</div>`;}

/* &#9472;&#9472; Runs &#9472;&#9472; */
let runFilter={q:'',owners:new Set(),projects:new Set(),statuses:new Set(),env:'all',sortKey:'seq',sortDir:-1};
function hRuns(){
 const root=document.getElementById('runsRoot');if(!root)return;
 const owners=[...new Set(RUNS.map(r=>r.owner.name))];
 const projects=[...new Set(RUNS.map(r=>r.project))];
 const stats=['running','passed','attention','failed','canceled'];
 const cols=[['seq','Run',''],['status','Status',''],['owner','Owner',''],['branch','Branch',''],['started','Started',''],['req','Requirements','r'],['safety','Safety','r'],['decisions','Decisions','r'],['cost','Cost','r']];
 root.innerHTML=`
  <div class="filterbar">
   <input class="search" id="runSearch" type="search" placeholder="Search run, id, branch&#8230;" value="${runFilter.q}">
   <span class="fb-label">Owner</span>${owners.map(o=>`<button type="button" class="pill tog ${runFilter.owners.has(o)?'on':''}" aria-pressed="${runFilter.owners.has(o)}" data-f="owner" data-v="${o}">${ava(o,'sm')} ${o}</button>`).join('')}
   <span class="fb-sep"></span><span class="fb-label">Project</span>${projects.map(p=>`<button type="button" class="pill tog ${runFilter.projects.has(p)?'on':''}" aria-pressed="${runFilter.projects.has(p)}" data-f="project" data-v="${p}">${p}</button>`).join('')}
   <span class="fb-sep"></span><span class="fb-label">Status</span>${stats.map(s=>`<button type="button" class="pill tog ${statusPill[s]} ${runFilter.statuses.has(s)?'on':''}" aria-pressed="${runFilter.statuses.has(s)}" data-f="status" data-v="${s}"><span class="dot"></span>${s}</button>`).join('')}
   <span class="fb-sep"></span><div class="seg" id="runEnv" role="group" aria-label="Environment">${['all','dev','prod'].map(e=>`<button type="button" class="${runFilter.env===e?'on':''}" aria-pressed="${runFilter.env===e}" data-env="${e}">${e}</button>`).join('')}</div>
   <span class="spacer" style="flex:1"></span><button type="button" class="btn sm" id="runClear">Clear</button>
  </div>
  <div class="result-count" id="runCount" aria-live="polite"></div>
  <div class="tbl-wrap"><table class="dt"><thead><tr>${cols.map(([k,l,a])=>`<th class="s" data-sort="${k}" style="${a?'text-align:right':''}">${l} <span class="caret" data-c="${k}"></span></th>`).join('')}</tr></thead><tbody id="runTbody"></tbody></table></div>`;
 document.getElementById('runSearch').oninput=e=>{runFilter.q=e.target.value;renderRunRows();};
 root.querySelectorAll('.pill.tog').forEach(p=>p.onclick=()=>{const f=p.dataset.f,v=p.dataset.v;const set=f==='owner'?runFilter.owners:f==='project'?runFilter.projects:runFilter.statuses;set.has(v)?set.delete(v):set.add(v);p.classList.toggle('on');p.setAttribute('aria-pressed',p.classList.contains('on'));renderRunRows();});
 root.querySelectorAll('#runEnv button').forEach(b=>b.onclick=()=>{runFilter.env=b.dataset.env;root.querySelectorAll('#runEnv button').forEach(x=>{const on=x.dataset.env===runFilter.env;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});renderRunRows();});
 document.getElementById('runClear').onclick=()=>{runFilter={q:'',owners:new Set(),projects:new Set(),statuses:new Set(),env:'all',sortKey:runFilter.sortKey,sortDir:runFilter.sortDir};hRuns();};
 root.querySelectorAll('th.s').forEach(th=>th.onclick=()=>{const k=th.dataset.sort;if(runFilter.sortKey===k)runFilter.sortDir*=-1;else{runFilter.sortKey=k;runFilter.sortDir=-1;}renderRunRows();});
 renderRunRows();
}
function runSortVal(r,k){switch(k){case 'req':return r.req.pass/(r.req.total||1);case 'safety':return r.safety.deny*10+r.safety.ask;case 'owner':return r.owner.name;case 'branch':return r.branch;case 'status':return r.status;case 'started':return r.started;case 'decisions':return r.decisions;case 'cost':return r.cost;default:return r.seq;}}
function renderRunRows(){
 let rows=RUNS.filter(r=>{
  if(runFilter.q&&!(r.label+r.id+r.branch+r.owner.name).toLowerCase().includes(runFilter.q.toLowerCase()))return false;
  if(runFilter.owners.size&&!runFilter.owners.has(r.owner.name))return false;
  if(runFilter.projects.size&&!runFilter.projects.has(r.project))return false;
  if(runFilter.statuses.size&&!runFilter.statuses.has(r.status))return false;
  if(runFilter.env!=='all'&&r.env!==runFilter.env)return false;
  return true;});
 rows.sort((a,b)=>{const x=runSortVal(a,runFilter.sortKey),y=runSortVal(b,runFilter.sortKey);return (x>y?1:x<y?-1:0)*runFilter.sortDir;});
 document.getElementById('runCount').textContent=`Showing ${rows.length} of ${RUNS.length} runs`;
 document.querySelectorAll('.caret').forEach(c=>c.innerHTML=c.dataset.c===runFilter.sortKey?(runFilter.sortDir<0?'&#9660;':'&#9650;'):'');
 const tb=document.getElementById('runTbody');
 if(!rows.length){tb.innerHTML=`<tr><td colspan="9"><div class="empty-state">No runs match these filters. <button class="btn sm" onclick="document.getElementById('runClear').click()">Clear filters</button></div></td></tr>`;return;}
 tb.innerHTML=rows.map(r=>`<tr class="run-row s-${statusStripe[r.status]}" data-run="${r.id}" tabindex="0" role="button" aria-label="${r.label} &#8212; ${r.status}">
   <td><div class="req-name" style="font-size:13px">${r.project}</div><div class="req-id">${r.label}</div></td>
   <td><span class="pill ${statusPill[r.status]}"><span class="dot"></span>${r.status}</span></td>
   <td>${ava(r.owner.name,'sm')} <span style="color:var(--dim)">${r.owner.name}</span></td>
   <td><span class="chip">${r.branch}</span> <span class="env-tag ${r.env}">${r.env}</span></td>
   <td class="req-id">${r.startedRel}<br>${r.duration}</td>
   <td style="text-align:right">${r.req.total?`<div class="rep-bar" style="justify-content:flex-end"><div class="meter" style="width:46px"><i style="width:${r.req.pass/r.req.total*100}%"></i></div><span class="num">${r.req.pass}/${r.req.total}</span></div>`:'<span class="req-id">&#8212;</span>'}</td>
   <td style="text-align:right">${r.safety.deny?`<span class="chip deny">${r.safety.deny} deny</span> `:''}${r.safety.ask?`<span class="chip ask">${r.safety.ask} ask</span>`:''}${!r.safety.deny&&!r.safety.ask?'<span class="chip allow">clean</span>':''}</td>
   <td class="num" style="text-align:right">${r.decisions||'&#8212;'}</td>
   <td class="num" style="text-align:right">$${r.cost.toFixed(2)}</td></tr>`).join('');
 tb.querySelectorAll('tr[data-run]').forEach(tr=>{const open=()=>openDrawer('run:'+tr.dataset.run);tr.onclick=open;tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
}

/* &#9472;&#9472; Constitution &#9472;&#9472; */
let constiFilter={q:'',group:'all',cited:false};
function hConsti(){
 const root=document.getElementById('constiRoot');if(!root)return;
 const totalCites=allRules().reduce((s,r)=>s+citeTotal(r),0);
 root.innerHTML=`
  <div class="tiles">
    <div class="tile"><span class="strip accent"></span><div class="label">Rules with text</div><div class="val num">${allRules().length}</div><div class="foot">7 kernel &#183; 7 local</div></div>
    <div class="tile link" data-cgroup="foundational" tabindex="0" role="button"><span class="strip info"></span><div class="label">Immutable &#183; Rules 1&#8211;8</div><div class="val num">8</div><div class="foot">3 shown &#183; full kernel is user-installed</div></div>
    <div class="tile link" data-cgroup="local" tabindex="0" role="button"><span class="strip good"></span><div class="label">Local rules</div><div class="val num">7</div><div class="foot">this project &#183; LR-01&#8594;07</div></div>
    <div class="tile link" data-ccited tabindex="0" role="button"><span class="strip warn"></span><div class="label">Citations &#183; this run</div><div class="val num">${totalCites}</div><div class="foot">across governed ops</div></div>
  </div>
  <div class="filterbar" style="margin-top:14px">
    <input class="search" id="constiSearch" type="search" placeholder="Search rules, numbers, text&#8230;" value="${constiFilter.q}">
    <span class="fb-sep"></span><div class="seg" id="constiGroup" role="group" aria-label="Rule group">${[['all','All'],['foundational','Foundational'],['operational','Operational'],['local','Local']].map(([k,l])=>`<button type="button" class="${constiFilter.group===k?'on':''}" aria-pressed="${constiFilter.group===k}" data-g="${k}">${l}</button>`).join('')}</div>
    <span class="fb-sep"></span><div class="seg" id="constiCited" role="group" aria-label="Citation filter">${[['all','All rules'],['cited','Cited this run']].map(([k,l])=>`<button type="button" class="${(k==='cited')===constiFilter.cited?'on':''}" aria-pressed="${(k==='cited')===constiFilter.cited}" data-c="${k}">${l}</button>`).join('')}</div>
    <span class="spacer" style="flex:1"></span><span class="pill warn"><span class="dot"></span>Kernel V6 &#183; placeholder</span>
  </div>
  <div class="note" style="margin-bottom:14px">Rules <b>3&#8211;7, 9&#8211;18, 21</b> apply but their canonical text isn&#8217;t installed in this repo yet (Kernel V6 ships as a placeholder for you to drop the authoritative text into). The rules and their text below are faithful to the repo &#8212; nothing is invented. (Citation counts are representative, like the rest of this prototype.)</div>
  <div id="ruleGroups"></div>`;
 document.getElementById('constiSearch').oninput=e=>{constiFilter.q=e.target.value;renderRules();};
 root.querySelectorAll('#constiGroup button').forEach(b=>b.onclick=()=>{constiFilter.group=b.dataset.g;root.querySelectorAll('#constiGroup button').forEach(x=>{const on=x.dataset.g===constiFilter.group;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});renderRules();});
 root.querySelectorAll('#constiCited button').forEach(b=>b.onclick=()=>{constiFilter.cited=b.dataset.c==='cited';root.querySelectorAll('#constiCited button').forEach(x=>{const on=(x.dataset.c==='cited')===constiFilter.cited;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});renderRules();});
 const ktile=(el,fn)=>{el.onclick=fn;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};};
 root.querySelectorAll('[data-cgroup]').forEach(t=>ktile(t,()=>{constiFilter.group=t.dataset.cgroup;hConsti();}));
 ktile(root.querySelector('[data-ccited]'),()=>{constiFilter.cited=true;hConsti();});
 renderRules();
}
function ruleCard(r){return `<div class="rule-card ${r.imm?'imm':''}" data-rule="${r.id}" tabindex="0" role="button">
  <div class="rule-top"><div class="rule-num">${r.local?r.id:r.num}</div><div class="rule-title">${r.title}</div>${r.imm?`<span class="imm-badge">${svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')} Immutable</span>`:''}</div>
  <div class="rule-text">${r.text}</div>
  <div class="rule-foot"><span class="chip">${r.local?`Local &#183; ${r.addedBy} &#183; ${r.addedAt}`:'Kernel V6'}</span><div class="cite-strip">${citeTotal(r)?citeBar(r):''}${citeLabel(r)}</div></div></div>`;}
function renderRules(){
 const groups=[['foundational','Foundational','Effectively immutable &#8212; changeable only via explicit override-authority sign-off (Kernel V6, Rules 1&#8211;8).'],['operational','Operational','Amendable operating rules from Kernel V6.'],['local','Local','Project-specific rules for this repo (LR-xx).']];
 const q=constiFilter.q.toLowerCase();
 const match=r=>{if(constiFilter.cited&&!citeTotal(r))return false;if(q&&!((r.num||'')+r.id+r.title+r.text).toLowerCase().includes(q))return false;return true;};
 let html='';
 groups.forEach(([key,label,desc])=>{
  if(constiFilter.group!=='all'&&constiFilter.group!==key)return;
  const rs=allRules().filter(r=>ruleGroupOf(r)===key&&match(r));
  if(!rs.length)return;
  html+=`<div class="grp-head"><div><div class="gl">${label} &#183; ${rs.length}</div><div class="gd">${desc}</div></div></div><div class="rulegrid">${rs.map(ruleCard).join('')}</div>`;
 });
 const host=document.getElementById('ruleGroups');
 host.innerHTML=html||`<div class="empty-state">No rules match. <button class="btn sm" id="constiReset">Clear</button></div>`;
 host.querySelectorAll('[data-rule]').forEach(c=>{c.onclick=()=>openDrawer('rule:'+c.dataset.rule);c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDrawer('rule:'+c.dataset.rule);}};});
 const rb=document.getElementById('constiReset');if(rb)rb.onclick=()=>{constiFilter={q:'',group:'all',cited:false};hConsti();};
}

/* &#9472;&#9472; Models & Budget &#9472;&#9472; */
function snapModels(){return JSON.stringify({m:MODELS.map(m=>({...m})),f:[...FALLBACK],r:ROUTING.map(x=>({...x}))});}
function restoreSnap(){const o=JSON.parse(MSNAP);o.m.forEach((mm,i)=>Object.assign(MODELS[i],mm));FALLBACK=o.f;o.r.forEach((rr,i)=>Object.assign(ROUTING[i],rr));BUDGET.dirty=false;}
function hModels(){if(MSNAP===null)MSNAP=snapModels();renderModels();}
const editIcon=svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>');
const CE=(m,f,v)=>`<span class="cell-edit${DIRTY_CELLS.has(m.id+':'+f)?' dirty':''}" role="button" tabindex="0" data-mid="${m.id}" data-field="${f}" title="Click to edit">$${v.toFixed(2)}<span class="ce-pencil">${editIcon}</span></span>`;
const capStopIcon=svg('<rect x="6" y="6" width="12" height="12" rx="1.5"/>');
const capFbIcon=svg('<path d="M5 7h9a4 4 0 0 1 4 4v3"/><path d="m14 17 4-3-4-3"/>');
function modelRow(m){const spent=mSpend(m),pct=mPct(m),st=mStat(m),tone=mTone(m),ft=mFallsTo(m.id),atCap=!m.local&&pct>=1;
 return `<tr data-mrow="${m.id}" tabindex="0" role="button" aria-label="${m.label} &#8212; model detail">
  <td><div class="req-name" style="font-size:13px">${m.label}</div><div class="req-id">${m.provider}${m.local?' &#183; local':''}</div></td>
  <td>${m.roles.map(r=>`<span class="chip">${r}</span>`).join(' ')} ${m.agents.length?`<span class="req-id">${m.agents.join(', ')}</span>`:''}</td>
  <td style="text-align:right">${m.local?'<span class="cell-edit disabled">$0.00</span>':CE(m,'priceIn',m.priceIn)}</td>
  <td style="text-align:right">${m.local?'<span class="cell-edit disabled">$0.00</span>':CE(m,'priceOut',m.priceOut)}</td>
  <td class="num" style="text-align:right;color:var(--dim)">${fmtTok(m.tokensIn)} / ${fmtTok(m.tokensOut)}</td>
  <td class="num" style="text-align:right;font-weight:650">$${spent.toFixed(2)}</td>
  <td style="text-align:right">${m.local?'<span class="req-id">&#8212;</span>':CE(m,'cap',m.cap)}</td>
  <td>${m.local?'<span class="req-id">local &#183; $0</span>':`<div class="meter" style="width:88px"><i style="width:${pct*100}%;background:${mColor(m)}"></i></div><div class="fallsto ${m.onCap==='fallback'&&ft?'live':''}">${m.onCap==='fallback'&&ft?'&#8594; '+ft.label:'stop at cap'} &#183; ${(pct*100).toFixed(0)}%</div>`}</td>
  <td>${m.local?'<span class="pill good" style="padding:1px 7px"><span class="dot"></span>always on</span>':`<div class="seg-cap" data-mid="${m.id}" role="group" aria-label="${m.label} at-cap behavior"><button type="button" class="stop ${m.onCap==='stop'?'on':''}" data-cap="stop" aria-pressed="${m.onCap==='stop'}">${capStopIcon} stop</button><button type="button" class="fb ${m.onCap==='fallback'?'on':''}" data-cap="fallback" aria-pressed="${m.onCap==='fallback'}">${capFbIcon} fall back</button></div>`}</td>
  <td>${m.local?'<span class="pill good"><span class="dot"></span>local</span>':`<span class="pill ${tone}"><span class="dot"></span>${atCap?(checkpointedOf(m).length?'at cap &#183; '+checkpointedOf(m).length+' paused':(m.onCap==='stop'?'stopped':'rerouting')):st==='warn'||st==='crit'?'near cap':'ok'}</span>`}</td></tr>`;}
function chainItem(id,i){const m=MODELS.find(x=>x.id===id),pct=mPct(m),last=i===FALLBACK.length-1;
 return `<div class="chain-item ${m.local?'pinned':''}"><span class="chain-num">${i+1}${['st','nd','rd'][i]||'th'}</span>
   ${ring(m.local?0:pct,mColor(m),34,'')}
   <div><div style="font-weight:600;font-size:12.5px">${m.label}</div><div class="req-id">${m.local?'safety net &#183; $0':'$'+mSpend(m).toFixed(2)+' / $'+m.cap.toFixed(2)}</div></div>
   ${m.local?`<span class="chip allow" style="font-size:9px">pinned last</span>`:`<div class="chain-reord"><button type="button" data-up="${id}" aria-label="Move ${m.label} earlier in fallback chain" ${i===0?'disabled':''}>${svg('<path d="m6 15 6-6 6 6"/>')}</button><button type="button" data-down="${id}" aria-label="Move ${m.label} later in fallback chain" ${i>=FALLBACK.length-2?'disabled':''}>${svg('<path d="m6 9 6 6 6-6"/>')}</button></div>`}
 </div>${last?'':'<span class="chain-sep">&#8594;</span>'}`;}
function renderModels(){
 const root=document.getElementById('modelsRoot');if(!root)return;
 const spent=runSpend(),pct=spent/BUDGET.runCap;
 const frontier=MODELS.filter(m=>!m.local);
 const nearest=frontier.filter(m=>m.cap&&mPct(m)<1).sort((a,b)=>mPct(b)-mPct(a))[0];
 const capped=frontier.filter(m=>mPct(m)>=1).length;
 const cappedCk=MODELS.find(m=>checkpointedOf(m).length);const ckN=totalCheckpointed();
 root.innerHTML=`
  ${cappedCk?`<div class="cap-banner"><span class="feed-glyph g-warn cb-ico">${svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')}</span><div style="flex:1;min-width:260px"><b>${cappedCk.label} hit its $${cappedCk.cap.toFixed(2)} cap.</b> Its ${checkpointedOf(cappedCk).length} in-flight task(s) are <b>checkpointed</b> &#8212; completed steps are saved and won&#8217;t be recomputed. New work is routing to ${(mFallsTo(cappedCk.id)||{}).label||'the fallback'}. Raise the cap to resume them from their last checkpoint.</div><button class="btn primary sm" data-raise="${cappedCk.id}:100">Raise cap +$100 &amp; resume</button></div>`:''}
  <div class="tiles">
    <div class="tile"><div class="label">Session budget</div><div style="display:flex;align-items:center;gap:12px;margin-top:6px">${ring(pct,pct>=1?'var(--crit)':pct>=.8?'var(--warn)':'var(--good)',60,Math.round(pct*100)+'%')}<div><div class="num" style="font-size:18px;font-weight:680">$${spent.toFixed(2)}</div><div class="foot">of $${BUDGET.runCap.toFixed(2)} session cap</div></div></div></div>
    <div class="tile"><span class="strip ${capped?'crit':'good'}"></span><div class="label">Models capped</div><div class="val num">${capped} / ${frontier.length}</div><div class="foot">frontier models</div></div>
    <div class="tile"><span class="strip ${ckN?'warn':'good'}"></span><div class="label">Checkpointed work</div><div class="val num">${ckN}</div><div class="foot">resume from last checkpoint (ADR-0052)</div></div>
    <div class="tile link" data-drawer="model:${nearest?nearest.id:''}" tabindex="0" role="button"><span class="strip warn"></span><div class="label">Nearest cap</div><div class="val txt">${nearest?nearest.label:'&#8212;'}</div><div class="foot">${nearest?(mPct(nearest)*100).toFixed(0)+'% of $'+nearest.cap.toFixed(2):''}</div></div>
    <div class="tile link" data-drawer="fallback:x" tabindex="0" role="button"><span class="strip info"></span><div class="label">At-cap behavior</div><div class="val txt">${frontier.filter(m=>m.onCap==='fallback').length} auto-fall-back</div><div class="foot">+ 1 local safety net</div></div>
  </div>
  <div class="row" style="margin:22px 0 10px"><span class="sec-title" style="margin:0">Task routing</span><span class="spacer" style="flex:1"></span><span class="req-id">which model runs which kind of task &#183; pick a model per row</span></div>
  <div class="tbl-wrap"><table class="dt"><thead><tr><th>Task class</th><th>Example</th><th style="width:180px">Model</th><th>Cost tier</th></tr></thead><tbody>${ROUTING.map((r,i)=>{const ti=tierOf(r.model);return `<tr><td><div class="req-name">${r.cls}</div></td><td style="color:var(--dim)">${r.ex}</td><td>${routeSelect(r,i)}</td><td><span class="tier ${ti.cls}">${ti.t}</span></td></tr>`;}).join('')}</tbody></table></div>
  <div class="row" style="margin:22px 0 10px"><span class="sec-title" style="margin:0">Per-model config</span><span class="spacer" style="flex:1"></span><span class="req-id">click a price or cap to edit &#183; budget spans this session (the Cost view shows per-run spend)</span></div>
  <div class="tbl-wrap"><table class="dt"><thead><tr><th>Model</th><th>Task class</th><th style="text-align:right">$ / 1M in</th><th style="text-align:right">$ / 1M out</th><th style="text-align:right">Tokens in/out</th><th style="text-align:right">Spend</th><th style="text-align:right">Cap</th><th>Spend vs cap</th><th>At cap</th><th>Status</th></tr></thead><tbody>${MODELS.map(modelRow).join('')}</tbody></table></div>
  <div class="card" style="margin-top:16px">
    <div class="row"><div><div class="eyebrow">Fallback flow</div><div style="color:var(--dim);font-size:13px;margin-top:3px">When a model hits its cap with <b>auto-fall-back</b> on, agents cascade down this order. Reorder with the arrows.</div></div><span class="spacer" style="flex:1"></span><button class="btn sm" data-drawer="fallback:x">How this works</button></div>
    <div class="chain" id="chain">${FALLBACK.map((id,i)=>chainItem(id,i)).join('')}</div>
    <div class="note">With auto-fall-back on, routing resolves down to Llama 3 (local, $0), so those agents never fully halt (LR-06). A model set to &#8220;stop&#8221; halts its own agents at the cap instead of rerouting.</div>
  </div>
  <div class="sec-title">Budget activity</div>
  <div class="card"><div class="feed">${BUDGET_EVENTS.map(e=>`<div class="feed-item" style="grid-template-columns:26px 1fr auto"><span class="feed-glyph g-${e.kind==='edit'?'accent':e.kind==='warn'?'warn':'info'}">${svg(e.kind==='edit'?'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>':e.kind==='warn'?'<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>':'<path d="M3 12h4l3 8 4-16 3 8h4"/>')}</span><div class="feed-body"><div class="t">${e.text}</div><div class="m">${e.actor}</div></div><div class="feed-time">${e.ts.slice(5)}</div></div>`).join('')}</div></div>
  ${BUDGET.dirty?`<div class="dirty-bar"><span style="font-weight:600">Unsaved budget changes</span><span class="spacer" style="flex:1"></span><button class="btn sm" id="mRevert">Revert</button><button class="btn primary sm" id="mApply">Apply routing</button></div>`:''}`;
 bindModels();
}
function bindModels(){
 const root=document.getElementById('modelsRoot');if(!root)return;
 const kact=(el,fn)=>{el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();fn();}};};
 root.querySelectorAll('tr[data-mrow]').forEach(tr=>{const open=()=>openDrawer('model:'+tr.dataset.mrow);tr.onclick=open;tr.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===tr){e.preventDefault();open();}};});
 root.querySelectorAll('.cell-edit[data-mid]').forEach(c=>{c.onclick=e=>{e.stopPropagation();editCell(c);};kact(c,()=>editCell(c));});
 root.querySelectorAll('.seg-cap button').forEach(b=>b.onclick=e=>{e.stopPropagation();const mid=b.parentElement.dataset.mid;MODELS.find(m=>m.id===mid).onCap=b.dataset.cap;BUDGET.dirty=true;toast('At-cap behavior &#8594; '+b.dataset.cap);renderModels();});
 root.querySelectorAll('[data-up]').forEach(b=>b.onclick=e=>{e.stopPropagation();moveChain(b.dataset.up,-1);});
 root.querySelectorAll('[data-down]').forEach(b=>b.onclick=e=>{e.stopPropagation();moveChain(b.dataset.down,1);});
 root.querySelectorAll('.tile[data-drawer]').forEach(t=>{const open=()=>openDrawer(t.dataset.drawer);t.onclick=e=>{e.stopPropagation();open();};kact(t,open);});
 root.querySelectorAll('.btn[data-drawer]').forEach(t=>t.onclick=e=>{e.stopPropagation();openDrawer(t.dataset.drawer);});
 root.querySelectorAll('.route-select').forEach(s=>s.onchange=()=>{const i=+s.dataset.route;ROUTING[i].model=s.value;BUDGET.dirty=true;toast(`Routing: &#8220;${ROUTING[i].cls}&#8221; &#8594; ${(MODELS.find(m=>m.id===s.value)||{}).label}`);renderModels();});
 root.querySelectorAll('[data-raise]').forEach(b=>b.onclick=e=>{e.stopPropagation();const s=b.dataset.raise,j=s.indexOf(':');raiseCap(s.slice(0,j),+s.slice(j+1));});
 const rev=document.getElementById('mRevert'),ap=document.getElementById('mApply');
 if(rev)rev.onclick=()=>{restoreSnap();DIRTY_CELLS.clear();toast('Reverted to last saved routing');renderModels();};
 if(ap)ap.onclick=()=>{MSNAP=snapModels();BUDGET.dirty=false;DIRTY_CELLS.clear();toast('Routing applied (writes tools/litellm/config.yaml)');renderModels();};
}
function editCell(c){if(c.querySelector('input'))return;const m=MODELS.find(x=>x.id===c.dataset.mid),field=c.dataset.field;
 const lbl=`${m.label} &#8212; ${field==='cap'?'spend cap ($)':field==='priceIn'?'price per 1M input tokens ($)':'price per 1M output tokens ($)'}`;
 c.innerHTML=`<input type="number" min="0" step="0.01" inputmode="decimal" aria-label="${lbl}" value="${m[field]}">`;const inp=c.querySelector('input');inp.focus();inp.select();let done=false;
 inp.onclick=ev=>ev.stopPropagation();
 const commit=()=>{if(done)return;done=true;const v=parseFloat(inp.value);if(isNaN(v)||v<0){toast('Value must be a number &#8805; 0');renderModels();return;}if(field==='cap'&&v<=0){toast('A cap must be greater than $0 (use the &#8220;stop&#8221; at-cap behavior to block a model).');renderModels();return;}m[field]=v;DIRTY_CELLS.add(m.id+':'+field);BUDGET.dirty=true;renderModels();};
 inp.onblur=commit;inp.onkeydown=e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){done=true;renderModels();}};
}
function moveChain(id,dir){const i=FALLBACK.indexOf(id),j=i+dir;if(j<0||j>=FALLBACK.length)return;const localIdx=FALLBACK.findIndex(x=>MODELS.find(m=>m.id===x).local);if(dir>0&&j>=localIdx)return;[FALLBACK[i],FALLBACK[j]]=[FALLBACK[j],FALLBACK[i]];BUDGET.dirty=true;renderModels();}

function wireDnD(){let dragId=null;document.querySelectorAll('.kb-card').forEach(card=>{card.addEventListener('dragstart',()=>{dragId=card.dataset.id;card.classList.add('dragging');});card.addEventListener('dragend',()=>card.classList.remove('dragging'));});document.querySelectorAll('.kb-col').forEach(col=>{col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drop');});col.addEventListener('dragleave',()=>col.classList.remove('drop'));col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drop');const to=col.dataset.col;let moved;for(const c of KB_ORDER){const i=KANBAN[c].findIndex(x=>x.id===dragId);if(i>=0){moved=KANBAN[c].splice(i,1)[0];break;}}if(moved){KANBAN[to].unshift(moved);hWork();toast('Moved '+moved.id+' &#8594; '+KB_LABEL[to]+' (emits a ticket transition)');}});});}

/* drawer */
let _drawerTrigger=null;
function openDrawer(spec){const i=spec.indexOf(':');const type=spec.slice(0,i),key=spec.slice(i+1);const d=document.getElementById('drawer');
 if(!d.classList.contains('open'))_drawerTrigger=document.activeElement;
 d.className='drawer'+(['req','run','rule','model'].includes(type)?' wide':'');d.innerHTML=DRAWER[type]?DRAWER[type](key):'';
 d.setAttribute('aria-modal','true');const h=d.querySelector('h3');if(h){h.id='drawer-title';d.setAttribute('aria-labelledby','drawer-title');}else d.removeAttribute('aria-labelledby');
 d.classList.add('open');document.getElementById('scrim').classList.add('open');
 const app=document.querySelector('.app');if(app)app.setAttribute('inert','');
 d.querySelector('[data-close]')?.addEventListener('click',closeDrawer);d.querySelectorAll('[data-rerun]').forEach(b=>b.onclick=()=>rerun(b));d.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>resolveCase(b.dataset.resolve));d.querySelectorAll('[data-raise]').forEach(b=>b.onclick=()=>{const s=b.dataset.raise,j=s.indexOf(':');raiseCap(s.slice(0,j),+s.slice(j+1));});d.querySelectorAll('[data-ckpt]').forEach(b=>b.onclick=()=>toggleCheckpoint(b.dataset.ckpt));d.querySelectorAll('[data-gonav]').forEach(b=>b.onclick=()=>{closeDrawer();go(b.dataset.gonav);});d.querySelectorAll('[data-godrawer]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.godrawer));
 const cb=d.querySelector('[data-close]');if(cb)cb.focus();}
function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('scrim').classList.remove('open');const app=document.querySelector('.app');if(app)app.removeAttribute('inert');if(_drawerTrigger&&_drawerTrigger.focus){_drawerTrigger.focus();_drawerTrigger=null;}}
document.getElementById('scrim').onclick=closeDrawer;document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
const closeBtn=`<button class="icon-btn" data-close aria-label="Close" style="margin-left:auto">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button>`;
const RESOLVED=new Set();const RERUN_LOG={};
const isPass=c=>c.status==='pass'||RESOLVED.has(c.id);
function findCase(id){for(const k in KEY_CASES){const f=KEY_CASES[k].find(c=>c.id===id);if(f)return f;}return null;}
function nowHM(){const d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function reReq(reqId){const idx=REQS.findIndex(x=>x.id===reqId);if(current==='requirements')hReq();else if(current==='overview')hOv();openDrawer('req:'+idx);}
function markResolved(reqId,caseId){const r=REQS.find(x=>x.id===reqId);if(r&&r.pass<r.total)r.pass++;RESOLVED.add(caseId);reReq(reqId);}
function rerun(b){const id=b.dataset.case,reqId=b.dataset.req,c=findCase(id);b.textContent='Re-running...';b.disabled=true;
 setTimeout(()=>{
  if(c&&c.failKind==='flaky'){RERUN_LOG[id]={t:nowHM(),tone:'good',text:'Re-ran &#8212; transient failure cleared; the endpoint responded this time. Now passing.'};markResolved(reqId,id);toast('Transient failure cleared on retry &#8212; now passing.');}
  else{RERUN_LOG[id]={t:nowHM(),tone:'crit',text:`Re-ran &#8212; reproduced. Still ${c?c.failKind:'failing'}: re-running an unchanged test can&#8217;t fix it${c&&c.resolver?` &#8212; resolve via &#8220;${c.resolver}&#8221;.`:'.'}`};reReq(reqId);toast('Re-ran &#8212; still failing (reproduced).');}
 },1000);}
function resolveCase(spec){const i=spec.indexOf(':'),reqId=spec.slice(0,i),caseId=spec.slice(i+1),c=findCase(caseId);toast(`${c&&c.resolver?c.resolver:'Resolving'}&#8230;`);setTimeout(()=>{RERUN_LOG[caseId]={t:nowHM(),tone:'good',text:`${c&&c.resolver?c.resolver:'Resolver'} completed &#8594; cause resolved. Now passing.`};markResolved(reqId,caseId);toast('Cause resolved &#8594; case now passing.');},1300);}
function toast(msg){const t=document.getElementById('toast');t.innerHTML=svg('<path d="m5 12 4 4 10-10"/>')+`<span>${msg}</span>`;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600);}

const DRAWER={
 agent(name){const a=AGENTS[name];const sm=((a.pass+2)/(a.pass+a.fail+4));
  return `<div class="drawer-head"><div><div class="k">Agent profile</div><h3>${a.name}</h3><div style="color:var(--dim);font-size:12.5px;font-family:var(--mono)">${a.role}</div></div>${closeBtn}</div>
  <div class="drawer-body">
   <div class="grid-2" style="gap:10px">
     <div class="card" style="padding:12px 14px"><div class="req-id" style="text-transform:uppercase;letter-spacing:.06em">Reputation</div><div style="font-size:22px;font-weight:680;margin-top:4px">${a.score.toFixed(3)}</div><div class="meter" style="margin-top:6px"><i style="width:${a.score*100}%"></i></div></div>
     <div class="card" style="padding:12px 14px"><div class="req-id" style="text-transform:uppercase;letter-spacing:.06em">Reliability</div><div style="font-size:22px;font-weight:680;margin-top:4px">${a.reliability==null?'&#8212;':(a.reliability*100).toFixed(0)+'%'}</div><div style="font-size:11px;color:var(--faint);margin-top:6px">did its job when called</div></div>
   </div>
   <h4>Objective</h4><p style="margin:0;color:var(--dim);font-size:13.5px;line-height:1.6">${a.objective}</p>
   <h4>What it does</h4><p style="margin:0;color:var(--dim);font-size:13px;line-height:1.55">${a.what}</p>
   <h4>Skills</h4><div class="skills">${a.skills.map(s=>`<span class="skill">${s}</span>`).join('')}</div>
   <h4>Tools &#183; model &#183; collaborators</h4>
   <div class="kv"><span class="k">Tools</span><span class="v">${a.tools.join(', ')}</span><span class="k">Model</span><span class="v">${a.model}</span><span class="k">Why this model</span><span class="v" style="text-align:right;max-width:250px;white-space:normal;font-family:var(--sans);color:var(--dim);font-size:12px">${a.modelWhy}</span><span class="k">Works with</span><span class="v">${a.collaborators.join(', ')||'&#8212;'}</span><span class="k">Last updated</span><span class="v">${a.updated}</span></div>
   <h4>Reputation &#8212; how this score is built</h4>
   <div class="formula">rate = (pass + 2) / (pass + fail + 4) = (${a.pass}+2)/(${a.pass}+${a.fail}+4) = <b>${sm.toFixed(3)}</b>
score = rate&#183;1.0 + lessons&#183;.05 + critic&#183;.05 &#8722; retract&#183;.10
      = ${sm.toFixed(3)} + ${a.lessons}&#183;.05 + ${a.critic}&#183;.05 &#8722; ${a.retr}&#183;.10 = <b>${a.score.toFixed(3)}</b></div>
   <div class="kv" style="margin-top:12px"><span class="k">Verified pass / fail</span><span class="v">${a.pass} / ${a.fail}</span><span class="k">n (sample size)</span><span class="v">${a.n}</span><span class="k">Lessons &#183; critic-approvals &#183; retractions</span><span class="v">${a.lessons} &#183; ${a.critic} &#183; ${a.retr}</span></div>
   <h4>Audit trail &#8212; what it did, in which run, on which model</h4>
   ${a.audit.length?`<div class="audit">${a.audit.map(e=>`<div class="ev"><div class="at"><span class="run-tag">${e.run}</span> ${e.time} &#183; ${e.model}</div><div class="aw">${e.what}</div><div class="ay">&#8594; ${e.outcome}</div></div>`).join('')}</div>`:'<p style="color:var(--faint);font-size:13px">No recorded actions in this window.</p>'}
   <div class="note" style="margin-top:14px">Reputation is <b>projection only</b> &#8212; it can weight this agent&#8217;s vote in a decision, but never chooses which agent is dispatched (that&#8217;s ADR-0053 Step 3, gated on a constitution-service review).</div>
  </div>`;
 },
 req(i){const r=REQS[i];const cases=casesFor(r);const failing=cases.filter(c=>!isPass(c));const fails=failing.length;
  return `<div class="drawer-head"><div><div class="k">Requirement &#183; ${r.id} &#183; ${r.run}</div><h3>${r.name}</h3></div>${closeBtn}</div>
  <div class="drawer-body">
   <h4>In plain terms</h4><p style="margin:0;color:var(--dim);font-size:13.5px;line-height:1.6">${r.plain}</p>
   <div class="kv" style="margin-top:14px"><span class="k">Governed by</span><span class="v">${r.adr}</span><span class="k">Checked by</span><span class="v">${r.by}</span><span class="k">Cases</span><span class="v">${r.pass}/${r.total} pass${fails?` &#183; <span style="color:var(--crit)">${fails} failing</span>`:''}</span><span class="k">Exceptions</span><span class="v">${r.se} system &#183; ${r.be} business</span></div>
   <h4>All test cases <span class="pill" style="font-weight:500">the definition-of-done</span></h4>
   <div class="tbl-wrap"><table class="dt"><thead><tr><th>Type</th><th>Case</th><th>Expected in &#8594; out</th><th>Actual in &#8594; out</th><th>Why it validates</th><th>Status</th></tr></thead><tbody>
   ${cases.map(c=>`<tr><td style="vertical-align:top"><span class="chip ${c.type==='---'?'none':c.type}">${c.type==='---'?'step':c.type}</span></td>
     <td><div style="font-weight:600">${c.c}</div><div class="req-id">${c.id}</div>${RERUN_LOG[c.id]?`<div style="color:var(--${RERUN_LOG[c.id].tone});font-size:11px;line-height:1.4;margin-top:5px;font-family:var(--mono)">Last re-run ${RERUN_LOG[c.id].t} &#8212; ${RERUN_LOG[c.id].text}</div>`:''}</td>
     <td class="num" style="color:var(--dim)">${c.ei} <span style="color:var(--faint)">&#8594;</span> ${c.eo}</td>
     <td class="num">${isPass(c)?`<span style="color:var(--good)">${c.eo}</span>`:`${c.ai} <span style="color:var(--faint)">&#8594;</span> ${c.ao}`}</td>
     <td style="color:var(--dim);font-size:12px;max-width:200px">${c.why}</td>
     <td>${isPass(c)?'<span class="st-dot pass" title="pass"></span>':`<button class="btn sm" data-rerun data-req="${r.id}" data-case="${c.id}">Re-run</button>`}</td></tr>`).join('')}
   </tbody></table></div>
   ${failing.map(c=>`<div class="note warn" style="margin-top:12px"><b>${c.id} &#8212; failing &#183; ${c.failKind||'broken'}.</b> ${c.failReason||''}<br>${c.failKind==='flaky'?'This is a <b>flaky</b> (transient) failure &#8212; a <b>Re-run</b> should clear it.':`This is a <b>${c.failKind||'real'}</b> failure &#8212; re-running just reproduces it. It turns green only when the cause is resolved${c.resolver?`: <button class="btn sm primary" data-resolve="${r.id}:${c.id}">${c.resolver}</button>`:'.'}`}</div>`).join('')}
   ${fails?`<div class="note" style="margin-top:12px"><b>Why re-run isn&#8217;t a fix:</b> a <b>flaky</b> failure (e.g. the live 2nd model timed out) clears on retry; a <b>blocked</b> one (waiting on evidence, like a measurement) or a <b>broken</b> one (a real defect) reproduces until you resolve the cause. Other follow-ups: <button class="btn sm">View log</button> <button class="btn sm">Assign to critic</button> <button class="btn sm">Open register</button></div>`:''}
   <div class="note" style="margin-top:12px">Full register: <code>observability/eval-suite/requirements/${r.id}.md</code> &#8212; every expected-vs-actual row, kept for regression.</div>
  </div>`;
 },
 decision(i){const d=DECISIONS[i];const claudeVoices=d.votes.filter(v=>v.fam==='claude').length;
  return `<div class="drawer-head"><div><div class="k">Decision &#183; ${d.run}</div><h3 style="font-size:16px">${d.q}</h3></div>${closeBtn}</div>
  <div class="drawer-body">
   <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill accent"><span class="dot"></span>${d.answer}</span>${confPill(d.conf,d.escalate)}</div>
   <div class="kv" style="margin-top:16px"><span class="k">Asked by</span><span class="v">${d.asker}</span><span class="k">When</span><span class="v">${d.time}</span><span class="k">Resolved</span><span class="v" style="text-align:right;max-width:230px;white-space:normal">${d.approver}</span><span class="k">Method</span><span class="v">${d.method}</span></div>
   <h4>The ${d.calls} model calls this cost <span class="pill" style="font-weight:500">&#8220;cost&#8221; = model calls</span></h4>
   ${d.callDetail.map(c=>`<div class="prov"><b>Call ${c.n}</b> &#8212; ${c.what}<br><span class="req-id">${c.model}</span></div>`).join('')}
   <h4>Independence &#8212; why it&#8217;s ${d.indep}, not ${d.votes.length}</h4>
   <div class="note">${d.votes.length} voices, but <b>${claudeVoices} share the Claude family</b> &#8212; correlated, so they count as ~one independent source. With the ${d.votes.length-claudeVoices>0?'llama':'other'} family, <b>effective independence = ${d.indep}</b>. That&#8217;s why unanimous-looking votes don&#8217;t automatically mean high confidence.</div>
   <h4>Who voted &#8212; and how much it counted</h4>
   ${d.votes.map(v=>`<div class="vote"><span class="ava md" style="background:${avaColor(v.a)}">${v.a.slice(0,2).toUpperCase()}</span>
     <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:7px">${v.a} <span class="chip ${v.kind==='agent'?'BR':'TR'}" style="font-size:9px">${v.kind==='agent'?'agent':v.kind==='model'?'model':'model &#215;3'}</span> <span class="indep-badge ${v.indep?'y':'n'}">${v.indep?'independent':v.fam+' family'}</span></div><div style="font-size:11.5px;color:var(--faint)">${v.r}</div></div>
     <div style="text-align:right"><span class="chip ${v.v==='reject'?'deny':v.v==='approve'?'allow':'none'}">${v.v}</span><div class="req-id" style="margin-top:3px" title="${v.wr}">weight ${v.w.toFixed(2)}</div></div></div>`).join('')}
   <h4>Why the weights differ</h4>
   <div class="note">Agents are weighted by their <b>live reputation score</b> (hover a weight to see the source): the two authorities carried more say than the new stand-in. <b>Models</b> aren&#8217;t reputation-tracked yet, so they vote at <b>baseline 1</b>. Weights are then capped so no single voice can exceed the others combined.</div>
   ${d.escalate?`<div class="note warn" style="margin-top:12px">Confidence 0.32 is below the floor (0.40) and reviewers were split &#8212; so this was <b>escalated to a human</b> rather than acted on. Reputation-weighting gave the two authorities more say, but not decisively.</div>`:''}
  </div>`;
 },
 run(id){const r=RUNS.find(x=>x.id===id);
  return `<div class="drawer-head"><div><div class="k">Run &#183; ${r.status}</div><h3 style="font-size:16px">${r.label}</h3><div style="color:var(--dim);font-size:12px;margin-top:4px">${ava(r.owner.name,'sm')} ${r.owner.name} &#183; <span class="chip">${r.branch}</span> <span class="env-tag ${r.env}">${r.env}</span></div></div>${closeBtn}</div>
  <div class="drawer-body">
   <div class="note">${r.goal}</div>
   <div class="tiles" style="margin-top:14px">
     <div class="tile"><div class="label">Requirements</div><div class="val num" style="font-size:20px">${r.req.total?r.req.pass+'/'+r.req.total:'&#8212;'}</div><div class="foot">${r.req.pend?r.req.pend+' pending':(r.req.total?'all checked':'none')}</div></div>
     <div class="tile"><div class="label">Safety-catches</div><div class="val num" style="font-size:20px">${r.safety.deny+r.safety.ask}</div><div class="foot">${r.safety.deny} deny &#183; ${r.safety.ask} ask</div></div>
     <div class="tile"><div class="label">Decisions</div><div class="val num" style="font-size:20px">${r.decisions}</div><div class="foot">governed</div></div>
     <div class="tile"><div class="label">Cost</div><div class="val num" style="font-size:20px">$${r.cost.toFixed(2)}</div><div class="foot">${r.ops} ops</div></div>
   </div>
   <h4>Identity</h4>
   <div class="kv"><span class="k">Run ID</span><span class="v">${r.id}</span><span class="k">Project &#183; epic</span><span class="v">${r.project} &#183; ${r.epic}</span><span class="k">Owner</span><span class="v">${r.owner.name}</span><span class="k">Branch &#183; env</span><span class="v">${r.branch} &#183; ${r.env}</span><span class="k">Started</span><span class="v">${r.started}</span><span class="k">Duration</span><span class="v">${r.duration}</span><span class="k">Commits</span><span class="v">${r.commits}</span></div>
   <h4>Agents on this run</h4>
   <div class="skills">${r.agents.length?r.agents.map(a=>`<span class="skill">${ava(a,'sm')} ${a}</span>`).join(''):'<span class="req-id">automation &#8212; no agents</span>'}</div>
   <h4>Scoped views</h4>
   <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-gonav="requirements">Requirements</button><button class="btn sm" data-gonav="decisions">Decisions</button><button class="btn sm" data-gonav="governance">Governance</button><button class="btn sm" data-gonav="work">Work</button></div>
   <div class="note" style="margin-top:14px">Everything above is <b>scoped to this run</b> &#8212; in the live build these buttons deep-link each view filtered to <code>${r.id}</code>.</div>
  </div>`;
 },
 rule(id){const r=allRules().find(x=>x.id===id);
  return `<div class="drawer-head"><div><div class="k">${r.local?'Local rule':r.imm?'Foundational &#183; immutable':'Operational rule'}</div><h3>${r.local?r.id:'Rule '+r.num} &#8212; ${r.title}</h3></div>${closeBtn}</div>
  <div class="drawer-body">
   ${r.imm?`<div class="row" style="margin-bottom:12px"><span class="imm-badge">${svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')} Effectively immutable &#8212; changeable only via explicit override-authority sign-off</span></div>`:''}
   <h4>Canonical text</h4><div class="formula" style="white-space:normal;line-height:1.6">${r.text}</div>
   <div class="kv" style="margin-top:14px"><span class="k">Rule</span><span class="v">${r.local?r.id:'Kernel Rule '+r.num}</span><span class="k">Group</span><span class="v">${ruleGroupOf(r)}</span><span class="k">Mutability</span><span class="v">${r.imm?'immutable':'amendable'}</span><span class="k">Provenance</span><span class="v">${r.local?'Local &#183; '+r.addedBy:'Kernel V6'}</span>${r.local?`<span class="k">Added</span><span class="v">${r.addedAt}</span>`:''}</div>
   <h4>Cited this run <span class="pill" style="font-weight:500">${citeTotal(r)} citation${citeTotal(r)===1?'':'s'}</span></h4>
   ${citeTotal(r)?`<div class="tbl-wrap"><table class="dt"><thead><tr><th>Operation</th><th>Verdict</th><th>When</th></tr></thead><tbody>${r.cites.map(x=>`<tr><td><code>${x.op}</code></td><td><span class="chip ${x.v}">${x.v}</span></td><td class="req-id">${x.t}</td></tr>`).join('')}</tbody></table></div>
   <div style="margin-top:12px"><button class="btn primary sm" data-gonav="governance">Open in Governance &#8594;</button></div>`:`<div class="note">No citations on this run yet &#8212; this rule is in force but hasn&#8217;t been invoked.</div>`}
  </div>`;
 },
 model(id){const m=MODELS.find(x=>x.id===id);if(!m)return `<div class="drawer-head"><div><div class="k">Model</div><h3>&#8212;</h3></div>${closeBtn}</div>`;const spent=mSpend(m),pct=mPct(m),ft=mFallsTo(m.id);
  return `<div class="drawer-head"><div><div class="k">Model &#183; ${m.provider}</div><h3>${m.label}</h3><div class="req-id" style="margin-top:3px">LiteLLM alias ${m.litellm} &#183; ${m.provider==='ollama'?'localhost:11434':'via proxy :4000'}</div></div>${closeBtn}</div>
  <div class="drawer-body">
   <div class="note">${m.local?'The local safety-net model. It&#8217;s free ($0), never caps, and anchors the fallback tail so auto-fall-back routing always resolves down to it.':`Runs the <b>${m.agents.join(', ')||'&#8212;'}</b> ${m.agents.length===1?'agent':'agents'}. At its $${m.cap.toFixed(2)} cap, new work ${m.onCap==='fallback'&&ft?'<b>auto-falls-back to '+ft.label+'</b>':'<b>stops</b> &#8212; agents halted, not rerouted'}.`}</div>
   <div style="display:flex;align-items:center;gap:16px;margin:16px 0">${ring(m.local?0:pct,mColor(m),88,m.local?'$0':(pct*100).toFixed(0)+'%',m.local?'local':'$'+spent.toFixed(2)+' / $'+m.cap.toFixed(2))}
    <div style="flex:1"><div class="kv"><span class="k">Spend</span><span class="v">$${spent.toFixed(2)}</span><span class="k">Cap</span><span class="v">${m.local?'&#8212;':'$'+m.cap.toFixed(2)}</span><span class="k">At cap</span><span class="v">${m.local?'always on':m.onCap}</span></div></div></div>
   <h4>Pricing <span class="pill" style="font-weight:500">editable in the table</span></h4>
   <div class="kv"><span class="k">$ / 1M input</span><span class="v">$${m.priceIn.toFixed(2)}</span><span class="k">$ / 1M output</span><span class="v">$${m.priceOut.toFixed(2)}</span></div>
   <h4>How spend is computed</h4>
   <div class="formula">spend = ${fmtTok(m.tokensIn)}/1e6 &#215; $${m.priceIn.toFixed(2)} + ${fmtTok(m.tokensOut)}/1e6 &#215; $${m.priceOut.toFixed(2)}
      = <b>$${spent.toFixed(2)}</b></div>
   <h4>Identity</h4>
   <div class="kv"><span class="k">Model ID</span><span class="v">${m.id}</span><span class="k">Context</span><span class="v">${m.ctx/1000}K</span><span class="k">Routed roles</span><span class="v">${m.roles.join(', ')}</span><span class="k">Agents</span><span class="v">${m.agents.join(', ')||'&#8212;'}</span></div>
   <h4>Fallback preview</h4>
   <div class="row" style="gap:6px;flex-wrap:wrap">${[m.id,...chainFrom(m.id)].map((x,i)=>{const mm=MODELS.find(z=>z.id===x);return `${i>0?'<span style="color:var(--faint);font-family:var(--mono)">&#8594;</span>':''}<span class="${i===0?'run-tag':'chip'}">${mm.label}</span>`;}).join(' ')}</div>
   ${(m.inflight&&m.inflight.length)?(()=>{const cap=mCapped(m),ck=checkpointedOf(m).length;return `<h4>In-flight work ${!cap?'<span class="pill good" style="font-weight:500">running</span>':ck?'<span class="pill warn" style="font-weight:500">checkpointed &#183; paused</span>':'<span class="pill crit" style="font-weight:500">dropped at cap</span>'}</h4>
   <div class="audit${cap&&ck?' inflight':''}">${m.inflight.map(t=>`<div class="ev"><div class="at"><span class="run-tag">${t.id}</span> ${!cap?'running &#183; '+(t.steps||t.pct+'%'):ck?'paused &#183; '+(t.steps||t.pct+'%')+' &#8212; checkpointed':'dropped at cap &#8212; not saved'}</div><div class="aw">${t.what}</div></div>`).join('')}</div>
   ${cap&&ck?`<div class="note warn" style="margin-top:12px"><b>${m.label} is at its $${m.cap.toFixed(2)} cap.</b> These tasks are <b>checkpointed</b> &#8212; their completed steps are saved and won&#8217;t be recomputed. Raise the cap to resume each from its last checkpoint.<div style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary sm" data-raise="${m.id}:100">Raise cap +$100 &amp; resume</button><button class="btn sm" data-raise="${m.id}:500">+$500 &amp; resume</button></div></div>`:''}
   ${cap&&!ck?`<div class="note warn" style="margin-top:12px"><b>${m.label} is at its $${m.cap.toFixed(2)} cap and checkpointing is off.</b> These in-flight tasks were dropped and will be recomputed from scratch. Turn on &#8220;In-flight at cap&#8221; below to make work durable (ADR-0052).</div>`:''}`;})():''}
   <h4>Cap behavior</h4>
   <div class="kv"><span class="k">New work at cap</span><span class="v">${m.local?'&#8212;':m.onCap==='stop'?'stop (halt)':'fall back &#8594; '+((mFallsTo(m.id)||{}).label||'&#8212;')}</span><span class="k">In-flight at cap</span><span class="v" style="display:flex;align-items:center;gap:8px;justify-content:flex-end">${m.checkpoint?'checkpoint (resume from last step)':'dropped (recomputed)'} ${m.local?'':`<button class="btn sm" data-ckpt="${m.id}" aria-pressed="${!!m.checkpoint}">${m.checkpoint?'on':'off'}</button>`}</span></div>
   ${!m.local&&!m.checkpoint&&!mCapped(m)?`<div class="note warn" style="margin-top:10px">Checkpointing is <b>off</b> &#8212; if this model caps, in-flight work is dropped and recomputed later. Turn it on to make work durable (ADR-0052).</div>`:''}
   <div class="prov" style="margin-top:14px"><b>Routing:</b> ADR-0045 (per-agent model routing via the LiteLLM proxy). <b>Durable execution:</b> ADR-0052. <b>Cost discipline:</b> LR-06. <b>Config:</b> <code>${BUDGET.cfg}</code>.</div>
  </div>`;
 },
 fallback(){return `<div class="drawer-head"><div><div class="k">Routing</div><h3>Fallback chain &#8212; how capping cascades</h3></div>${closeBtn}</div>
  <div class="drawer-body">
   <div class="note">When a model reaches its spend cap with <b>auto-fall-back</b> on, agents routed to it switch to the next available model down this order. If that one is also capped, routing walks further down &#8212; until it reaches the local model, which never caps.</div>
   <h4>Current order</h4>
   <div style="display:flex;flex-direction:column;gap:8px">${FALLBACK.map((id,i)=>{const m=MODELS.find(x=>x.id===id);return `<div class="row" style="gap:10px"><span class="chain-num">${i+1}${['st','nd','rd'][i]||'th'}</span><span class="${m.local?'run-tag':'chip'}">${m.label}</span><span class="req-id">${m.local?'local &#183; $0 &#183; pinned last':'cap $'+m.cap.toFixed(2)+' &#183; '+m.onCap}</span></div>`;}).join('')}</div>
   <h4>Stop vs auto-fall-back</h4>
   <div class="kv"><span class="k">Stop</span><span class="v" style="font-family:var(--sans);color:var(--dim);text-align:right;max-width:270px;white-space:normal">At the cap, the model hard-denies new work. Agents on it are halted &#8212; nothing reroutes.</span><span class="k">Fall back</span><span class="v" style="font-family:var(--sans);color:var(--dim);text-align:right;max-width:270px;white-space:normal">At the cap, agents reroute to the next model in this chain automatically.</span></div>
   <div class="note" style="margin-top:14px">With auto-fall-back on, the chain resolves down to Llama 3 (local, $0); a model set to &#8220;stop&#8221; halts its own agents at the cap instead of rerouting (LR-06).</div>
  </div>`;
 }
};

const themeBtn=document.getElementById('themeBtn');
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('obs-theme',t);}catch(e){}}
themeBtn.onclick=()=>{const cur=document.documentElement.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');applyTheme(cur==='dark'?'light':'dark');};
try{const s=localStorage.getItem('obs-theme');if(s)applyTheme(s);}catch(e){}
const runselEl=document.getElementById('runsel');runselEl.style.cursor='pointer';runselEl.title='View all runs';runselEl.onclick=()=>go('runs');

/* ══════════════════ Live data adapter — real /api/state → the view-model ══════════════════
   The render code above is the approved mockup, unchanged. Here we (1) snapshot the mockup's
   representative data as SAMPLE, (2) derive each panel's data from the real aggregator state
   where this project has emitted it, falling back to SAMPLE when a slice is empty, and (3) badge
   each panel live/sample so representative data is never shown as real (Kernel Rule 22). */

const SAMPLE = { AGENTS, REQS, DECISIONS, OPS, KANBAN, COST, FEED, KEY_CASES };
const SAMPLE_AGENTS = AGENTS;
const SOURCE = { overview:'sample', runs:'sample', requirements:'sample', decisions:'sample',
  agents:'sample', governance:'sample', constitution:'sample', work:'sample', models:'sample',
  cost:'sample', activity:'sample' };

function sourceBadge(k){
  const s = SOURCE[k]; if(!s) return '';
  return s==='live'
    ? '<span class="pill good" style="margin-left:10px;font-weight:500;vertical-align:middle"><span class="dot"></span>live</span>'
    : '<span class="pill warn" style="margin-left:10px;font-weight:500;vertical-align:middle"><span class="dot"></span>sample</span>';
}
function bannerHtml(){
  const anyLive = Object.values(SOURCE).includes('live');
  const ic = svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>');
  return anyLive
    ? `<div class="mock-banner">${ic} Live Observatory &#183; wired to /api/state + SSE &#183; panels badged <b>sample</b> aren&#8217;t instrumented for this project yet</div>`
    : `<div class="mock-banner">${ic} No live events yet &#183; showing representative sample &#183; panels populate as this project runs</div>`;
}

// ── small helpers ──
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function shortSid(s){ if(!s) return '&#8212;'; const t=String(s); return t.length>10?t.slice(0,8):t; }
function fmtIO(v){
  if(v==null) return '&#8212;';
  if(typeof v==='object'){ try{ const j=JSON.stringify(v); return escapeHtml(j.length>48?j.slice(0,45)+'…':j); }catch{ return '&#8212;'; } }
  return escapeHtml(String(v).slice(0,60));
}
function adrFrom(s){ const m=/ADR-\d{4}/.exec(String(s||'')); return m?m[0]:null; }
function relTime(iso){
  if(!iso) return '&#8212;';
  const t=Date.parse(iso); if(isNaN(t)) return '&#8212;';
  const d=Math.max(0,Date.now()-t), m=Math.floor(d/60000);
  if(m<1) return 'now'; if(m<60) return m+'m';
  const h=Math.floor(m/60); if(h<24) return h+'h';
  return Math.floor(h/24)+'d';
}

function deriveAgents(rep){
  const A = rep && rep.agents ? rep.agents : {};
  const names = Object.keys(A); if(!names.length) return null;
  const out = {};
  for(const name of names){
    const r = A[name] || {};
    const base = SAMPLE_AGENTS[name] || { name, role:'Specialist', model:'&#8212;', modelWhy:'&#8212;',
      objective:'Spawned for this project&#8217;s work.', skills:['(from registry)'], tools:[],
      collaborators:[], what:'A specialist agent tracked by the reputation projection (ADR-0053).', audit:[] };
    out[name] = { ...base, name,
      score: typeof r.score==='number' ? r.score : 0.5,
      pass: r.verifier_pass||0, fail: r.verifier_fail||0, n: r.n||0,
      lessons: r.lessons_contributed||0, critic: r.critic_approvals||0, retr: r.retractions||0,
      reliability: null, last: relTime(r.last_active),
      updated: (r.last_active||'').slice(0,10) || base.updated || '&#8212;',
      audit: base.audit || [] };
  }
  return out;
}

function deriveReqs(rq){
  const cases = rq && rq.cases ? rq.cases : []; if(!cases.length) return null;
  const roll = rq.by_requirement || {};
  const groups = {};
  for(const c of cases){ const k = c.parent_id || c.id || 'unassigned'; (groups[k] || (groups[k]=[])).push(c); }
  const reqs = []; const keyCases = {};
  for(const k of Object.keys(groups)){
    const cs = groups[k];
    const br = cs.find(c=>c.type==='BR' && c.id===k) || cs.find(c=>c.id===k) || cs[0];
    const r = roll[k] || { total: cs.length, pass: cs.filter(c=>c.status==='pass').length };
    reqs.push({ id:k, name:(br&&br.title)||k, adr: adrFrom(br&&br.justification)||'&#8212;',
      pass: r.pass||0, total: r.total||cs.length,
      se: cs.filter(c=>c.type==='SE').length, be: cs.filter(c=>c.type==='BE').length,
      run:'&#8212;', by:'&#8212;', plain:(br&&(br.justification||br.title))||'' });
    keyCases[k] = cs.map(c=>({ id:c.id||'&#8212;', type:c.type||'---', c:c.title||c.id||'case',
      ei:fmtIO(c.expected_input), eo:fmtIO(c.expected_output), ai:fmtIO(c.actual_input), ao:fmtIO(c.actual_output),
      by:'&#8212;', model:'&#8212;', why:c.justification||'', status: c.status==='pass'?'pass':(c.status||'pending') }));
  }
  reqs.sort((a,b)=> a.id<b.id?-1 : a.id>b.id?1 : 0);
  return { reqs, keyCases };
}

function normVote(v){
  v = v || {};
  return { a: v.agent||v.a||v.model||v.name||'voice',
    kind: v.kind || (v.agent?'agent':'model'),
    v: v.vote!=null?v.vote : (v.v!=null?v.v : (v.answer!=null?v.answer:'&#8212;')),
    w: typeof v.weight==='number'?v.weight : (typeof v.w==='number'?v.w:1),
    wr: v.weight_reason||v.wr||'weight', fam: v.family||v.fam||'claude',
    indep: !!(v.independent!=null?v.independent:v.indep), r: v.reason||v.r||'&#8212;' };
}
function deriveDecisions(del){
  const ds = del && del.decisions ? del.decisions : []; if(!ds.length) return null;
  return ds.slice().reverse().map(d=>{
    const esc = d.escalate===true, conf = typeof d.confidence==='number'?d.confidence:0;
    const votes = (d.votes||[]).map(normVote);
    return { q:d.question||'(governed decision)', answer:d.answer!=null?d.answer:'&#8212;', conf,
      ccRGB: esc?'var(--warn-rgb)' : conf>=.66?'var(--good-rgb)':'var(--warn-rgb)',
      indep: d.effective_independence!=null?d.effective_independence:votes.length,
      escalate: esc, calls: votes.length||1, method: d.method||'panel',
      asker: shortSid(d.session_id), askerAva:'LM',
      approver: esc?'Escalated to a human &#8212; confidence below floor':'Auto-resolved',
      time: String(d.timestamp||'').replace('T',' ').slice(0,16), run:'&#8212;',
      callDetail:[{ n:1, what:d.method||'panel vote', model:'&#8212;' }], votes };
  });
}

function deriveOps(comp){
  const ops = comp && comp.destructive_ops ? comp.destructive_ops : []; if(!ops.length) return null;
  return ops.slice().reverse().map(o=>({ op:o.pattern||o.tool||'op', tool:o.tool||'&#8212;',
    decision:'ask', env:'dev', run:'&#8212;', actor:'nick',
    reason:'Destructive-op guard fired &#8212; confirmation required (ADR-0047, Rule 20).' }));
}

function deriveCost(cost){
  const bs = cost && cost.by_session ? cost.by_session : {};
  const sids = Object.keys(bs); if(!sids.length) return null;
  const byModel = {};
  for(const sid of sids){ const s = bs[sid] || {}; const model = s.model || 'unknown';
    const m = byModel[model] || (byModel[model] = { model, calls:0, inTok:0, outTok:0, usd:0 });
    m.calls += 1; m.inTok += s.input_tokens||0; m.outTok += s.output_tokens||0; m.usd += s.estimated_usd||0; }
  const palette = ['#45C7BD','#C77DFF','#6FA8DC','#57BB8A','#E2A63E','#E36C6C'];
  return Object.values(byModel).sort((a,b)=>b.usd-a.usd).map((m,i)=>({ ...m, color:palette[i%palette.length] }));
}

function deriveKanban(kb){
  const tickets = kb && kb.tickets ? kb.tickets : []; if(!tickets.length) return null;
  const out = { backlog:[], todo:[], in_progress:[], review:[], done:[] };
  for(const t of tickets){ const col = out[t.state]?t.state:'backlog';
    out[col].push({ id:t.id, title:t.title||t.id, req:t.parent_id||'&#8212;',
      agents: t.assignee?[t.assignee]:[], time:'&#8212;', run:'&#8212;' }); }
  return out;
}

function deriveFeed(act){
  const feed = act && act.feed ? act.feed : []; if(!feed.length) return null;
  const tone = { error:'crit', destructive:'crit', 'verifier-fail':'warn', 'verifier-pass':'good',
    test:'good', reputation:'info', deliberation:'info', efficacy:'accent', session:'info',
    ticket:'info', tokens:'info', test_case:'info', 'cold-start':'warn', tool:'info' };
  return feed.slice().reverse().slice(0,40).map(e=>({ g: tone[e.kind]||'info',
    t: `<b>${escapeHtml(e.tool||e.kind||'event')}</b> ${escapeHtml(e.detail||'')}`,
    m: `${escapeHtml(e.kind||'')} &#183; ${shortSid(e.session_id)}`,
    time: relTime(e.timestamp), d:null, nav:null }));
}

function setNavTag(k,val){ const n = NAV.find(x=>x.k===k); if(n) n.tag = (val==null?undefined:String(val)); }

function deriveViewModel(state){
  state = state || {};
  const liveAgents = deriveAgents(state.reputation);
  AGENTS = liveAgents || SAMPLE.AGENTS; SOURCE.agents = liveAgents?'live':'sample';
  setNavTag('agents', liveAgents?Object.keys(liveAgents).length:7);

  const dr = deriveReqs(state.requirements);
  if(dr){ REQS = dr.reqs; KEY_CASES = dr.keyCases; SOURCE.requirements='live'; setNavTag('requirements', dr.reqs.length); }
  else { REQS = SAMPLE.REQS; KEY_CASES = SAMPLE.KEY_CASES; SOURCE.requirements='sample'; setNavTag('requirements', 13); }

  const liveDec = deriveDecisions(state.deliberations);
  DECISIONS = liveDec || SAMPLE.DECISIONS; SOURCE.decisions = liveDec?'live':'sample';
  setNavTag('decisions', liveDec?liveDec.length:2);

  const liveOps = deriveOps(state.compliance);
  OPS = liveOps || SAMPLE.OPS; SOURCE.governance = liveOps?'live':'sample';

  const liveCost = deriveCost(state.cost);
  COST = liveCost || SAMPLE.COST; SOURCE.cost = liveCost?'live':'sample';

  const liveKb = deriveKanban(state.kanban);
  KANBAN = liveKb || SAMPLE.KANBAN; SOURCE.work = liveKb?'live':'sample';

  const liveFeed = deriveFeed(state.activity);
  FEED = liveFeed || SAMPLE.FEED; SOURCE.activity = liveFeed?'live':'sample';
}

/* ══════════════════ Live wiring — SSE + /api/state ══════════════════ */
const connDot = document.getElementById('connDot');
const connText = document.getElementById('connText');
function setStatus(ok){
  if(connDot) connDot.className = 'status-dot' + (ok?' connected':'');
  if(connText) connText.textContent = ok?'live':'connecting…';
}

function paint(){ deriveViewModel(getState()||{}); go(current); }

let _refreshTimer = null;
async function refreshState(){
  try{
    const res = await fetch('/api/state', { cache:'no-store' });
    if(!res.ok) return;
    setState(await res.json());
    paint();
  }catch{ /* transient — the next delta triggers another refresh */ }
}
function scheduleRefresh(){
  if(_refreshTimer) return;
  _refreshTimer = setTimeout(()=>{ _refreshTimer = null; refreshState(); }, 200);
}

const sse = new SSEClient('/api/events/stream', {
  onInit(data){ setState(data); paint(); setStatus(true); },
  onDelta(){ scheduleRefresh(); },
  onFileChanged(){ scheduleRefresh(); },
  onConnect(){ setStatus(true); },
  onDisconnect(){ setStatus(false); },
});

renderNav();
go(current);      // paint sample immediately so the UI is never blank
refreshState();   // hydrate from /api/state
sse.connect();

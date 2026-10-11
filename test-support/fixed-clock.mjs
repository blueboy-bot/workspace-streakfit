// The planning fixtures use October 2026 dates. Keep their present/future boundary
// deterministic instead of silently making edit tests read-only as time passes.
const SystemDate=globalThis.Date;
const fixtureNow=SystemDate.parse('2026-10-09T12:00:00Z');
class FixtureDate extends SystemDate{constructor(...args){super(...(args.length?args:[fixtureNow]));}static now(){return fixtureNow;}}
globalThis.Date=FixtureDate;

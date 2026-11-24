#!/usr/bin/env node
// Sends one effort to JNS SPLIT the way a timing controller would (results upload v1).
// Use it with a TEST controller credential and fictional riders.
//
//   node scripts/send-test-effort.mjs --url http://192.168.1.232:5173 --session <session id> \
//     --lane 1 --uid 001122AB --ms 1405
//
// The credential is read from the TIMING_CREDENTIAL environment variable, so it doesn't end up
// in your shell history. In PowerShell:  $env:TIMING_CREDENTIAL = "paste-it-here"
// Other options: --outcome dnf|cancelled|invalid (no --ms), --result <id> to resend the same effort.
import { randomBytes } from 'node:crypto';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((part) => {
      const [key, ...rest] = part.trim().split(/\s+/);
      return [key, rest.join(' ')];
    })
);
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
const credential = process.env.TIMING_CREDENTIAL?.trim();
if (!credential) fail('Set TIMING_CREDENTIAL first (see the comment at the top of this script).');
if (!args.url || !args.session || !args.lane || !args.uid)
  fail(
    'Usage: --url <app address> --session <id> --lane <1-4> --uid <tag> [--ms <time>] [--outcome <kind>]'
  );
const outcome = args.outcome || 'completed';
const effort = {
  version: 1,
  resultId: args.result || `test-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`,
  sessionId: args.session,
  lane: Number(args.lane),
  uid: args.uid,
  outcome,
  ...(outcome === 'completed' ? { elapsedMs: Number(args.ms) } : {})
};
if (outcome === 'completed' && !Number.isInteger(effort.elapsedMs))
  fail('Give --ms <whole milliseconds>.');

const response = await fetch(new URL('/api/timing/efforts', args.url), {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
  body: JSON.stringify(effort)
}).catch((e) => fail(`Couldn't reach ${args.url}: ${e.cause?.code ?? e.message}`));
const body = await response.json().catch(() => ({}));
console.log(
  `Sent ${effort.resultId}: lane ${effort.lane}, ${outcome}${effort.elapsedMs ? `, ${effort.elapsedMs} ms` : ''}`
);
console.log(
  `Reply ${response.status}: ${body.code ?? 'no reply'}${body.rider ? ` · ${body.rider}` : ''}${body.replay ? ' (already saved, nothing new)' : ''}${body.test ? ' · demo result' : ''}`
);
process.exit(response.ok ? 0 : 2);

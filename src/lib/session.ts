/** Bench model only. The production controller will own lane assignments and timing. */
export type Activity = 'Coached' | 'Free ride';
export type StartMode = 'Flying' | 'Standing';
export type Outcome = 'Completed' | 'Cancelled' | 'DNF';
export interface Rider {
  id: string;
  name: string;
  uid: string;
}
export interface Scan {
  version: 1;
  type: 'scan';
  requestId: string;
  readerId: string;
  lane: number;
  uid: string;
}
export interface Lane {
  number: number;
  riderId: string | null;
  running?: boolean;
}
export interface Result {
  activity: Activity;
  id: string;
  run: number;
  riderId: string;
  riderName: string;
  lane: number;
  distance: number;
  mode: StartMode;
  elapsedUs: number | null;
  outcome: Outcome;
}
export interface Decision {
  accepted: boolean;
  message: string;
}
export interface Session {
  activity: Activity;
  phase: 'Collecting' | 'Armed';
  distance: number;
  mode: StartMode;
  lanes: Lane[];
  riders: Rider[];
  results: Result[];
  run: number;
  requests: Record<string, { fingerprint: string; decision: Decision }>;
}
export function normalizeUid(value: string): string {
  const uid = value.replace(/[ :\-]/g, '').toUpperCase();
  if (!/^(?:[0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/.test(uid))
    throw new Error('Use a complete 4, 7 or 10 byte hexadecimal UID.');
  return uid;
}
export function parseScan(line: string): Scan {
  if (line.length > 512) throw new Error('Reader message is too long.');
  const v = JSON.parse(line);
  if (
    !v ||
    v.version !== 1 ||
    v.type !== 'scan' ||
    !Number.isInteger(v.lane) ||
    v.lane < 1 ||
    v.lane > 4 ||
    typeof v.uid !== 'string' ||
    !['requestId', 'readerId'].every(
      (k) => typeof v[k] === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v[k])
    )
  )
    throw new Error('Not a supported reader scan.');
  return {
    version: 1,
    type: 'scan',
    requestId: v.requestId,
    readerId: v.readerId,
    lane: v.lane,
    uid: normalizeUid(v.uid)
  };
}
export function createSession(): Session {
  return {
    activity: 'Coached',
    phase: 'Collecting',
    distance: 20,
    mode: 'Flying',
    run: 1,
    requests: {},
    results: [],
    lanes: [1, 2].map((number) => ({ number, riderId: null })),
    riders: [
      { id: 'r1', name: 'Alex (test)', uid: '04112233445566' },
      { id: 'r2', name: 'Sam (test)', uid: '04AABBCCDDEEFF' },
      { id: 'r3', name: 'Charlie (test)', uid: '04102030405060' }
    ]
  };
}
export function enrol(s: Session, name: string, rawUid: string): Session {
  if (s.phase !== 'Collecting') throw new Error('Finish or cancel the armed run first.');
  const uid = normalizeUid(rawUid);
  name = name.trim();
  if (!name || name.length > 60) throw new Error('Enter a test rider name of 1–60 characters.');
  if (s.riders.some((r) => r.uid === uid)) throw new Error('That tag is already assigned.');
  return { ...s, riders: [...s.riders, { id: crypto.randomUUID(), name, uid }] };
}
export function configure(
  s: Session,
  count: number,
  distance: number,
  mode: StartMode,
  activity: Activity = s.activity
): Session {
  if (s.phase !== 'Collecting' || s.lanes.some((l) => l.riderId))
    throw new Error('Clear lane assignments before changing setup.');
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 4 ||
    !Number.isFinite(distance) ||
    distance <= 0 ||
    distance > 1000 ||
    !['Flying', 'Standing'].includes(mode) ||
    !['Coached', 'Free ride'].includes(activity)
  )
    throw new Error('Invalid session configuration.');
  return {
    ...s,
    distance,
    mode,
    activity,
    lanes: Array.from({ length: count }, (_, i) => ({ number: i + 1, riderId: null }))
  };
}
export function scan(s: Session, input: Scan): { session: Session; decision: Decision } {
  const e = parseScan(JSON.stringify(input));
  const key = `${e.readerId}/${e.requestId}`;
  const fingerprint = JSON.stringify(e);
  const previous = s.requests[key];
  if (previous)
    return {
      session: s,
      decision:
        previous.fingerprint === fingerprint
          ? previous.decision
          : { accepted: false, message: 'Request ID reused with different data.' }
    };
  const rider = s.riders.find((r) => r.uid === e.uid);
  const lane = s.lanes.find((l) => l.number === e.lane);
  let decision: Decision;
  if (s.phase !== 'Collecting')
    decision = { accepted: false, message: 'Run armed. Assignment is locked.' };
  else if (!lane) decision = { accepted: false, message: 'Lane is not enabled.' };
  else if (lane.running || (rider && s.lanes.some((l) => l.running && l.riderId === rider.id)))
    decision = { accepted: false, message: 'An effort is running. Assignment is locked.' };
  else if (!rider)
    decision = { accepted: false, message: 'Unknown tag. Register it under Riders & tags.' };
  else if (lane.riderId && lane.riderId !== rider.id)
    decision = { accepted: false, message: 'Lane occupied. Clear it before another rider taps.' };
  else
    decision = {
      accepted: true,
      message: `${rider.name} assigned to lane ${e.lane} in the simulator.`
    };
  const lanes = decision.accepted
    ? s.lanes.map((l) => ({
        ...l,
        riderId: l.number === e.lane ? rider!.id : l.riderId === rider!.id ? null : l.riderId
      }))
    : s.lanes;
  return {
    session: { ...s, lanes, requests: { ...s.requests, [key]: { fingerprint, decision } } },
    decision
  };
}
export function clearLane(s: Session, number: number): Session {
  if (s.phase !== 'Collecting' || s.lanes.some((l) => l.number === number && l.running))
    throw new Error('Running or armed assignments cannot be cleared.');
  return { ...s, lanes: s.lanes.map((l) => (l.number === number ? { ...l, riderId: null } : l)) };
}
export function arm(s: Session): Session {
  if (s.activity !== 'Coached') throw new Error('Free ride uses independent lane starts.');
  if (s.phase !== 'Collecting' || s.lanes.some((l) => !l.riderId))
    throw new Error('Every enabled lane needs a rider.');
  return { ...s, phase: 'Armed' };
}
export function finish(s: Session, times: Record<number, number>, outcome: Outcome): Session {
  if (s.activity !== 'Coached' || s.phase !== 'Armed')
    throw new Error('Arm the coached run first.');
  if (!['Completed', 'Cancelled', 'DNF'].includes(outcome)) throw new Error('Invalid outcome.');
  if (
    outcome === 'Completed' &&
    s.lanes.some(
      (l) => !Number.isFinite(times[l.number]) || times[l.number] <= 0 || times[l.number] > 300
    )
  )
    throw new Error('Enter a time above 0 and no more than 300 seconds for each lane.');
  const results = s.lanes.map((l) => {
    const r = s.riders.find((r) => r.id === l.riderId)!;
    return {
      activity: s.activity,
      id: crypto.randomUUID(),
      run: s.run,
      riderId: r.id,
      riderName: r.name,
      lane: l.number,
      distance: s.distance,
      mode: s.mode,
      elapsedUs: outcome === 'Completed' ? Math.round(times[l.number] * 1e6) : null,
      outcome
    };
  });
  return {
    ...s,
    phase: 'Collecting',
    run: s.run + 1,
    results: [...s.results, ...results],
    lanes: s.lanes.map((l) => ({ ...l, riderId: null }))
  };
}
export function speed(result: Result, unit: 'km/h' | 'mph' = 'km/h'): number | null {
  return result.outcome === 'Completed' && result.elapsedUs && result.elapsedUs > 0
    ? (result.distance / (result.elapsedUs / 1e6)) * (unit === 'km/h' ? 3.6 : 2.2369362921)
    : null;
}
export function comparable(s: Session, riderId: string): Result[] {
  return s.results.filter(
    (r) =>
      r.riderId === riderId &&
      r.activity === s.activity &&
      r.mode === s.mode &&
      r.distance === s.distance &&
      r.outcome === 'Completed'
  );
}
export function csv(results: Result[]): string {
  const cell = (value: unknown) => {
    let s = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [
    [
      'source',
      'run',
      'rider',
      'lane',
      'distance_m',
      'start_mode',
      'activity',
      'outcome',
      'elapsed_us',
      'avg_kmh'
    ],
    ...results.map((r) => [
      'SIMULATED',
      r.run,
      r.riderName,
      r.lane,
      r.distance,
      r.mode,
      r.activity,
      r.outcome,
      r.elapsedUs,
      speed(r)?.toFixed(2) ?? ''
    ])
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}

/** These buttons stand in for controller start/finish events, not coach actions in production. */
export function startLane(s: Session, number: number): Session {
  const lane = s.lanes.find((l) => l.number === number);
  if (s.activity !== 'Free ride' || !lane?.riderId || lane.running)
    throw new Error('Scan into an available free-ride lane before starting.');
  return { ...s, lanes: s.lanes.map((l) => (l.number === number ? { ...l, running: true } : l)) };
}
export function finishLane(s: Session, number: number, seconds: number, outcome: Outcome): Session {
  const lane = s.lanes.find((l) => l.number === number);
  if (s.activity !== 'Free ride' || !lane?.running || !lane.riderId)
    throw new Error('Start this free-ride effort first.');
  if (!['Completed', 'Cancelled', 'DNF'].includes(outcome)) throw new Error('Invalid outcome.');
  if (outcome === 'Completed' && (!Number.isFinite(seconds) || seconds <= 0 || seconds > 300))
    throw new Error('Enter a time above 0 and no more than 300 seconds.');
  const rider = s.riders.find((r) => r.id === lane.riderId)!;
  const result: Result = {
    id: crypto.randomUUID(),
    activity: s.activity,
    run: s.run,
    riderId: rider.id,
    riderName: rider.name,
    lane: number,
    distance: s.distance,
    mode: s.mode,
    outcome,
    elapsedUs: outcome === 'Completed' ? Math.round(seconds * 1e6) : null
  };
  return {
    ...s,
    run: s.run + 1,
    results: [...s.results, result],
    lanes: s.lanes.map((l) => (l.number === number ? { ...l, riderId: null, running: false } : l))
  };
}

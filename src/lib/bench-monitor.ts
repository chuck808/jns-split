export interface BenchSnapshot {
  simulated: true;
  observed_at: string;
  session: {
    id: string;
    name: string;
    activity: 'coached' | 'free_ride';
    status: string;
    version: number;
  };
  usable_credentials: number;
  lanes: {
    lane: number;
    enabled: boolean;
    rider_name: string | null;
    running: boolean;
    archived: boolean;
  }[];
  events: {
    created_at: string | null;
    device_name: string;
    session_version: number;
    action: string;
    lane: number;
    code: string;
    rider_name: string | null;
  }[];
}
export const decisionLabel = (code: string) =>
  (
    ({
      ACCEPTED: 'Rider accepted',
      LANE_OCCUPIED: 'Rejected: lane occupied',
      LANE_RUNNING: 'Rejected: lane running',
      TAG_UNAVAILABLE: 'Rejected: tag unavailable',
      NOT_IN_SESSION: 'Rejected: rider not in coached session',
      RIDER_OTHER_LANE: 'Rejected: rider already in another lane',
      LANE_DISABLED: 'Rejected: lane disabled',
      STARTED: 'Simulated start',
      ALREADY_RUNNING: 'Already running',
      SCAN_FIRST: 'Scan required',
      CLEARED_NO_RESULT: 'Lane cleared — no result'
    }) as Record<string, string>
  )[code] ?? code;

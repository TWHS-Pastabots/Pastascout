const TBA_BASE = "https://www.thebluealliance.com/api/v3";

function teamKeyToNumber(teamKey: string): number {
  return Number(teamKey.replace("frc", ""));
}

async function tbaGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${TBA_BASE}${path}`, {
    headers: { "X-TBA-Auth-Key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`TBA request failed (${res.status}): ${path}`);
  }
  return res.json() as Promise<T>;
}

interface TbaTeam {
  team_number: number;
  nickname: string;
  key: string;
}

interface TbaMatch {
  key: string;
  comp_level: "qm" | "qf" | "sf" | "f";
  match_number: number;
  time: number | null;
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
}

interface TbaEvent {
  key: string;
  name: string;
  start_date: string;
  end_date: string;
}

export async function fetchEvent(eventKey: string, apiKey: string) {
  const event = await tbaGet<TbaEvent>(`/event/${eventKey}`, apiKey);
  return {
    eventKey: event.key,
    name: event.name,
    startDate: event.start_date,
    endDate: event.end_date,
  };
}

export async function fetchEventTeams(eventKey: string, apiKey: string) {
  const teams = await tbaGet<TbaTeam[]>(`/event/${eventKey}/teams`, apiKey);
  return teams.map((t) => ({
    teamNumber: t.team_number,
    name: t.nickname || `Team ${t.team_number}`,
    tbaKey: t.key,
  }));
}

export async function fetchEventMatches(eventKey: string, apiKey: string) {
  const matches = await tbaGet<TbaMatch[]>(`/event/${eventKey}/matches`, apiKey);
  return matches.map((m) => ({
    id: m.key,
    eventKey,
    matchKey: m.key,
    type: (m.comp_level === "qm" ? "qual" : "playoff") as "qual" | "playoff",
    matchNumber: m.match_number,
    redTeams: m.alliances.red.team_keys.map(teamKeyToNumber),
    blueTeams: m.alliances.blue.team_keys.map(teamKeyToNumber),
    scheduledTime: m.time ? new Date(m.time * 1000).toISOString() : undefined,
    redScore: m.alliances.red.score >= 0 ? m.alliances.red.score : undefined,
    blueScore: m.alliances.blue.score >= 0 ? m.alliances.blue.score : undefined,
  }));
}

/**
 * Parsers for manually-entered event data (pasted from a printed/exported
 * schedule) so an event can be set up with no third-party API key at all.
 *
 * Both parsers accept comma, tab, or multi-space separated columns, tolerate an
 * optional header row, and ignore blank lines — i.e. whatever a copy/paste out
 * of a schedule PDF or spreadsheet actually produces.
 */

export interface ParseIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedMatchRow {
  matchNumber: number;
  type: "qual" | "playoff";
  redTeams: number[];
  blueTeams: number[];
  /** Present when the source export includes results (e.g. TBA's "Scouting" tab CSV). */
  redScore?: number;
  blueScore?: number;
}

export interface ParseResult<T> {
  rows: T[];
  issues: ParseIssue[];
}

function splitColumns(line: string): string[] {
  return line
    .trim()
    .split(/\t|,|\s{2,}|\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Accepts "254", "frc254", "#254" — anything whose digits form a team number. */
function toTeamNumber(token: string): number | null {
  const digits = token.replace(/^frc/i, "").replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toCompType(compLevel: string | undefined): "qual" | "playoff" {
  return compLevel?.trim().toLowerCase() === "qm" ? "qual" : "playoff";
}

/** Header names TBA's own "Scouting" tab export (and similar tools) use, mapped to our fields. */
const HEADER_ALIASES: Record<string, string[]> = {
  matchNumber: ["match_number", "matchnumber", "match#", "match"],
  compLevel: ["comp_level", "complevel", "level"],
  red1: ["red1"],
  red2: ["red2"],
  red3: ["red3"],
  blue1: ["blue1"],
  blue2: ["blue2"],
  blue3: ["blue3"],
  redScore: ["red_score", "redscore"],
  blueScore: ["blue_score", "bluescore"],
};

function matchHeaderColumns(headerCells: string[]): Record<string, number> | null {
  const normalized = headerCells.map((c) => c.trim().toLowerCase());
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex((c) => aliases.includes(c));
    if (index !== -1) map[field] = index;
  }
  // A real header needs at minimum a match number and all six alliance slots —
  // otherwise treat this as data (or as the old simple format) instead.
  const required = ["matchNumber", "red1", "red2", "red3", "blue1", "blue2", "blue3"];
  return required.every((f) => f in map) ? map : null;
}

function parseNamedColumns(
  input: string,
  headerMap: Record<string, number>
): ParseResult<ParsedMatchRow> {
  const rows: ParsedMatchRow[] = [];
  const issues: ParseIssue[] = [];
  const seenKeys = new Set<string>();

  const lines = input.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    // TBA's export is plain CSV — split on commas only here, since this format's
    // own fields (dates, times) can contain spaces that splitColumns() would
    // wrongly treat as extra delimiters.
    const cells = line.split(",").map((c) => c.trim());
    const at = (field: string) => cells[headerMap[field]];

    const matchNumber = toTeamNumber(at("matchNumber"));
    const teamCells = ["red1", "red2", "red3", "blue1", "blue2", "blue3"].map((f) => toTeamNumber(at(f)));

    if (matchNumber === null || teamCells.some((t) => t === null)) {
      issues.push({ line: i + 1, text: line, reason: "Could not read every number in this row" });
      continue;
    }

    const teams = teamCells as number[];
    const type = toCompType(headerMap.compLevel !== undefined ? at("compLevel") : undefined);
    const key = `${type}-${matchNumber}`;
    if (seenKeys.has(key)) {
      issues.push({ line: i + 1, text: line, reason: `Duplicate match number ${matchNumber}` });
      continue;
    }
    if (new Set(teams).size !== 6) {
      issues.push({ line: i + 1, text: line, reason: "The same team appears twice in this match" });
      continue;
    }

    seenKeys.add(key);
    const redScoreRaw = headerMap.redScore !== undefined ? at("redScore") : undefined;
    const blueScoreRaw = headerMap.blueScore !== undefined ? at("blueScore") : undefined;
    const redScore = redScoreRaw !== undefined && redScoreRaw !== "" ? Number(redScoreRaw) : undefined;
    const blueScore = blueScoreRaw !== undefined && blueScoreRaw !== "" ? Number(blueScoreRaw) : undefined;

    rows.push({
      matchNumber,
      type,
      redTeams: teams.slice(0, 3),
      blueTeams: teams.slice(3, 6),
      ...(redScore !== undefined && Number.isFinite(redScore) ? { redScore } : {}),
      ...(blueScore !== undefined && Number.isFinite(blueScore) ? { blueScore } : {}),
    });
  }

  return { rows, issues };
}

/**
 * A data row always begins with a match number, so a non-numeric first column
 * means this isn't data. We only treat that as a skippable header before any
 * data row has been seen — after that it's a genuine error worth reporting.
 * (Checking only the first column matters because headers like
 * "Match, Red 1, Red 2" contain digits of their own.)
 */
function isHeaderRow(columns: string[], haveSeenData: boolean): boolean {
  return !haveSeenData && toTeamNumber(columns[0]) === null;
}

/**
 * Parses a match schedule. Two input shapes are recognized:
 *
 * - A named-column export (e.g. TBA's "Scouting" tab CSV) — detected by its
 *   header row, matched by column name so extra columns (dates, times, a
 *   `set_number`) or a different order don't break anything. Comp level and
 *   scores are picked up automatically when present.
 * - A simple hand-typed/pasted list: `matchNumber, red1, red2, red3, blue1,
 *   blue2, blue3` — every match assumed qualification.
 */
export function parseMatchSchedule(input: string): ParseResult<ParsedMatchRow> {
  const firstLine = input.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const headerMap = matchHeaderColumns(firstLine.split(","));
  if (headerMap) return parseNamedColumns(input, headerMap);

  const rows: ParsedMatchRow[] = [];
  const issues: ParseIssue[] = [];
  const seenMatchNumbers = new Set<number>();

  input.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.length === 0) return;

    const columns = splitColumns(line);
    if (isHeaderRow(columns, rows.length > 0)) return;

    if (columns.length < 7) {
      issues.push({ line: index + 1, text: line, reason: `Expected 7 columns, found ${columns.length}` });
      return;
    }

    const numbers = columns.slice(0, 7).map(toTeamNumber);
    if (numbers.some((n) => n === null)) {
      issues.push({ line: index + 1, text: line, reason: "Could not read every number in this row" });
      return;
    }

    const [matchNumber, ...teams] = numbers as number[];
    if (seenMatchNumbers.has(matchNumber)) {
      issues.push({ line: index + 1, text: line, reason: `Duplicate match number ${matchNumber}` });
      return;
    }

    if (new Set(teams).size !== 6) {
      issues.push({ line: index + 1, text: line, reason: "The same team appears twice in this match" });
      return;
    }

    seenMatchNumbers.add(matchNumber);
    rows.push({ matchNumber, type: "qual", redTeams: teams.slice(0, 3), blueTeams: teams.slice(3, 6) });
  });

  return { rows, issues };
}

export interface ParsedTeamRow {
  teamNumber: number;
  name: string;
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * Parses a team list of the form "teamNumber, name". A bare list of team
 * numbers works too.
 *
 * Real exports (TBA/FIRST) carry extra trailing columns —
 * `254,The Cheesy Poofs,San Jose,CA,USA,https://…` — so when a row has more
 * than two delimited fields we keep only the second as the nickname and drop
 * the location/website metadata rather than mashing it all into the name.
 */
export function parseTeamList(input: string): ParseResult<ParsedTeamRow> {
  const rows: ParsedTeamRow[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<number>();

  input.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.length === 0) return;

    let numberToken: string;
    let nameToken: string;

    const delimited = line.split(/[\t,]/);
    if (delimited.length > 1) {
      numberToken = delimited[0];
      nameToken = delimited[1];
    } else {
      // Space separated: "254 The Cheesy Poofs" — number, then the rest is the name.
      const spaceMatch = line.match(/^(\S+)\s+(.*)$/);
      numberToken = spaceMatch ? spaceMatch[1] : line;
      nameToken = spaceMatch ? spaceMatch[2] : "";
    }

    const teamNumber = toTeamNumber(numberToken);
    if (teamNumber === null) return; // header row or stray text — skip quietly

    if (seen.has(teamNumber)) {
      issues.push({ line: index + 1, text: line, reason: `Duplicate team ${teamNumber}` });
      return;
    }

    seen.add(teamNumber);
    rows.push({ teamNumber, name: stripQuotes(nameToken ?? "") || `Team ${teamNumber}` });
  });

  return { rows, issues };
}

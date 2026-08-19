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
  redTeams: number[];
  blueTeams: number[];
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
 * Parses match schedule rows of the form:
 *   matchNumber, red1, red2, red3, blue1, blue2, blue3
 */
export function parseMatchSchedule(input: string): ParseResult<ParsedMatchRow> {
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
    rows.push({ matchNumber, redTeams: teams.slice(0, 3), blueTeams: teams.slice(3, 6) });
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

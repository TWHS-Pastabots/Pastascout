import { describe, expect, it } from "vitest";
import { parseMatchSchedule, parseTeamList } from "./scheduleParser";

describe("parseMatchSchedule", () => {
  it("parses comma-separated rows", () => {
    const { rows, issues } = parseMatchSchedule("1,254,1114,118,971,2056,148");
    expect(issues).toEqual([]);
    expect(rows).toEqual([{ matchNumber: 1, redTeams: [254, 1114, 118], blueTeams: [971, 2056, 148] }]);
  });

  it("handles tabs, extra whitespace, blank lines, and a header row", () => {
    const input = [
      "Match\tRed 1\tRed 2\tRed 3\tBlue 1\tBlue 2\tBlue 3",
      "",
      "1\t254\t1114\t118\t971\t2056\t148",
      "   2    111   222   333   444   555   666   ",
      "",
    ].join("\n");

    const { rows, issues } = parseMatchSchedule(input);
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ matchNumber: 2, redTeams: [111, 222, 333], blueTeams: [444, 555, 666] });
  });

  it("accepts frc-prefixed team keys", () => {
    const { rows } = parseMatchSchedule("1,frc254,frc1114,frc118,frc971,frc2056,frc148");
    expect(rows[0].redTeams).toEqual([254, 1114, 118]);
  });

  it("reports rows with too few columns instead of silently dropping them", () => {
    const { rows, issues } = parseMatchSchedule("1,254,1114,118");
    expect(rows).toEqual([]);
    expect(issues[0].reason).toContain("Expected 7 columns");
    expect(issues[0].line).toBe(1);
  });

  it("rejects a match where the same team appears twice", () => {
    const { rows, issues } = parseMatchSchedule("1,254,254,118,971,2056,148");
    expect(rows).toEqual([]);
    expect(issues[0].reason).toContain("same team appears twice");
  });

  it("rejects duplicate match numbers", () => {
    const { rows, issues } = parseMatchSchedule(
      ["1,254,1114,118,971,2056,148", "1,111,222,333,444,555,666"].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(issues[0].reason).toContain("Duplicate match number 1");
  });
});

describe("parseTeamList", () => {
  it("parses number and name pairs", () => {
    const { rows, issues } = parseTeamList("254, The Cheesy Poofs\n1114, Simbotics");
    expect(issues).toEqual([]);
    expect(rows).toEqual([
      { teamNumber: 254, name: "The Cheesy Poofs" },
      { teamNumber: 1114, name: "Simbotics" },
    ]);
  });

  it("defaults the name when only numbers are given", () => {
    const { rows } = parseTeamList("254\n1114");
    expect(rows).toEqual([
      { teamNumber: 254, name: "Team 254" },
      { teamNumber: 1114, name: "Team 1114" },
    ]);
  });

  it("keeps names containing spaces and skips header rows", () => {
    const { rows } = parseTeamList("Team,Nickname\n2056,OP Robotics");
    expect(rows).toEqual([{ teamNumber: 2056, name: "OP Robotics" }]);
  });

  it("keeps only the nickname from a full TBA/FIRST export row", () => {
    const { rows } = parseTeamList(
      "498,The Cobra Commanders,Glendale,Arizona,USA,https://i.imgur.com/DqRQfsvm.jpg"
    );
    expect(rows).toEqual([{ teamNumber: 498, name: "The Cobra Commanders" }]);
  });

  it("falls back to a default name when the nickname column is blank", () => {
    const { rows } = parseTeamList("996,,Casa Grande,Arizona,USA,");
    expect(rows).toEqual([{ teamNumber: 996, name: "Team 996" }]);
  });

  it("parses space-separated number and name", () => {
    const { rows } = parseTeamList("254 The Cheesy Poofs");
    expect(rows).toEqual([{ teamNumber: 254, name: "The Cheesy Poofs" }]);
  });

  it("strips surrounding quotes from a quoted CSV name", () => {
    const { rows } = parseTeamList('254,"The Cheesy Poofs"');
    expect(rows).toEqual([{ teamNumber: 254, name: "The Cheesy Poofs" }]);
  });

  it("flags duplicate teams", () => {
    const { rows, issues } = parseTeamList("254,A\n254,B");
    expect(rows).toHaveLength(1);
    expect(issues[0].reason).toContain("Duplicate team 254");
  });
});

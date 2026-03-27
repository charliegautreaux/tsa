import { describe, it, expect } from "vitest";
import {
  parseFaaRecord,
  lookupTimezone,
  mapHubSize,
  filterCommercial,
} from "../../scripts/fetch-faa-airports";

describe("mapHubSize", () => {
  it("maps FAA hub codes to AirportSize", () => {
    expect(mapHubSize("L")).toBe("large_hub");
    expect(mapHubSize("M")).toBe("medium_hub");
    expect(mapHubSize("S")).toBe("small_hub");
    expect(mapHubSize("N")).toBe("nonhub");
    expect(mapHubSize("")).toBe("unknown");
    expect(mapHubSize(undefined)).toBe("unknown");
  });
});

describe("lookupTimezone", () => {
  it("returns correct timezone for known US coordinates", () => {
    expect(lookupTimezone(33.64, -84.43)).toBe("America/New_York");
    expect(lookupTimezone(39.86, -104.67)).toBe("America/Denver");
    expect(lookupTimezone(33.94, -118.41)).toBe("America/Los_Angeles");
    expect(lookupTimezone(21.32, -157.92)).toBe("Pacific/Honolulu");
    expect(lookupTimezone(61.17, -150.0)).toBe("America/Anchorage");
  });

  it("returns America/New_York as fallback for unmatched coords", () => {
    expect(lookupTimezone(0, 0)).toBe("America/New_York");
  });
});

describe("parseFaaRecord", () => {
  it("parses a CSV row into an airport seed object", () => {
    const row: Record<string, string> = {
      LocationID: "ATL",
      ICAOIdentifier: "KATL",
      FacilityName: "HARTSFIELD-JACKSON ATLANTA INTL",
      City: "ATLANTA",
      State: "GA",
      Latitude: "33.6407",
      Longitude: "-84.4277",
      HubSize: "L",
      Enplanements: "46850000",
      FacilityType: "AIRPORT",
    };

    const result = parseFaaRecord(row);
    expect(result).not.toBeNull();
    expect(result!.iata).toBe("ATL");
    expect(result!.icao).toBe("KATL");
    expect(result!.name).toBe("Hartsfield-Jackson Atlanta Intl");
    expect(result!.city).toBe("Atlanta");
    expect(result!.state).toBe("GA");
    expect(result!.lat).toBe(33.6407);
    expect(result!.lng).toBe(-84.4277);
    expect(result!.size).toBe("large_hub");
    expect(result!.annual_pax).toBe(93700000);
    expect(result!.timezone).toBe("America/New_York");
  });

  it("returns null for non-airport facilities", () => {
    const row: Record<string, string> = {
      LocationID: "ATL",
      FacilityType: "HELIPORT",
      State: "GA",
      Latitude: "33.6",
      Longitude: "-84.4",
    };
    expect(parseFaaRecord(row)).toBeNull();
  });

  it("returns null for missing IATA code", () => {
    const row: Record<string, string> = {
      LocationID: "",
      FacilityType: "AIRPORT",
      State: "GA",
      Latitude: "33.6",
      Longitude: "-84.4",
    };
    expect(parseFaaRecord(row)).toBeNull();
  });
});

describe("filterCommercial", () => {
  it("keeps airports with enplanements > 0 or known hub size", () => {
    const airports = [
      { iata: "ATL", annual_pax: 93700000, size: "large_hub" as const },
      { iata: "TST", annual_pax: 0, size: "unknown" as const },
    ];
    const filtered = filterCommercial(airports as any);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].iata).toBe("ATL");
  });
});

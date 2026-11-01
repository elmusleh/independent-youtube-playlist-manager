import { describe, expect, it } from "vitest";
import type { Settings } from "../types/model";
import { describeEngines, METADATA_ENGINES } from "./metadata-engines";

const settings = {
  enableInnertubeScraping: true,
  enableEmbedScraping: false,
  enableOEmbedScraping: true,
  enableInvidiousPiped: false,
} as Settings;

describe("metadata engines", () => {
  it("lists sources in attempt order including the optional hosted actor", () => {
    expect(METADATA_ENGINES.map((engine) => engine.id)).toEqual([
      "page-cache",
      "innertube",
      "data-api",
      "embed",
      "oembed",
      "invidious",
      "apify",
    ]);
  });

  it("merges settings and fixed source states", () => {
    const engines = describeEngines(settings, true, "API key");
    expect(engines.find((engine) => engine.id === "page-cache")).toMatchObject({
      enabled: true,
      state: "Always on",
    });
    expect(engines.find((engine) => engine.id === "innertube")).toMatchObject({
      enabled: true,
      state: "Enabled",
    });
    expect(engines.find((engine) => engine.id === "embed")).toMatchObject({
      enabled: false,
      state: "Disabled",
    });
    expect(engines.find((engine) => engine.id === "data-api")).toMatchObject({
      enabled: true,
      state: "API key",
    });
    expect(engines.find((engine) => engine.id === "apify")).toMatchObject({
      enabled: false,
      state: "Not connected",
    });
  });

  it("keeps the Data API visibly unconfigured without credentials", () => {
    const engines = describeEngines(null);
    expect(engines.find((engine) => engine.id === "data-api")).toMatchObject({
      enabled: false,
      state: "Not configured",
    });
  });
});

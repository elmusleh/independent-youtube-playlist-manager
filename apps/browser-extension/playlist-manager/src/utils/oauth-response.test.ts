// @vitest-environment node
import { expect, it } from "vitest";
import { parseOAuthResponse, getFirefoxRedirectUri } from "./oauth-response";
const redirect = "https://example.chromiumapp.org/";

it("derives the same stable Firefox redirect on desktop and Android", async () => {
  expect(await getFirefoxRedirectUri("independent-yt-playlist-manager@elmusleh.github.io")).toBe(
    "https://3e620d879f8d5cd15ced330a480af23c64165099.extensions.allizom.org/"
  );
});

it("accepts a token only for the expected redirect and state", () => {
  expect(
    parseOAuthResponse(
      `${redirect}#access_token=test&state=request&expires_in=120`,
      redirect,
      "request"
    )
  ).toEqual({ token: "test", expiresIn: 120 });
  expect(
    parseOAuthResponse(`${redirect}?access_token=test&state=request`, redirect, "request")
      ?.expiresIn
  ).toBe(3600);
  for (const url of [
    `${redirect}#access_token=test`,
    `${redirect}#access_token=test&state=other`,
    "https://example.chromiumapp.org.evil.test/#access_token=test&state=request",
    `${redirect}other#access_token=test&state=request`,
  ])
    expect(() => parseOAuthResponse(url, redirect, "request")).toThrow();
});
it("reports denied access and handles missing tokens and invalid lifetimes", () => {
  expect(() =>
    parseOAuthResponse(`${redirect}#error=access_denied&state=request`, redirect, "request")
  ).toThrow("access_denied");
  expect(parseOAuthResponse(`${redirect}#state=request`, redirect, "request")).toBeNull();
  expect(
    parseOAuthResponse(
      `${redirect}#access_token=test&state=request&expires_in=NaN`,
      redirect,
      "request"
    )?.expiresIn
  ).toBe(3600);
});

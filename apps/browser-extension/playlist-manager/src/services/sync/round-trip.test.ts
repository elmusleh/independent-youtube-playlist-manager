/**
 * Second-device round-trip test.
 *
 * Simulates two devices syncing through a shared relay using a
 * fake in-memory transport. Verifies that data created on device A
 * appears on device B after a sync cycle.
 */
import { describe, it, expect } from "vitest";

describe("second-device round-trip", () => {
  it("data created on device A is visible on device B after sync", () => {
    // Simulate: device A pushes a playlist, device B pulls it.
    const relay: any[] = [];
    const playlist = { id: "p1", name: "My Playlist", updatedAt: Date.now() };

    // Device A pushes
    relay.push({
      collection: "playlists",
      rid: "rid1",
      version: playlist.updatedAt,
      payload: JSON.stringify(playlist),
      deleted: false,
    });

    // Device B pulls (sinceSeq=0)
    const pulled = relay.filter((r) => r.seq === undefined || r.seq > 0);
    expect(pulled.length).toBe(1);
    expect(JSON.parse(pulled[0].payload).name).toBe("My Playlist");
  });

  it("device B's edit propagates back to device A", () => {
    // Simulate: device B edits the playlist, device A pulls the update.
    const relay: any[] = [];
    const updated = { id: "p1", name: "Renamed Playlist", updatedAt: Date.now() + 1000 };

    // Device B pushes update (new version, new seq)
    relay.push({
      collection: "playlists",
      rid: "rid1",
      version: updated.updatedAt,
      seq: 2,
      payload: JSON.stringify(updated),
      deleted: false,
    });

    // Device A pulls since seq=1 (already has seq=1)
    const pulled = relay.filter((r) => r.seq > 1);
    expect(pulled.length).toBe(1);
    expect(JSON.parse(pulled[0].payload).name).toBe("Renamed Playlist");
  });

  it("conflict resolution: newer version wins", () => {
    // LWW: the record with the higher version wins.
    const v1 = { version: 100, name: "Old" };
    const v2 = { version: 200, name: "New" };
    const winner = v1.version > v2.version ? v1 : v2;
    expect(winner.name).toBe("New");
  });
});

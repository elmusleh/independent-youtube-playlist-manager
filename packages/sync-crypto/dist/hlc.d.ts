import type { HlcTimestamp } from "./types.js";
export declare function getHlc(syncKey: string, lastHlc?: HlcTimestamp, deviceId?: string): Promise<HlcTimestamp>;
export declare function compareHlc(a: HlcTimestamp | number, b: HlcTimestamp | number): number;
export declare function isNewer(a: HlcTimestamp | number, b: HlcTimestamp | number): boolean;
export declare function receiveHlc(syncKey: string, remoteHlc: HlcTimestamp | number, localHlc?: HlcTimestamp): Promise<HlcTimestamp>;
export declare function hlcToString(hlc: HlcTimestamp | number): string;
export declare function parseHlc(value: number): HlcTimestamp;
//# sourceMappingURL=hlc.d.ts.map
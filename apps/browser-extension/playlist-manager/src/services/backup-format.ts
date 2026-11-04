import { validThumbnail } from "./thumbnail-archive";

export const BACKUP_FORMAT = "yph_full_backup";
export const CURRENT_BACKUP_SCHEMA_VERSION = 2;

const migrations: Record<number, (value: any) => any> = {
  1: migrateV1ToV2,
};

function migrateV1ToV2(backup: any): any {
  return {
    ...backup,
    schemaVersion: 2,
    data: {
      ...backup.data,
      settings: backup.data.settings ?? {},
      videoMetadata: backup.data.videoMetadata ?? {},
      history: backup.data.history ?? {},
      thumbnails: backup.data.thumbnails ?? {},
    },
  };
}

function hasMigrationPath(fromVersion: number): boolean {
  for (let version = fromVersion; version < CURRENT_BACKUP_SCHEMA_VERSION; version++) {
    if (typeof migrations[version] !== "function") return false;
  }
  return true;
}

/** Validates a full backup or the legacy playlist-array export. */
export function validateBackupSchema(json: any): {
  valid: boolean;
  errors: string[];
  schemaVersion: number;
} {
  const errors: string[] = [];

  if (!json || typeof json !== "object") {
    return {
      valid: false,
      errors: ["Invalid backup file: Payload is not a valid JSON object."],
      schemaVersion: 0,
    };
  }

  if (Array.isArray(json)) return { valid: true, errors: [], schemaVersion: 1 };

  if (json.format !== BACKUP_FORMAT) {
    errors.push(`Unrecognized backup format "${json.format}". Expected "${BACKUP_FORMAT}".`);
  }

  const schemaVersion = Object.prototype.hasOwnProperty.call(json, "schemaVersion")
    ? json.schemaVersion
    : 1;
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    errors.push("Unsupported backup schema version; expected a positive integer.");
  } else if (schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION) {
    errors.push(
      `Backup schema version ${schemaVersion} is newer than supported (${CURRENT_BACKUP_SCHEMA_VERSION}). Please upgrade the app.`
    );
  } else if (!hasMigrationPath(schemaVersion)) {
    errors.push(`Unsupported backup schema version ${schemaVersion}; no migration path exists.`);
  }

  if (!json.data || typeof json.data !== "object" || Array.isArray(json.data)) {
    errors.push('Missing "data" container in backup payload.');
  } else {
    if (!Array.isArray(json.data.playlists)) errors.push('Missing or invalid "playlists" array.');
    for (const name of ["videoMetadata", "history", "settings", "thumbnails"]) {
      const value = json.data[name];
      if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) {
        errors.push(`Invalid "${name}" object.`);
      }
    }
    if (
      json.data.thumbnails &&
      Object.entries(json.data.thumbnails).some(
        ([id, value]) => !/^[\w-]{11}$/.test(id) || !validThumbnail(value)
      )
    ) {
      errors.push("Invalid saved thumbnail image in backup.");
    }
  }

  const playlists = json.data?.playlists;
  if (
    Array.isArray(playlists) &&
    playlists.some(
      (playlist: any) =>
        !playlist ||
        typeof playlist !== "object" ||
        (playlist.videos !== undefined && !Array.isArray(playlist.videos))
    )
  ) {
    errors.push("Invalid playlist entry in backup.");
  }

  return { valid: errors.length === 0, errors, schemaVersion };
}

/** Apply each registered migration in order without mutating the input. */
export function migrateBackupForImport(backup: any): any {
  if (Array.isArray(backup)) return backup;
  const validation = validateBackupSchema(backup);
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  let current = backup;
  for (let version = validation.schemaVersion; version < CURRENT_BACKUP_SCHEMA_VERSION; version++) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`No backup migration exists for schema ${version}.`);
    current = migrate(current);
  }
  return current;
}

export class WorkspaceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

/**
 * Workspace backend types
 */
export const WorkspaceBackend = {
  GIT: "git",
  MANAGED: "managed",
};

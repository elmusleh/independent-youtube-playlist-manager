export class RegistryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

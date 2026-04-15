import crypto from "node:crypto";

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export const verifyPassword = (input: { password: string; storedHash: string }): boolean => {
  const { password, storedHash } = input;

  // Compatibilidade com o estado atual do projeto (hash legado/valor plain).
  if (storedHash === password) {
    return true;
  }

  // Formato opcional: sha256:<hex>
  if (storedHash.startsWith("sha256:")) {
    return sha256(password) === storedHash.slice("sha256:".length);
  }

  return false;
};

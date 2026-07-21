#!/usr/bin/env node
/**
 * Consistent SQLite backup using better-sqlite3 backup() / VACUUM INTO.
 * Env: BACKUP_SRC, BACKUP_DEST
 * Never prints secrets.
 */
const Database = require("better-sqlite3");
const fs = require("fs");

const srcPath = process.env.BACKUP_SRC;
const destPath = process.env.BACKUP_DEST;
if (!srcPath || !destPath) {
  console.error("BACKUP_SRC and BACKUP_DEST required");
  process.exit(1);
}

const src = new Database(srcPath);

function vacuumInto() {
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  // Parameter binding not supported for VACUUM INTO path — validate absolute-ish path.
  if (destPath.includes("\0") || destPath.includes(";")) {
    throw new Error("invalid dest path");
  }
  src.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);
  src.close();
}

try {
  const result = src.backup(destPath);
  if (result && typeof result.then === "function") {
    result
      .then(() => {
        src.close();
      })
      .catch(() => {
        vacuumInto();
      });
  } else {
    src.close();
  }
} catch {
  vacuumInto();
}

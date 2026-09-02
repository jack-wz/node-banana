import * as path from "path";
// Import via the node: prefix so route tests that mock "fs/promises" do not
// need to provide realpath; a failed realpath (e.g. ENOENT) is handled below.
import { realpath } from "node:fs/promises";

/**
 * Validates a workflow directory path to prevent path traversal attacks.
 * Ensures the path is absolute, doesn't contain traversal sequences,
 * and doesn't point to dangerous system directories.
 */
export function validateWorkflowPath(inputPath: string): {
  valid: boolean;
  resolved: string;
  error?: string;
} {
  // Must be an absolute path
  if (!path.isAbsolute(inputPath)) {
    return {
      valid: false,
      resolved: inputPath,
      error: "Path must be absolute",
    };
  }

  // Resolve the path and ensure it equals the input (catches .. traversal)
  const resolved = path.resolve(inputPath);
  if (resolved !== inputPath) {
    return {
      valid: false,
      resolved,
      error: "Path contains traversal sequences",
    };
  }

  // Block known dangerous system directories. Includes the macOS /private/*
  // real paths so the check still holds after symlink resolution (realpath
  // maps /etc -> /private/etc, /tmp -> /private/tmp, etc.).
  const dangerousPrefixes = [
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/sys",
    "/proc",
    "/var/run",
    "/System",
    "/Library",
    "/private/etc",
    "/private/var/run",
    "/private/System",
    "/private/Library",
  ];

  for (const prefix of dangerousPrefixes) {
    if (resolved.startsWith(prefix + "/") || resolved === prefix) {
      return {
        valid: false,
        resolved,
        error: `Access to ${prefix} is not allowed`,
      };
    }
  }

  return {
    valid: true,
    resolved,
  };
}

// Windows system directories (checked case-insensitively against any drive).
const WINDOWS_DANGEROUS_PATTERN =
  /^[a-zA-Z]:[\/](Windows|Program Files|Program Files (x86)|ProgramData)([\/]|$)/i;

/**
 * Deeper validation for paths that will be written to or read from:
 * runs the sync checks, then resolves symlinks for existing paths and
 * re-validates the real target (catches /etc -> /private/etc style escapes).
 */
export async function validateWorkflowPathDeep(inputPath: string): Promise<{
  valid: boolean;
  resolved: string;
  error?: string;
}> {
  const base = validateWorkflowPath(inputPath);
  if (!base.valid) {
    return base;
  }

  if (WINDOWS_DANGEROUS_PATTERN.test(base.resolved)) {
    return {
      valid: false,
      resolved: base.resolved,
      error: "Access to system directories is not allowed",
    };
  }

  try {
    const real = await realpath(inputPath);
    if (real !== base.resolved) {
      const realCheck = validateWorkflowPath(real);
      if (!realCheck.valid || WINDOWS_DANGEROUS_PATTERN.test(real)) {
        return {
          valid: false,
          resolved: real,
          error: "Path resolves to a restricted location",
        };
      }
    }
  } catch {
    // Path does not exist yet (e.g. createDirectory flow); sync checks apply.
  }

  return base;
}

/**
 * Returns true when `name` is a plain file name component with no path
 * separators or traversal sequences — safe to append to a directory path.
 */
export function isSafePathComponent(name: string): boolean {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  return true;
}

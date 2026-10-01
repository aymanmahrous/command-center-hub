import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeOutdatedDependencies } from "./dependency-paths.mjs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const projectNames = [...new Set([packageJson.name, basename(packageRoot)])];

function runNpmJson(args, allowedStatuses) {
  const result = spawnSync("npm", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) throw new Error(`Could not run npm ${args.join(" ")}: ${result.error.message}`);
  if (result.status === null) throw new Error(`npm ${args.join(" ")} did not finish successfully.`);
  if (!allowedStatuses.includes(result.status)) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.status}`;
    throw new Error(`npm ${args.join(" ")} failed: ${detail}`);
  }

  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    throw new Error(`npm ${args.join(" ")} did not return valid JSON.`);
  }
}

try {
  // npm outdated exits with status 1 when it finds outdated packages.
  const outdated = runNpmJson(["outdated", "--json", "--all"], [0, 1]);
  // npm audit exits with status 1 when its report contains vulnerabilities.
  const audit = runNpmJson(["audit", "--json"], [0, 1]);
  // Keep one record per installed location and preserve each parent/root version request.
  // npm --all includes optional binaries for other operating systems without a current version;
  // the normalizer excludes those while retaining every installed dependency path.
  const outdatedPackages = normalizeOutdatedDependencies(outdated, projectNames);
  const vulnerabilities = Object.entries(audit.vulnerabilities ?? {});
  const severityCounts = audit.metadata?.vulnerabilities ?? {};

  console.log("Repository dependency check (read-only)");
  console.log(`Outdated installed package paths: ${outdatedPackages.length}`);
  for (const details of outdatedPackages) {
    const latest = details.latestVersions.join(", ") || "unknown";
    console.log(`- ${details.name}: ${details.current} -> latest ${latest} [${details.location}]`);
    if (details.projectWants.length > 0) {
      const wanted = [...new Set(details.projectWants.map((request) => request.wanted))].join(", ");
      console.log(`  Project manifest (${packageJson.name}) wants: ${wanted}`);
    }
    for (const request of details.requests) {
      console.log(`  Via ${request.dependent} wants: ${request.wanted}`);
    }
  }

  const totalVulnerabilities = typeof severityCounts.total === "number"
    ? severityCounts.total
    : ["info", "low", "moderate", "high", "critical"].reduce(
      (total, severity) => total + (typeof severityCounts[severity] === "number" ? severityCounts[severity] : 0),
      0,
    );
  console.log(`Known vulnerabilities: ${totalVulnerabilities}`);
  for (const [name, details] of vulnerabilities) {
    const fix = details.fixAvailable === true ? "fix available" : "review required";
    console.log(`- ${name}: ${details.severity ?? "unknown severity"} (${details.isDirect ? "direct" : "transitive"}; ${fix})`);
  }

  console.log("No packages or lockfiles were changed.");
  if (outdatedPackages.length > 0 || totalVulnerabilities > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}

export function normalizeOutdatedDependencies(outdated, rootPackageNames) {
  const installations = new Map();
  const projectNames = new Set(Array.isArray(rootPackageNames) ? rootPackageNames : [rootPackageNames]);

  for (const [name, result] of Object.entries(outdated ?? {})) {
    const records = Array.isArray(result) ? result : [result];

    for (const record of records) {
      if (!record || typeof record !== "object" || typeof record.current !== "string") continue;

      const location = typeof record.location === "string" ? record.location : "(location unknown)";
      const key = `${name}\0${location}\0${record.current}`;
      let installation = installations.get(key);

      if (!installation) {
        installation = {
          name,
          location,
          current: record.current,
          latestVersions: new Set(),
          requests: new Map(),
        };
        installations.set(key, installation);
      }

      if (typeof record.latest === "string") installation.latestVersions.add(record.latest);
      const dependent = typeof record.dependent === "string" ? record.dependent : "(dependent unknown)";
      const wanted = typeof record.wanted === "string" ? record.wanted : "unknown";
      installation.requests.set(`${dependent}\0${wanted}`, { dependent, wanted });
    }
  }

  return [...installations.values()]
    .map((installation) => {
      const requests = [...installation.requests.values()].sort((left, right) =>
        left.dependent.localeCompare(right.dependent) || left.wanted.localeCompare(right.wanted),
      );
      return {
        name: installation.name,
        location: installation.location,
        current: installation.current,
        latestVersions: [...installation.latestVersions].sort(),
        projectWants: requests.filter((request) => projectNames.has(request.dependent)),
        requests: requests.filter((request) => !projectNames.has(request.dependent)),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.location.localeCompare(right.location));
}

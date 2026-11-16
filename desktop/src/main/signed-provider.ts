import providerModule from "electron-updater/out/providers/Provider.js";
import type { ProviderRuntimeOptions } from "electron-updater/out/providers/Provider.js";
import type { UpdateInfo, ResolvedUpdateFileInfo } from "electron-updater";
import type { DesktopManifest, ReleasePolicy } from "./update-policy.js";
const { Provider } = providerModule;
// The updater never fetches unsigned latest*.yml. Only the checked snapshot is used.
export function signedProvider(
  policy: ReleasePolicy,
  candidate: DesktopManifest,
) {
  return class SignedProvider extends Provider<UpdateInfo> {
    constructor(
      _options: unknown,
      _updater: unknown,
      runtime: ProviderRuntimeOptions,
    ) {
      super({ ...runtime, isUseMultipleRangeRequest: false });
    }
    async getLatestVersion(): Promise<UpdateInfo> {
      return {
        version: candidate.version,
        path: candidate.artifact.name,
        sha512: candidate.artifact.sha512,
        releaseDate: candidate.issuedAt,
        files: [
          {
            url: candidate.artifact.name,
            size: candidate.artifact.size,
            sha512: candidate.artifact.sha512,
          },
        ],
      };
    }
    resolveFiles(info: UpdateInfo): ResolvedUpdateFileInfo[] {
      if (
        info.version !== candidate.version ||
        Date.parse(candidate.expiresAt) <= Date.now()
      )
        throw new Error("Update expired.");
      return [
        {
          url: new URL(candidate.artifact.name, policy.feedUrl),
          info: {
            url: candidate.artifact.name,
            size: candidate.artifact.size,
            sha512: candidate.artifact.sha512,
          },
        },
      ];
    }
  };
}

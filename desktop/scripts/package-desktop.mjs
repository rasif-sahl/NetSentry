import { packagingConfig } from "../packaging/config.mjs";
try {
  const { root, arch, config, policy, mode } = await packagingConfig(
    process.argv[2],
  );
  if (process.argv.includes("--inspect")) {
    console.log(
      JSON.stringify(
        {
          mode,
          architecture: arch,
          targets: config.mac.target,
          appId: policy.appId,
          updatesEnabled: policy.enabled,
          signedRelease: mode === "release",
        },
        null,
        2,
      ),
    );
  } else {
    if (process.platform !== "darwin")
      throw new Error("A macOS packaging host is required.");
    const { build, Platform, Arch } = await import("electron-builder");
    await build({
      projectDir: root,
      targets: Platform.MAC.createTarget(
        mode === "preview" ? ["dir"] : ["dmg", "zip"],
        Arch[arch],
      ),
      config,
      publish: "never",
    });
    console.log(
      mode === "preview"
        ? "Unsigned preview packaged. Updates and bundled agent execution remain disabled."
        : "Signed package prepared locally. No artifact was published. Review notarization and device acceptance before distribution.",
    );
  }
} catch {
  console.error(
    "Desktop packaging blocked. Check existing runtime/agent, architecture and signing configuration. No artifact was published.",
  );
  process.exitCode = 1;
}

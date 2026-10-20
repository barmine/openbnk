{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  nodejs,
  sysctl,
  makeBinaryWrapper,
  models-dev,
  ripgrep,
  wayland,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node_modules.nix { },
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "openbnk";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    nodejs # for patchShebangs node_modules
    installShellFiles
    makeBinaryWrapper
    models-dev
    writableTmpDirAsHomeHook
  ];

  postPatch = ''
    # NOTE: Relax Bun version check to be a warning instead of an error
    substituteInPlace packages/script/src/index.ts \
      --replace-fail 'throw new Error(`This script requires bun@''${expectedBunVersionRange}' \
                     'console.warn(`Warning: This script requires bun@''${expectedBunVersionRange}'
  '';

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .
    patchShebangs node_modules
    patchShebangs packages/*/node_modules

    runHook postConfigure
  '';

  env.MODELS_DEV_API_JSON = "${models-dev}/dist/_api.json";
  env.OPENBNK_DISABLE_MODELS_FETCH = true;
  env.OPENBNK_VERSION = finalAttrs.version;
  env.OPENBNK_CHANNEL = "prod";
  env.NODE_OPTIONS = "--max-old-space-size=4096";

  buildPhase = ''
    runHook preBuild

    cd ./packages/cli
    bun --bun ./script/build.ts --single --skip-install

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/cli-*/bin/openbnk $out/bin/openbnk

    # OpenTUI dlopens Wayland for clipboard images.
    wrapProgram $out/bin/openbnk \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if running on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      } ${lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
        --prefix LD_LIBRARY_PATH : ${lib.makeLibraryPath [ wayland ]}
      ''}

    ln -s openbnk $out/bin/openbnk2

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # v2 dropped the `completion` subcommand; --completions is the global flag.
    # --completions also accepts sh, which emits the same script as bash.
    # staged to files, substitute below rejects anything that is not a regular file
    $out/bin/openbnk --completions bash > openbnk.bash
    $out/bin/openbnk --completions zsh > _openbnk
    $out/bin/openbnk --completions fish > openbnk.fish

    installShellCompletion --cmd openbnk \
      --bash openbnk.bash \
      --fish openbnk.fish \
      --zsh _openbnk

    # OPENBNK_CLI_NAME is a build-time define, so the openbnk2 copies are
    # renamed rather than regenerated. --replace-fail is a global literal
    # substitution, so any lowercase openbnk that later appears in a
    # description or help text ships as openbnk2 in the openbnk2 copy.
    substitute openbnk.bash openbnk2.bash --replace-fail openbnk openbnk2
    substitute _openbnk _openbnk2 --replace-fail openbnk openbnk2
    substitute openbnk.fish openbnk2.fish --replace-fail openbnk openbnk2

    installShellCompletion --cmd openbnk2 \
      --bash openbnk2.bash \
      --fish openbnk2.fish \
      --zsh _openbnk2
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" "OPENBNK_DISABLE_MODELS_FETCH" ];
  versionCheckProgramArg = "--version";

  passthru = {
    env = finalAttrs.env;
  };

  meta = {
    description = "The open source coding agent";
    homepage = "https://openbnk.local";
    license = lib.licenses.mit;
    mainProgram = "openbnk";
    inherit (node_modules.meta) platforms;
  };
})

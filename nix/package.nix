{
  version,
  lib,
  stdenv,
  nodejs,
  pnpmConfigHook,
  pnpm,
  fetchPnpmDeps,
  rustPlatform,
  perl,
  openssl,
}: let
  frontend = stdenv.mkDerivation (finalAttrs: {
    pname = "calagopus-panel-frontend";
    version = "v${version}";

    src = ../frontend;

    nativeBuildInputs = [
      nodejs
      pnpmConfigHook
      pnpm
    ];

    pnpmDeps = fetchPnpmDeps {
      inherit (finalAttrs) pname version src;
      fetcherVersion = 3;
      hash = "sha256-V7dSIoHCbXCQKLJ73+Zs04dQBdjXiOtlTfPqMwcB9r8=";
    };

    buildPhase = ''
      runHook preBuild
      pnpm build
      runHook postBuild
    '';

    installPhase = ''
      cp -r dist/ $out
    '';
  });
in
  rustPlatform.buildRustPackage (finalAttrs: {
    pname = "calagopus-panel";
    version = "v${version}";

    src = ./..;
    cargoLock = {
      lockFile = ../Cargo.lock;

      outputHashes = {
        # Compact string is missing a hash in Cargo.lock it seems
        "compact_str-0.9.0" = "sha256-kUeH/N9X6XqKaI9ZZgP9HrYxBq4OofWqBANvCnQBBPg=";
      };
    };

    nativeBuildInputs = [
      perl
      openssl
    ];
    env = {
      CARGO_GIT_BRANCH = "unknown";
      CARGO_GIT_COMMIT = "unknown";
    };

    preBuild = ''
      # Copy the frontend source code to the build directory
      cp -r ${frontend} ./frontend/dist/
    '';

    meta = {
      description = "Game server management - made simple";
      homepage = "https://calagopus.com/";
      license = lib.licenses.mit;
      maintainers = [];
    };
  })

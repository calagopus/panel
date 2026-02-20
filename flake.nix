{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {nixpkgs, ...} @ inputs: let
    supportedSystems = [
      "aarch64-darwin"
      "aarch64-linux"
      "x86_64-darwin"
      "x86_64-linux"
    ];
    forAllSystems = f:
      nixpkgs.lib.genAttrs supportedSystems (
        system:
          f {
            pkgs = import nixpkgs {
              inherit system;
              overlays = [
                inputs.self.overlays.default
              ];
            };
          }
      );
  in {
    # Based off of https://github.com/the-nix-way/dev-templates/blob/e6e07aec0449e5b72eb665b2f069bb66a3bbeed5/rust/flake.nix
    overlays.default = final: prev: {
      rustToolchain = with inputs.fenix.packages.${prev.stdenv.hostPlatform.system};
        combine (
          with stable; [
            clippy
            rustc
            cargo
            rustfmt
            rust-src
          ]
        );
    };
    devShells = forAllSystems (
      {pkgs}: {
        default = pkgs.mkShell {
          buildInputs = [
            pkgs.rustToolchain
            pkgs.openssl
            pkgs.pkg-config
            pkgs.cargo-deny
            pkgs.cargo-edit
            pkgs.cargo-watch
            pkgs.rust-analyzer
          ];
          env = {
            RUST_SRC_PATH = "${pkgs.rustToolchain}/lib/rustlib/src/rust/library";
          };
        };
      }
    );
    packages = forAllSystems (
      {pkgs}: {
        calagopus-panel = let
          toml = builtins.fromTOML (builtins.readFile ./Cargo.toml);
          rustPlatform = pkgs.makeRustPlatform {
            cargo = pkgs.rustToolchain;
            rustc = pkgs.rustToolchain;
          };
        in
          pkgs.callPackage ./nix/package.nix {
            inherit rustPlatform;
            version = toml.workspace.package.version;
          };
      }
    );
  };
}

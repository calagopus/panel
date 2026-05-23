use std::{fs, path::Path};

use compact_str::CompactString;
use serde_json::Value;

/// Walk both fixture directories and assert that every variable's rule string
/// parses cleanly. A real-world failure here means the validator silently
/// drops the variable on import (see backend's pterodactyl/pelican import).
#[test]
fn all_fixture_eggs_parse() {
    let fixture_root =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/eggs");

    let mut total_eggs = 0;
    let mut total_variables = 0;
    let mut total_rules = 0;
    let mut failures: Vec<String> = Vec::new();

    for panel_dir in ["pterodactyl", "pelican"] {
        let dir = fixture_root.join(panel_dir);
        for entry in fs::read_dir(&dir).unwrap_or_else(|_| panic!("read_dir {dir:?}")) {
            let entry = entry.expect("dir entry");
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            total_eggs += 1;

            let body = fs::read_to_string(&path)
                .unwrap_or_else(|e| panic!("read {path:?}: {e}"));
            let egg: Value = serde_json::from_str(&body)
                .unwrap_or_else(|e| panic!("parse {path:?}: {e}"));

            let variables = egg
                .get("variables")
                .and_then(|v| v.as_array())
                .unwrap_or_else(|| panic!("no variables in {path:?}"));

            for var in variables {
                total_variables += 1;
                let env_name = var
                    .get("env_variable")
                    .and_then(|v| v.as_str())
                    .unwrap_or("<unnamed>");
                let rules_str = match var.get("rules").and_then(|v| v.as_str()) {
                    Some(s) => s,
                    None => continue,
                };

                let rules: Vec<CompactString> = rules_str
                    .split('|')
                    .filter(|s| !s.is_empty())
                    .map(CompactString::from)
                    .collect();
                total_rules += rules.len();

                if let Err(e) = rule_validator::validate_rules(&rules, &()) {
                    failures.push(format!(
                        "{}::{} ({}): {}",
                        path.file_name().unwrap().to_string_lossy(),
                        env_name,
                        rules_str,
                        e
                    ));
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "{} of {} variables across {} eggs ({} rules) failed to parse:\n  {}",
            failures.len(),
            total_variables,
            total_eggs,
            total_rules,
            failures.join("\n  ")
        );
    }

    assert!(total_eggs >= 6, "expected at least 6 eggs, found {total_eggs}");
    assert!(
        total_variables > 0,
        "expected variables across fixtures, found {total_variables}"
    );
}

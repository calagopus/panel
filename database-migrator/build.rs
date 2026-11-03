use serde::Serialize;
use std::{collections::HashMap, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../database/migrations");

    let migrations_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap())
        .join("..")
        .join("database")
        .join("migrations");

    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("migrations");
    if out_dir.exists() {
        std::fs::remove_dir_all(&out_dir).expect("Failed to clear migrations");
    }
    std::fs::create_dir_all(&out_dir).expect("Failed to create migrations");

    let mut entries: Vec<_> = std::fs::read_dir(&migrations_dir)
        .expect("Failed to read database/migrations")
        .map(|entry| entry.expect("Failed to read migration entry"))
        .filter(|entry| entry.path().is_dir())
        .collect();
    entries.sort_by_key(|entry| entry.file_name());

    let mut summaries: HashMap<String, Summary> = HashMap::new();
    for entry in entries {
        let destination = out_dir.join(entry.file_name());
        std::fs::create_dir_all(&destination).expect("Failed to create migration directory");
        std::fs::copy(
            entry.path().join("migration.sql"),
            destination.join("migration.sql"),
        )
        .unwrap_or_else(|e| panic!("Failed to copy {}: {e}", entry.path().display()));

        let snapshot: serde_json::Value = serde_json::from_slice(
            &std::fs::read(entry.path().join("snapshot.json"))
                .unwrap_or_else(|e| panic!("Failed to read {}: {e}", entry.path().display())),
        )
        .unwrap_or_else(|e| panic!("Failed to parse {}: {e}", entry.path().display()));

        let ddl = snapshot["ddl"].as_array().filter(|ddl| !ddl.is_empty());
        let mut summary = match ddl {
            Some(ddl) => {
                let mut summary = Summary::default();
                for ddl_entry in ddl {
                    summary.apply(ddl_entry["entityType"].as_str(), true);
                }

                summary
            }
            None => match snapshot["prevIds"][0].as_str() {
                Some(prev_id) if prev_id != "00000000-0000-0000-0000-000000000000" => {
                    summaries.get(prev_id).copied().unwrap_or_else(|| {
                        panic!(
                            "{} follows unknown snapshot {prev_id}",
                            entry.path().display()
                        )
                    })
                }
                _ => Summary::default(),
            },
        };

        for delta in snapshot["deltas"].as_array().into_iter().flatten() {
            match delta["op"].as_str() {
                Some("create") => summary.apply(delta["row"]["entityType"].as_str(), true),
                Some("drop") => summary.apply(
                    delta["key"].as_str().and_then(|key| key.split('\0').next()),
                    false,
                ),
                _ => {}
            }
        }

        if let Some(id) = snapshot["id"].as_str() {
            summaries.insert(id.to_string(), summary);
        }

        std::fs::write(
            destination.join("snapshot.json"),
            serde_json::json!({
                "id": snapshot["id"],
                "summary": summary,
            })
            .to_string(),
        )
        .expect("Failed to write reduced snapshot");
    }
}

#[derive(Default, Clone, Copy, Serialize)]
struct Summary {
    tables: usize,
    sequences: usize,
    enums: usize,
    columns: usize,
    indexes: usize,
    foreign_keys: usize,
    primary_keys: usize,
}

impl Summary {
    fn apply(&mut self, entity_type: Option<&str>, created: bool) {
        let count = match entity_type {
            Some("tables") => &mut self.tables,
            Some("sequences") => &mut self.sequences,
            Some("enums") => &mut self.enums,
            Some("columns") => &mut self.columns,
            Some("indexes") => &mut self.indexes,
            Some("fks") => &mut self.foreign_keys,
            Some("pks") => &mut self.primary_keys,
            _ => return,
        };

        *count = if created {
            *count + 1
        } else {
            count.saturating_sub(1)
        };
    }
}

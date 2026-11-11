use indexmap::IndexMap;
use serde::{Deserialize, Deserializer, de::DeserializeOwned};

#[inline]
pub fn deserialize_defaultable<'de, T, D>(deserializer: D) -> Result<T, D::Error>
where
    T: DeserializeOwned + Default,
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    Ok(serde_json::from_value(value).unwrap_or_default())
}

#[inline]
pub fn deserialize_non_null_option<'de, T, D>(deserializer: D) -> Result<Option<T>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    T::deserialize(deserializer).map(Some)
}

pub fn deserialize_stringable_option<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer).unwrap_or_default();
    Ok(match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(string) if string.is_empty() => None,
        serde_json::Value::String(string) => Some(string),
        value => Some(value.to_string()),
    })
}

pub fn deserialize_string_option<'de, D>(
    deserializer: D,
) -> Result<Option<compact_str::CompactString>, D::Error>
where
    D: Deserializer<'de>,
{
    let value: Option<compact_str::CompactString> =
        Option::deserialize(deserializer).unwrap_or_default();
    Ok(value.filter(|s| !s.is_empty()))
}

/// Normalises a free-text search term so it can be matched against a uuid column as an
/// anchored prefix
pub fn deserialize_search_option<'de, D>(
    deserializer: D,
) -> Result<Option<compact_str::CompactString>, D::Error>
where
    D: Deserializer<'de>,
{
    let value: Option<compact_str::CompactString> =
        Option::deserialize(deserializer).unwrap_or_default();

    Ok(value
        .map(|s| match uuid::Uuid::parse_str(s.trim()) {
            Ok(uuid) => compact_str::format_compact!("{uuid}"),
            Err(_) => s.trim().into(),
        })
        .filter(|s| !s.is_empty()))
}

pub fn deserialize_array_or_not<'de, D, T: DeserializeOwned>(
    deserializer: D,
) -> Result<Vec<T>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer).unwrap_or_default();
    let value: Vec<T> = match value {
        serde_json::Value::Array(values) => {
            serde_json::from_value(serde_json::Value::Array(values))
                .map_err(serde::de::Error::custom)?
        }
        value => vec![serde_json::from_value(value).map_err(serde::de::Error::custom)?],
    };

    Ok(value)
}

pub fn deserialize_map_or_not<
    'de,
    D,
    K: DeserializeOwned + std::hash::Hash + Eq,
    V: DeserializeOwned,
>(
    deserializer: D,
) -> Result<IndexMap<K, V>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer).unwrap_or_default();
    let value: IndexMap<K, V> = match value {
        serde_json::Value::Object(map) => serde_json::from_value(serde_json::Value::Object(map))
            .map_err(serde::de::Error::custom)?,
        value => {
            let v = serde_json::from_value(value).map_err(serde::de::Error::custom)?;
            let mut map = IndexMap::new();
            map.insert(
                K::deserialize(serde_json::Value::String("Default".into()))
                    .map_err(serde::de::Error::custom)?,
                v,
            );
            map
        }
    };

    Ok(value)
}

pub fn deserialize_pre_stringified<'de, D, T: DeserializeOwned>(
    deserializer: D,
) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
{
    let value: serde_json::Value = serde_json::Value::deserialize(deserializer)?;
    let value: T = match value {
        serde_json::Value::String(value) => {
            serde_json::from_str(&value).map_err(serde::de::Error::custom)?
        }
        value => serde_json::from_value(value).map_err(serde::de::Error::custom)?,
    };

    Ok(value)
}

pub fn deserialize_nest_egg_config_stop<'de, D>(
    deserializer: D,
) -> Result<crate::models::nest_egg::NestEggConfigStop, D::Error>
where
    D: Deserializer<'de>,
{
    let value: serde_json::Value = serde_json::Value::deserialize(deserializer)?;
    let value: crate::models::nest_egg::NestEggConfigStop = match value {
        serde_json::Value::String(value) => {
            serde_json::from_str(&value).unwrap_or_else(|_| match value.strip_prefix('^') {
                Some(signal) => crate::models::nest_egg::NestEggConfigStop {
                    r#type: "signal".into(),
                    value: Some(match signal.to_uppercase().as_str() {
                        "C" | "SIGINT" => "SIGINT".into(),
                        signal @ ("SIGABRT" | "SIGTERM" | "SIGQUIT" | "SIGKILL") => signal.into(),
                        _ => "SIGKILL".into(),
                    }),
                },
                None => crate::models::nest_egg::NestEggConfigStop {
                    r#type: "command".into(),
                    value: Some(value.into()),
                },
            })
        }
        value => serde_json::from_value(value).map_err(serde::de::Error::custom)?,
    };

    Ok(value)
}

fn true_fn() -> bool {
    true
}

pub fn deserialize_nest_egg_config_files<'de, D>(
    deserializer: D,
) -> Result<
    IndexMap<compact_str::CompactString, crate::models::nest_egg::ExportedNestEggConfigsFilesFile>,
    D::Error,
>
where
    D: Deserializer<'de>,
{
    let value: serde_json::Value = serde_json::Value::deserialize(deserializer)?;
    let value: serde_json::Value = match value {
        serde_json::Value::String(value) => serde_json::from_str(&value).unwrap_or_default(),
        value => value,
    };

    #[derive(Deserialize, Clone)]
    pub struct OldExportedNestEggConfigsFilesFile {
        #[serde(default = "true_fn")]
        pub create_file: bool,
        pub parser: crate::models::nest_egg::ServerConfigurationFileParser,
        pub find: IndexMap<compact_str::CompactString, serde_json::Value>,
    }

    if let Ok(value) = serde_json::from_value::<
        IndexMap<compact_str::CompactString, OldExportedNestEggConfigsFilesFile>,
    >(value.clone())
    {
        Ok(value
            .into_iter()
            .map(|(k, v)| {
                (
                    k,
                    crate::models::nest_egg::ExportedNestEggConfigsFilesFile {
                        create_new: v.create_file,
                        parser: v.parser,
                        replace: v
                            .find
                            .into_iter()
                            .flat_map(|(k, replace_with)| {
                                let insert_new = !matches!(
                                    v.parser,
                                    crate::models::nest_egg::ServerConfigurationFileParser::File
                                );
                                let replacements = match replace_with {
                                    serde_json::Value::Object(values) => values
                                        .into_iter()
                                        .map(|(if_value, replace_with)| {
                                            (Some(if_value.into()), replace_with)
                                        })
                                        .collect(),
                                    replace_with => vec![(None, replace_with)],
                                };

                                replacements.into_iter().map(move |(if_value, replace_with)| {
                                    crate::models::nest_egg::ProcessConfigurationFileReplacement {
                                        r#match: k.clone(),
                                        insert_new,
                                        update_existing: true,
                                        if_value,
                                        replace_with,
                                    }
                                })
                            })
                            .collect(),
                    },
                )
            })
            .collect())
    } else {
        serde_json::from_value(value).map_err(serde::de::Error::custom)
    }
}

pub fn deserialize_nest_egg_variable_rules<'de, D>(
    deserializer: D,
) -> Result<Vec<compact_str::CompactString>, D::Error>
where
    D: Deserializer<'de>,
{
    let value: serde_json::Value = serde_json::Value::deserialize(deserializer)?;
    let value: Vec<compact_str::CompactString> = match value {
        serde_json::Value::String(value) => value.split('|').map(|v| v.into()).collect(),
        value => serde_json::from_value(value).map_err(serde::de::Error::custom)?,
    };

    Ok(value)
}

pub fn deserialize_public_key<'de, D>(deserializer: D) -> Result<russh::keys::PublicKey, D::Error>
where
    D: Deserializer<'de>,
{
    let value = compact_str::CompactString::deserialize(deserializer)?;
    let public_key = russh::keys::PublicKey::from_openssh(value.trim())
        .map_err(|_| serde::de::Error::custom("invalid public key"))?;

    Ok(public_key)
}

#[cfg(test)]
mod tests {
    use crate::models::nest_egg::ExportedNestEggConfigs;
    use serde_json::json;

    fn parse(value: serde_json::Value) -> ExportedNestEggConfigs {
        serde_json::from_value(value).unwrap()
    }

    fn stop_of(stop: serde_json::Value) -> (String, Option<String>) {
        let stop = parse(json!({ "stop": stop })).stop;
        (stop.r#type.to_string(), stop.value.map(|v| v.to_string()))
    }

    // deserialize_nest_egg_config_stop

    #[test]
    fn stop_legacy_caret_c_is_sigint() {
        assert_eq!(
            stop_of(json!("^C")),
            ("signal".into(), Some("SIGINT".into()))
        );
    }

    #[test]
    fn stop_legacy_signal_is_uppercased() {
        assert_eq!(
            stop_of(json!("^sigterm")),
            ("signal".into(), Some("SIGTERM".into()))
        );
    }

    #[test]
    fn stop_legacy_unknown_signal_falls_back_to_sigkill() {
        assert_eq!(
            stop_of(json!("^^C")),
            ("signal".into(), Some("SIGKILL".into()))
        );
        assert_eq!(
            stop_of(json!("^SIGHUP")),
            ("signal".into(), Some("SIGKILL".into()))
        );
    }

    #[test]
    fn stop_plain_string_is_command() {
        assert_eq!(
            stop_of(json!("stop")),
            ("command".into(), Some("stop".into()))
        );
    }

    #[test]
    fn stop_native_object_passes_through() {
        assert_eq!(
            stop_of(json!({ "type": "signal", "value": "SIGTERM" })),
            ("signal".into(), Some("SIGTERM".into()))
        );
    }

    // deserialize_nest_egg_config_files

    #[test]
    fn files_legacy_scalar_find_becomes_structured_replacement() {
        let files = parse(json!({
            "files": {
                "server.properties": {
                    "parser": "properties",
                    "find": { "server-port": "{{server.build.default.port}}" }
                }
            }
        }))
        .files;

        let file = &files["server.properties"];
        assert!(file.create_new);
        assert_eq!(
            serde_json::to_value(file.parser).unwrap(),
            json!("properties")
        );
        assert_eq!(file.replace.len(), 1);
        let replacement = &file.replace[0];
        assert_eq!(replacement.r#match, "server-port");
        assert!(replacement.insert_new);
        assert!(replacement.update_existing);
        assert!(replacement.if_value.is_none());
        assert_eq!(
            replacement.replace_with,
            json!("{{server.build.default.port}}")
        );
    }

    #[test]
    fn files_legacy_if_value_map_expands_in_order() {
        let files = parse(json!({
            "files": {
                "config.yml": {
                    "parser": "yaml",
                    "find": {
                        "listeners[0].host": {
                            "0.0.0.0": "0.0.0.0:25565",
                            "127.0.0.1": "127.0.0.1:25565"
                        }
                    }
                }
            }
        }))
        .files;

        let replace = &files["config.yml"].replace;
        assert_eq!(replace.len(), 2);
        for (replacement, (old, new)) in replace.iter().zip([
            ("0.0.0.0", "0.0.0.0:25565"),
            ("127.0.0.1", "127.0.0.1:25565"),
        ]) {
            assert_eq!(replacement.r#match, "listeners[0].host");
            assert_eq!(replacement.if_value.as_deref(), Some(old));
            assert_eq!(replacement.replace_with, json!(new));
            assert!(replacement.update_existing);
        }
    }

    #[test]
    fn files_legacy_file_parser_does_not_insert_and_honours_create_file() {
        let files = parse(json!({
            "files": {
                "eula.txt": {
                    "parser": "file",
                    "find": { "eula": "eula=true" },
                    "create_file": false
                }
            }
        }))
        .files;

        let file = &files["eula.txt"];
        assert!(!file.create_new);
        let replacement = &file.replace[0];
        assert!(!replacement.insert_new);
        assert!(replacement.update_existing);
    }

    #[test]
    fn files_legacy_accepts_pre_stringified_json() {
        let legacy = json!({
            "server.properties": {
                "parser": "properties",
                "find": { "server-ip": "0.0.0.0" }
            }
        })
        .to_string();
        let files = parse(json!({ "files": legacy })).files;

        let replace = &files["server.properties"].replace;
        assert_eq!(replace.len(), 1);
        assert_eq!(replace[0].r#match, "server-ip");
        assert_eq!(replace[0].replace_with, json!("0.0.0.0"));
    }
}

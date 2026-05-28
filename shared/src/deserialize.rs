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
        serde_json::Value::String(value) => serde_json::from_str(&value).unwrap_or_else(|_| {
            crate::models::nest_egg::NestEggConfigStop {
                r#type: if value == "^C" || value == "^^C" {
                    "signal".into()
                } else {
                    "command".into()
                },
                value: Some(match value.as_str() {
                    "^C" => "SIGINT".into(),
                    "^^C" => "SIGKILL".into(),
                    _ => value.into(),
                }),
            }
        }),
        value => serde_json::from_value(value).map_err(serde::de::Error::custom)?,
    };

    Ok(value)
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
                        create_new: true,
                        parser: v.parser,
                        replace: v
                            .find
                            .into_iter()
                            .map(|(k, replace_with)| {
                                crate::models::nest_egg::ProcessConfigurationFileReplacement {
                                    r#match: k,
                                    insert_new: !matches!(v.parser, crate::models::nest_egg::ServerConfigurationFileParser::File),
                                    update_existing: true,
                                    if_value: None,
                                    replace_with,
                                }
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
    let value = <&str>::deserialize(deserializer)?;
    let public_key = russh::keys::PublicKey::from_openssh(value)
        .map_err(|_| serde::de::Error::custom("invalid public key"))?;

    Ok(public_key)
}

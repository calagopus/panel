use crate::prelude::StringExt;

use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer, app::AppSettingsApp,
};
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum TwitterCard {
    Summary,
    SummaryLargeImage,
}

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsMetadata {
    pub description: Option<compact_str::CompactString>,
    pub theme_color: compact_str::CompactString,
    pub og_image: Option<compact_str::CompactString>,
    pub twitter_card: TwitterCard,
    pub indexable: bool,
}

#[derive(Serialize)]
pub struct ResolvedMetadata {
    pub description: compact_str::CompactString,
    pub theme_color: compact_str::CompactString,
    pub og_image: compact_str::CompactString,
    pub twitter_card: &'static str,
    pub robots: &'static str,
}

impl AppSettingsMetadata {
    pub fn resolve(&self, app: &AppSettingsApp) -> ResolvedMetadata {
        let base_url = app.url.trim_end_matches('/');

        ResolvedMetadata {
            description: self.description.clone().unwrap_or_else(|| {
                compact_str::format_compact!(
                    "Manage your game servers and services with {}.",
                    app.name
                )
            }),
            theme_color: self.theme_color.clone(),
            og_image: match self.og_image.as_deref() {
                Some(image)
                    if image.starts_with("http://")
                        || image.starts_with("https://")
                        || image.starts_with("//") =>
                {
                    image.into()
                }
                Some(image) => {
                    compact_str::format_compact!("{base_url}/{}", image.trim_start_matches('/'))
                }
                None => compact_str::format_compact!("{base_url}/android-chrome-512x512.png"),
            },
            twitter_card: match self.twitter_card {
                TwitterCard::Summary => "summary",
                TwitterCard::SummaryLargeImage => "summary_large_image",
            },
            robots: if self.indexable {
                "index, follow"
            } else {
                "noindex, nofollow"
            },
        }
    }
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettingsMetadata {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting("description", self.description.as_deref().unwrap_or(""))
            .write_raw_setting("theme_color", &*self.theme_color)
            .write_raw_setting("og_image", self.og_image.as_deref().unwrap_or(""))
            .write_raw_setting(
                "twitter_card",
                match self.twitter_card {
                    TwitterCard::Summary => "summary",
                    TwitterCard::SummaryLargeImage => "summary_large_image",
                },
            )
            .write_raw_setting("indexable", self.indexable.to_compact_string()))
    }
}

pub struct AppSettingsMetadataDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsMetadataDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(AppSettingsMetadata {
            description: deserializer
                .take_raw_setting("description")
                .and_then(|s| s.into_optional()),
            theme_color: deserializer
                .take_raw_setting("theme_color")
                .unwrap_or_else(|| "#6c5ce7".into()),
            og_image: deserializer
                .take_raw_setting("og_image")
                .and_then(|s| s.into_optional()),
            twitter_card: match deserializer.take_raw_setting("twitter_card").as_deref() {
                Some("summary") => TwitterCard::Summary,
                _ => TwitterCard::SummaryLargeImage,
            },
            indexable: deserializer
                .take_raw_setting("indexable")
                .map(|s| s == "true")
                .unwrap_or(true),
        }))
    }
}

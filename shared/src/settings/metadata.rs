use crate::prelude::StringExt;

use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer, app::AppSettingsApp,
};
use compact_str::ToCompactString;
use garde::Validate;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum TwitterCard {
    Summary,
    SummaryLargeImage,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum PwaDisplay {
    Fullscreen,
    Standalone,
    MinimalUi,
    Browser,
}

impl PwaDisplay {
    pub fn as_str(self) -> &'static str {
        match self {
            PwaDisplay::Fullscreen => "fullscreen",
            PwaDisplay::Standalone => "standalone",
            PwaDisplay::MinimalUi => "minimal-ui",
            PwaDisplay::Browser => "browser",
        }
    }
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PwaIconPurpose {
    Any,
    Maskable,
    Monochrome,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum PwaFormFactor {
    Wide,
    Narrow,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct PwaIcon {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub src: compact_str::CompactString,
    #[garde(pattern(r"^(any|[1-9]\d{0,4}x[1-9]\d{0,4}( [1-9]\d{0,4}x[1-9]\d{0,4})*)$"))]
    pub sizes: compact_str::CompactString,
    #[garde(pattern(r"^image/[a-z0-9.+-]+$"))]
    pub r#type: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub purpose: PwaIconPurpose,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct PwaScreenshot {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub src: compact_str::CompactString,
    #[garde(pattern(r"^(any|[1-9]\d{0,4}x[1-9]\d{0,4}( [1-9]\d{0,4}x[1-9]\d{0,4})*)$"))]
    pub sizes: compact_str::CompactString,
    #[garde(pattern(r"^image/[a-z0-9.+-]+$"))]
    pub r#type: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub form_factor: Option<PwaFormFactor>,
    #[garde(length(chars, min = 1, max = 128))]
    #[schema(min_length = 1, max_length = 128)]
    pub label: Option<compact_str::CompactString>,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct PwaShortcut {
    #[garde(length(chars, min = 1, max = 64))]
    #[schema(min_length = 1, max_length = 64)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 32))]
    #[schema(min_length = 1, max_length = 32)]
    pub short_name: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 255), pattern(r"^/([^/\\].*)?$"))]
    #[schema(min_length = 1, max_length = 255)]
    pub url: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub description: Option<compact_str::CompactString>,
}

fn is_svg(src: &str, r#type: Option<&str>) -> bool {
    match r#type {
        Some(r#type) => r#type == "image/svg+xml",
        None => src.ends_with(".svg"),
    }
}

fn largest_dimension(sizes: &str) -> Option<u32> {
    sizes
        .split(' ')
        .filter_map(|size| size.split_once('x'))
        .filter_map(|(width, height)| Some(width.parse::<u32>().ok()?.max(height.parse().ok()?)))
        .max()
}

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsMetadata {
    pub description: Option<compact_str::CompactString>,
    pub theme_color: compact_str::CompactString,
    pub og_image: Option<compact_str::CompactString>,
    pub twitter_card: TwitterCard,
    pub indexable: bool,

    pub pwa_enabled: bool,
    pub pwa_name: Option<compact_str::CompactString>,
    pub pwa_short_name: Option<compact_str::CompactString>,
    pub pwa_display: PwaDisplay,
    pub pwa_background_color: compact_str::CompactString,
    pub pwa_icons: Vec<PwaIcon>,
    pub pwa_screenshots: Vec<PwaScreenshot>,
    pub pwa_shortcuts: Vec<PwaShortcut>,
    pub pwa_categories: Vec<compact_str::CompactString>,
}

#[derive(Serialize)]
pub struct ResolvedMetadata {
    pub description: compact_str::CompactString,
    pub theme_color: compact_str::CompactString,
    pub og_image: compact_str::CompactString,
    pub twitter_card: &'static str,
    pub robots: &'static str,
    pub pwa_enabled: bool,
    pub apple_touch_icon: compact_str::CompactString,
    pub apple_title: compact_str::CompactString,
}

impl AppSettingsMetadata {
    fn apple_touch_icon(&self, app: &AppSettingsApp) -> compact_str::CompactString {
        let raster_icon = |purpose: PwaIconPurpose| {
            self.pwa_icons
                .iter()
                .filter(|icon| {
                    icon.purpose == purpose && !is_svg(&icon.src, icon.r#type.as_deref())
                })
                .min_by_key(|icon| {
                    largest_dimension(&icon.sizes).map_or(u32::MAX, |size| size.abs_diff(180))
                })
        };

        if self.pwa_enabled
            && let Some(icon) =
                raster_icon(PwaIconPurpose::Any).or_else(|| raster_icon(PwaIconPurpose::Maskable))
        {
            return icon.src.clone();
        }

        if !is_svg(&app.icon, None) {
            return app.icon.clone();
        }

        "/apple-touch-icon.png".into()
    }

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
            pwa_enabled: self.pwa_enabled,
            apple_touch_icon: self.apple_touch_icon(app),
            apple_title: match self.pwa_enabled {
                true => self
                    .pwa_short_name
                    .clone()
                    .or_else(|| self.pwa_name.clone())
                    .unwrap_or_else(|| app.name.clone()),
                false => app.name.clone(),
            },
        }
    }

    pub fn web_manifest(&self, app: &AppSettingsApp) -> serde_json::Value {
        let icons = if self.pwa_icons.is_empty() {
            serde_json::json!([
                { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
                { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" },
            ])
        } else {
            self.pwa_icons
                .iter()
                .map(|icon| {
                    let mut entry = serde_json::json!({
                        "src": icon.src,
                        "sizes": icon.sizes,
                        "purpose": icon.purpose,
                    });
                    if let Some(r#type) = &icon.r#type {
                        entry["type"] = r#type.as_str().into();
                    }

                    entry
                })
                .collect()
        };

        let mut manifest = serde_json::json!({
            "id": "/",
            "name": self.pwa_name.as_deref().unwrap_or(&app.name),
            "short_name": self.pwa_short_name.as_deref().unwrap_or(&app.name),
            "description": self.resolve(app).description,
            "lang": app.language,
            "start_url": "/",
            "scope": "/",
            "display": self.pwa_display.as_str(),
            "background_color": self.pwa_background_color,
            "theme_color": self.theme_color,
            "orientation": "any",
            "icons": icons,
        });

        if !self.pwa_screenshots.is_empty() {
            manifest["screenshots"] = self
                .pwa_screenshots
                .iter()
                .map(|screenshot| {
                    let mut entry = serde_json::json!({
                        "src": screenshot.src,
                        "sizes": screenshot.sizes,
                    });
                    if let Some(r#type) = &screenshot.r#type {
                        entry["type"] = r#type.as_str().into();
                    }
                    if let Some(form_factor) = screenshot.form_factor {
                        entry["form_factor"] = serde_json::json!(form_factor);
                    }
                    if let Some(label) = &screenshot.label {
                        entry["label"] = label.as_str().into();
                    }

                    entry
                })
                .collect();
        }

        if !self.pwa_shortcuts.is_empty() {
            manifest["shortcuts"] = self
                .pwa_shortcuts
                .iter()
                .map(|shortcut| {
                    let mut entry = serde_json::json!({
                        "name": shortcut.name,
                        "url": shortcut.url,
                    });
                    if let Some(short_name) = &shortcut.short_name {
                        entry["short_name"] = short_name.as_str().into();
                    }
                    if let Some(description) = &shortcut.description {
                        entry["description"] = description.as_str().into();
                    }

                    entry
                })
                .collect();
        }

        if !self.pwa_categories.is_empty() {
            manifest["categories"] = serde_json::json!(self.pwa_categories);
        }

        manifest
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
            .write_raw_setting("indexable", self.indexable.to_compact_string())
            .write_raw_setting("pwa_enabled", self.pwa_enabled.to_compact_string())
            .write_raw_setting("pwa_name", self.pwa_name.as_deref().unwrap_or(""))
            .write_raw_setting(
                "pwa_short_name",
                self.pwa_short_name.as_deref().unwrap_or(""),
            )
            .write_raw_setting("pwa_display", self.pwa_display.as_str())
            .write_raw_setting("pwa_background_color", &*self.pwa_background_color)
            .write_serde_setting("pwa_icons", &self.pwa_icons)?
            .write_serde_setting("pwa_screenshots", &self.pwa_screenshots)?
            .write_serde_setting("pwa_shortcuts", &self.pwa_shortcuts)?
            .write_serde_setting("pwa_categories", &self.pwa_categories)?)
    }
}

impl AppSettingsMetadata {
    #[cfg(test)]
    pub fn mock() -> Self {
        Self {
            description: None,
            theme_color: "#6c5ce7".into(),
            og_image: None,
            twitter_card: TwitterCard::SummaryLargeImage,
            indexable: true,
            pwa_enabled: true,
            pwa_name: None,
            pwa_short_name: None,
            pwa_display: PwaDisplay::Standalone,
            pwa_background_color: "#222222".into(),
            pwa_icons: Vec::new(),
            pwa_screenshots: Vec::new(),
            pwa_shortcuts: Vec::new(),
            pwa_categories: Vec::new(),
        }
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
            pwa_enabled: deserializer
                .take_raw_setting("pwa_enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
            pwa_name: deserializer
                .take_raw_setting("pwa_name")
                .and_then(|s| s.into_optional()),
            pwa_short_name: deserializer
                .take_raw_setting("pwa_short_name")
                .and_then(|s| s.into_optional()),
            pwa_display: match deserializer.take_raw_setting("pwa_display").as_deref() {
                Some("fullscreen") => PwaDisplay::Fullscreen,
                Some("minimal-ui") => PwaDisplay::MinimalUi,
                Some("browser") => PwaDisplay::Browser,
                _ => PwaDisplay::Standalone,
            },
            pwa_background_color: deserializer
                .take_raw_setting("pwa_background_color")
                .unwrap_or_else(|| "#222222".into()),
            pwa_icons: match deserializer.read_serde_setting("pwa_icons") {
                Ok(Some(icons)) => icons,
                _ => deserializer
                    .take_raw_setting("pwa_icon")
                    .and_then(|s| s.into_optional())
                    .map(|src| {
                        let svg = is_svg(&src, None);

                        vec![PwaIcon {
                            sizes: if svg { "any" } else { "512x512" }.into(),
                            r#type: svg.then(|| "image/svg+xml".into()),
                            src,
                            purpose: PwaIconPurpose::Any,
                        }]
                    })
                    .unwrap_or_default(),
            },
            pwa_screenshots: deserializer
                .read_serde_setting("pwa_screenshots")
                .unwrap_or_default(),
            pwa_shortcuts: deserializer
                .read_serde_setting("pwa_shortcuts")
                .unwrap_or_default(),
            pwa_categories: deserializer
                .read_serde_setting("pwa_categories")
                .unwrap_or_default(),
        }))
    }
}

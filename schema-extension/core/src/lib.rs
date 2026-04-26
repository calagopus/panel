use serde::Serialize;
use std::sync::{LazyLock, RwLock};
use utoipa::openapi::{RefOr, Schema, schema::Object};

pub use std::future::Future;
pub use std::pin::Pin;
pub use std::sync::Arc;

pub type ExtensionValidatorFn = Box<
    dyn Fn(
            &serde_json::Map<String, serde_json::Value>,
            &mut dyn FnMut() -> garde::Path,
            &mut garde::Report,
        ) + Send
        + Sync,
>;

pub fn register_validator<T: Extendible, E>(validators: &RwLock<Vec<ExtensionValidatorFn>>)
where
    E: serde::de::DeserializeOwned + garde::Validate<Context = ()> + 'static,
{
    let validator: ExtensionValidatorFn = Box::new(|overlay, parent, report| {
        let value = serde_json::Value::Object(overlay.clone());
        match serde_json::from_value::<E>(value) {
            Ok(ext) => ext.validate_into(&(), parent, report),
            Err(e) => report.append(
                parent(),
                garde::Error::new(format!(
                    "failed to deserialize extension {}: {}",
                    std::any::type_name::<E>(),
                    e
                )),
            ),
        }
    });
    validators.write().unwrap().push(validator);
}

#[derive(Debug, Clone, Default)]
pub struct ExtensionOverlay<T: Extendible> {
    pub map: serde_json::Map<String, serde_json::Value>,
    _marker: std::marker::PhantomData<fn() -> T>,
}

impl<T: Extendible> ExtensionOverlay<T> {
    pub fn new() -> Self {
        Self {
            map: serde_json::Map::new(),
            _marker: std::marker::PhantomData,
        }
    }
}

impl<T: Extendible> serde::Serialize for ExtensionOverlay<T> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.map.serialize(serializer)
    }
}

impl<'de, T: Extendible> serde::Deserialize<'de> for ExtensionOverlay<T> {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let map = serde_json::Map::deserialize(deserializer)?;
        Ok(Self {
            map,
            _marker: std::marker::PhantomData,
        })
    }
}

impl<T: Extendible> garde::Validate for ExtensionOverlay<T> {
    type Context = ();
    fn validate_into(
        &self,
        _ctx: &Self::Context,
        parent: &mut dyn FnMut() -> garde::Path,
        report: &mut garde::Report,
    ) {
        for validator in T::validators().read().unwrap().iter() {
            validator(&self.map, parent, report);
        }
    }
}

pub trait Extendible: Serialize + Sized + 'static {
    fn schema_mut() -> &'static LazyLock<RwLock<Object>>;

    fn merged_schema() -> RefOr<Schema> {
        RefOr::T(Schema::Object(Self::schema_mut().read().unwrap().clone()))
    }

    fn validators() -> &'static RwLock<Vec<ExtensionValidatorFn>>;

    fn overlay_map_mut(&mut self) -> &mut serde_json::Map<String, serde_json::Value>;
    fn overlay_map(&self) -> &serde_json::Map<String, serde_json::Value>;

    fn parse_extended<E: serde::de::DeserializeOwned>(&self) -> Result<E, anyhow::Error> {
        serde_json::from_value(serde_json::Value::Object(self.overlay_map().clone()))
            .map_err(anyhow::Error::from)
    }

    fn insert_extension<E: Serialize>(&mut self, ext_value: E) -> Result<(), anyhow::Error> {
        crate::apply_extension_to_overlay(self, ext_value)
    }
}

pub fn apply_extension_to_overlay<T: Extendible, E: Serialize>(
    this: &mut T,
    ext_value: E,
) -> Result<(), anyhow::Error> {
    let serialized = serde_json::to_value(ext_value)?;
    if let serde_json::Value::Object(map) = serialized {
        let overlay = this.overlay_map_mut();
        for (k, v) in map {
            merge_json_value(overlay.entry(k).or_insert(serde_json::Value::Null), v);
        }
        Ok(())
    } else {
        Err(anyhow::anyhow!("Extension must serialize to a JSON object"))
    }
}

#[macro_export]
macro_rules! finish_extendible {
    ($ty:ident { $($tt:tt)* }, $ready:expr $(, $hook_arg:expr)* $(,)?) => {{
        let mut instance = $ty {
            $($tt)*
            __overlay: $crate::ExtensionOverlay::new(),
        };
        $ty::finish_hooks(&mut instance, $ready $(, $hook_arg)*)?;
        Ok::<_, anyhow::Error>(instance)
    }};
}

pub fn merge_schema_object(dst: &mut Object, src: Object) {
    for (key, src_prop) in src.properties {
        match dst.properties.get_mut(&key) {
            Some(dst_prop) => merge_ref_or_schema(dst_prop, src_prop),
            None => {
                dst.properties.insert(key, src_prop);
            }
        }
    }
    for req in src.required {
        if !dst.required.contains(&req) {
            dst.required.push(req);
        }
    }
}

fn merge_ref_or_schema(dst: &mut RefOr<Schema>, src: RefOr<Schema>) {
    match (dst, src) {
        (RefOr::T(Schema::Object(d)), RefOr::T(Schema::Object(s))) => merge_schema_object(d, s),
        (dst, src) => *dst = src,
    }
}

pub fn merge_json_value(dst: &mut serde_json::Value, src: serde_json::Value) {
    match (dst, src) {
        (serde_json::Value::Object(d), serde_json::Value::Object(s)) => {
            for (k, v) in s {
                merge_json_value(d.entry(k).or_insert(serde_json::Value::Null), v);
            }
        }
        (dst, src) => *dst = src,
    }
}

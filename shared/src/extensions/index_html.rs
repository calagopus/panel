use crate::settings::AppSettings;
use std::{collections::BTreeMap, panic::AssertUnwindSafe, sync::Arc};

pub type IndexHtmlVariableFunc =
    dyn Fn(&AppSettings) -> Result<serde_json::Value, anyhow::Error> + Send + Sync;

pub struct IndexHtmlVariable {
    pub package_name: &'static str,
    pub name: &'static str,
    pub value: Box<IndexHtmlVariableFunc>,
}

pub struct IndexHtmlBuilder {
    package_name: &'static str,
    variables: Arc<parking_lot::Mutex<Vec<IndexHtmlVariable>>>,
}

impl IndexHtmlBuilder {
    pub(crate) fn new() -> Self {
        Self {
            package_name: "",
            variables: Arc::new(parking_lot::Mutex::new(Vec::new())),
        }
    }

    pub(crate) fn share(&self, package_name: &'static str) -> Self {
        Self {
            package_name,
            variables: Arc::clone(&self.variables),
        }
    }

    pub(crate) fn rollback(&self, package_name: &str) {
        self.variables
            .lock()
            .retain(|variable| variable.package_name != package_name);
    }

    pub(crate) fn finish(self) -> IndexHtmlVariables {
        IndexHtmlVariables(std::mem::take(&mut *self.variables.lock()))
    }

    /// Adds a variable to the rendered index.html, readable in the frontend through
    /// `this.getIndexVariable(name)` on your `Extension` class before any request is made.
    ///
    /// The value function runs whenever index.html is re-rendered (startup, every settings
    /// save, and every settings cache reload) while the settings write lock is held, so keep it
    /// cheap and never call `state.settings.get()` from inside it, use the provided settings.
    /// An `Err` or a panic omits the variable from that render instead of failing it.
    ///
    /// index.html is served to everyone including logged out visitors, never expose secrets.
    pub fn add_variable<
        F: Fn(&AppSettings) -> Result<serde_json::Value, anyhow::Error> + Send + Sync + 'static,
    >(
        &self,
        name: &'static str,
        value_fn: F,
    ) -> &Self {
        let mut variables = self.variables.lock();

        if let Some(existing) = variables
            .iter_mut()
            .find(|variable| variable.package_name == self.package_name && variable.name == name)
        {
            tracing::warn!(
                extension = self.package_name,
                name,
                "index.html variable registered twice, replacing the previous one"
            );
            existing.value = Box::new(value_fn);
        } else {
            variables.push(IndexHtmlVariable {
                package_name: self.package_name,
                name,
                value: Box::new(value_fn),
            });
        }

        self
    }
}

#[derive(Default)]
pub struct IndexHtmlVariables(Vec<IndexHtmlVariable>);

impl IndexHtmlVariables {
    pub(crate) fn evaluate(&self, settings: &AppSettings) -> EvaluatedIndexHtmlVariables {
        let mut evaluated: BTreeMap<&'static str, serde_json::Map<String, serde_json::Value>> =
            BTreeMap::new();

        for variable in &self.0 {
            if let Some(value) = evaluate_value(variable.package_name, variable.name, || {
                (variable.value)(settings)
            }) {
                evaluated
                    .entry(variable.package_name)
                    .or_default()
                    .insert(variable.name.into(), value);
            }
        }

        EvaluatedIndexHtmlVariables(Arc::new(evaluated))
    }
}

fn evaluate_value(
    package_name: &str,
    name: &str,
    value_fn: impl FnOnce() -> Result<serde_json::Value, anyhow::Error>,
) -> Option<serde_json::Value> {
    match std::panic::catch_unwind(AssertUnwindSafe(value_fn)) {
        Ok(Ok(value)) => Some(value),
        Ok(Err(err)) => {
            tracing::error!(
                extension = package_name,
                name,
                "failed to compute index.html variable: {err:#}"
            );
            None
        }
        Err(_) => {
            tracing::error!(
                extension = package_name,
                name,
                "index.html variable panicked"
            );
            None
        }
    }
}

#[derive(Clone)]
pub(crate) struct EvaluatedIndexHtmlVariables(
    pub(crate) Arc<BTreeMap<&'static str, serde_json::Map<String, serde_json::Value>>>,
);

impl EvaluatedIndexHtmlVariables {
    pub(crate) fn json_block(&self) -> Result<String, anyhow::Error> {
        let json = serde_json::to_string(&*self.0)?
            .replace('<', "\\u003c")
            .replace('>', "\\u003e")
            .replace('&', "\\u0026");

        Ok(format!(
            r#"<script type="application/json" id="extension-variables">{json}</script>"#
        ))
    }

    pub(crate) fn render_boot_template(&self, source: &str, identifier: &str) -> minijinja::Value {
        let variables = self
            .0
            .iter()
            .find(|(package_name, _)| package_name.replace('.', "_") == identifier)
            .map(|(_, variables)| variables.clone())
            .unwrap_or_default();

        let mut environment = minijinja::Environment::new();
        environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);

        match environment.render_str(source, minijinja::context! { variables => minijinja::Value::from(minijinja::value::Serde(variables)) }) {
            Ok(rendered) => minijinja::Value::from_safe_string(rendered),
            Err(err) => {
                tracing::error!(
                    extension = identifier,
                    "failed to render boot.html: {err:#}"
                );
                minijinja::Value::from_safe_string(String::new())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn payload(block: &str) -> serde_json::Value {
        let inner = block
            .strip_prefix(r#"<script type="application/json" id="extension-variables">"#)
            .and_then(|rest| rest.strip_suffix("</script>"))
            .expect("json block wrapper");
        assert!(
            !inner.contains(['<', '>', '&']),
            "unescaped markup in {inner}"
        );

        serde_json::from_str(inner).unwrap()
    }

    fn evaluated(
        variables: &[(&'static str, &str, serde_json::Value)],
    ) -> EvaluatedIndexHtmlVariables {
        let mut map: BTreeMap<&'static str, serde_json::Map<String, serde_json::Value>> =
            BTreeMap::new();
        for (package_name, name, value) in variables {
            map.entry(package_name)
                .or_default()
                .insert(name.to_string(), value.clone());
        }

        EvaluatedIndexHtmlVariables(Arc::new(map))
    }

    // json_block
    #[test]
    fn json_block_cannot_be_broken_out_of() {
        let hostile = "</script><script>alert(1)</script> & <!-- -->";

        let block = evaluated(&[("my.ext", "x", json!(hostile))])
            .json_block()
            .unwrap();

        assert_eq!(block.matches("</script>").count(), 1);
        assert_eq!(payload(&block), json!({ "my.ext": { "x": hostile } }));
    }

    // evaluate_value
    #[test]
    fn evaluate_value_omits_errors_and_panics() {
        assert_eq!(
            evaluate_value("my.ext", "ok", || Ok(json!(1))),
            Some(json!(1))
        );
        assert_eq!(
            evaluate_value("my.ext", "err", || Err(anyhow::anyhow!("nope"))),
            None
        );
        assert_eq!(evaluate_value("my.ext", "panics", || panic!("boom")), None);
    }

    // IndexHtmlBuilder
    #[test]
    fn builder_namespaces_replaces_and_rolls_back_per_package() {
        let root = IndexHtmlBuilder::new();
        root.share("a.ext").add_variable("x", |_| Ok(json!("a")));
        root.share("b.ext").add_variable("x", |_| Ok(json!("b")));
        root.share("a.ext").add_variable("x", |_| Ok(json!("a2")));
        root.share("c.ext")
            .add_variable("x", |_| Ok(json!("c")))
            .add_variable("y", |_| Ok(json!("c")));
        root.rollback("c.ext");

        let registered: Vec<_> = root
            .finish()
            .0
            .iter()
            .map(|variable| (variable.package_name, variable.name))
            .collect();

        assert_eq!(registered, [("a.ext", "x"), ("b.ext", "x")]);
    }

    // render_boot_template
    #[test]
    fn render_boot_template_sees_only_own_escaped_variables() {
        let rendered = evaluated(&[
            ("my.ext", "x", json!("<b>&</b>")),
            ("other.ext", "y", json!("leak")),
        ])
        .render_boot_template("[{{ variables.x }}][{{ variables.y }}]", "my_ext")
        .to_string();

        assert_eq!(rendered, "[&lt;b&gt;&amp;&lt;&#x2f;b&gt;][]");
    }

    #[test]
    fn render_boot_template_unknown_identifier_has_no_variables() {
        let rendered = evaluated(&[("my.ext", "x", json!("v"))])
            .render_boot_template("[{{ variables.x }}]", "my.ext")
            .to_string();

        assert_eq!(rendered, "[]");
    }

    #[test]
    fn render_boot_template_invalid_template_is_empty() {
        let rendered = evaluated(&[])
            .render_boot_template("{{ unclosed", "my_ext")
            .to_string();

        assert_eq!(rendered, "");
    }
}

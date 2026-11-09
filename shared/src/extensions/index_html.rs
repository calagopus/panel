use crate::settings::AppSettings;
use std::{
    collections::{BTreeMap, HashSet},
    panic::AssertUnwindSafe,
    sync::Arc,
};

pub type IndexHtmlVariableFunc =
    dyn Fn(&AppSettings) -> Result<serde_json::Value, anyhow::Error> + Send + Sync;

pub type IndexHtmlCspSourcesFunc =
    dyn Fn(&AppSettings) -> Result<Vec<String>, anyhow::Error> + Send + Sync;

pub struct IndexHtmlVariable {
    pub package_name: &'static str,
    pub name: &'static str,
    pub value: Box<IndexHtmlVariableFunc>,
}

pub struct IndexHtmlCspSources {
    pub package_name: &'static str,
    pub directive: CspDirective,
    pub sources: Box<IndexHtmlCspSourcesFunc>,
}

/// The index.html content security policy directives extensions can add sources to.
#[non_exhaustive]
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum CspDirective {
    ScriptSrc,
    StyleSrc,
    ConnectSrc,
    FrameSrc,
    FontSrc,
    ImgSrc,
    MediaSrc,
    FormAction,
}

impl CspDirective {
    pub const fn name(self) -> &'static str {
        match self {
            CspDirective::ScriptSrc => "script-src",
            CspDirective::StyleSrc => "style-src",
            CspDirective::ConnectSrc => "connect-src",
            CspDirective::FrameSrc => "frame-src",
            CspDirective::FontSrc => "font-src",
            CspDirective::ImgSrc => "img-src",
            CspDirective::MediaSrc => "media-src",
            CspDirective::FormAction => "form-action",
        }
    }
}

#[derive(Default)]
struct IndexHtmlRegistrations {
    variables: Vec<IndexHtmlVariable>,
    csp_sources: Vec<IndexHtmlCspSources>,
}

pub struct IndexHtmlBuilder {
    package_name: &'static str,
    registrations: Arc<parking_lot::Mutex<IndexHtmlRegistrations>>,
}

impl IndexHtmlBuilder {
    pub(crate) fn new() -> Self {
        Self {
            package_name: "",
            registrations: Arc::new(parking_lot::Mutex::new(IndexHtmlRegistrations::default())),
        }
    }

    pub(crate) fn share(&self, package_name: &'static str) -> Self {
        Self {
            package_name,
            registrations: Arc::clone(&self.registrations),
        }
    }

    pub(crate) fn rollback(&self, package_name: &str) {
        let mut registrations = self.registrations.lock();
        registrations
            .variables
            .retain(|variable| variable.package_name != package_name);
        registrations
            .csp_sources
            .retain(|sources| sources.package_name != package_name);
    }

    pub(crate) fn finish(self) -> IndexHtmlContributions {
        let registrations = std::mem::take(&mut *self.registrations.lock());

        IndexHtmlContributions {
            variables: registrations.variables,
            csp_sources: registrations.csp_sources,
            warned_csp_sources: Default::default(),
        }
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
        let mut registrations = self.registrations.lock();

        if let Some(existing) = registrations
            .variables
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
            registrations.variables.push(IndexHtmlVariable {
                package_name: self.package_name,
                name,
                value: Box::new(value_fn),
            });
        }

        self
    }

    /// Allows a source in the index.html `Content-Security-Policy`, for example
    /// `add_csp_source(CspDirective::ScriptSrc, "https://client.crisp.chat")` to load a
    /// third-party widget. Sources are merged with the Panel's own and the captcha provider's.
    ///
    /// A source must be a single CSP source expression (a host like `https://*.example.com`,
    /// a scheme like `wss:`, or a keyword like `'wasm-unsafe-eval'`). Invalid sources and
    /// sources that would break the Panel (`'unsafe-inline'` in script-src, hashes or nonces
    /// in style-src, `'strict-dynamic'`, ...) are logged and left out.
    pub fn add_csp_source(&self, directive: CspDirective, source: impl Into<String>) -> &Self {
        let source = source.into();

        self.add_csp_sources(directive, move |_| Ok(vec![source.clone()]))
    }

    /// Like [`Self::add_csp_source`], but computes the sources from the Panel's settings,
    /// for example a self-hosted analytics URL configured in your extension's settings.
    ///
    /// The function runs on the same schedule and with the same rules as
    /// [`Self::add_variable`] value functions, an `Err` or a panic omits its sources.
    pub fn add_csp_sources<
        F: Fn(&AppSettings) -> Result<Vec<String>, anyhow::Error> + Send + Sync + 'static,
    >(
        &self,
        directive: CspDirective,
        sources_fn: F,
    ) -> &Self {
        self.registrations
            .lock()
            .csp_sources
            .push(IndexHtmlCspSources {
                package_name: self.package_name,
                directive,
                sources: Box::new(sources_fn),
            });

        self
    }
}

#[derive(Default)]
pub struct IndexHtmlContributions {
    variables: Vec<IndexHtmlVariable>,
    csp_sources: Vec<IndexHtmlCspSources>,
    warned_csp_sources: parking_lot::Mutex<HashSet<(&'static str, CspDirective, String)>>,
}

impl IndexHtmlContributions {
    pub(crate) fn evaluate(&self, settings: &AppSettings) -> EvaluatedIndexHtmlVariables {
        let mut evaluated: BTreeMap<&'static str, serde_json::Map<String, serde_json::Value>> =
            BTreeMap::new();

        for variable in &self.variables {
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

    pub(crate) fn content_security_policy(&self, settings: &AppSettings) -> ContentSecurityPolicy {
        let mut policy = ContentSecurityPolicy::new(
            settings.captcha_provider.to_csp_script_src(),
            settings.captcha_provider.to_csp_style_src(),
            matches!(
                settings.captcha_provider,
                crate::settings::CaptchaProvider::Cap { .. }
            ),
        );

        for contribution in &self.csp_sources {
            let Some(sources) = evaluate_value(
                contribution.package_name,
                contribution.directive.name(),
                || (contribution.sources)(settings),
            ) else {
                continue;
            };

            for source in sources {
                match validate_csp_source(contribution.directive, &source) {
                    Ok(CspSourceCheck::Fine) => {}
                    Ok(CspSourceCheck::Broad) => {
                        if self.warned_csp_sources.lock().insert((
                            contribution.package_name,
                            contribution.directive,
                            source.clone(),
                        )) {
                            tracing::warn!(
                                extension = contribution.package_name,
                                directive = contribution.directive.name(),
                                source,
                                "index.html csp source weakens the policy considerably"
                            );
                        }
                    }
                    Err(reason) => {
                        tracing::error!(
                            extension = contribution.package_name,
                            directive = contribution.directive.name(),
                            source,
                            "ignoring index.html csp source: {reason}"
                        );
                        continue;
                    }
                }

                if let Err(reason) = policy.add_source(contribution.directive, source.clone()) {
                    tracing::error!(
                        extension = contribution.package_name,
                        directive = contribution.directive.name(),
                        source,
                        "ignoring index.html csp source: {reason}"
                    );
                }
            }
        }

        policy
    }
}

#[derive(Debug, PartialEq, Eq)]
enum CspSourceCheck {
    Fine,
    Broad,
}

fn validate_csp_source(
    directive: CspDirective,
    source: &str,
) -> Result<CspSourceCheck, &'static str> {
    if source.is_empty() {
        return Err("source is empty");
    }
    if !source
        .bytes()
        .all(|byte| byte.is_ascii_graphic() && !matches!(byte, b';' | b','))
    {
        return Err("source must be a single expression without whitespace, `;` or `,`");
    }

    if let Some(keyword) = source.strip_prefix('\'') {
        let Some(keyword) = keyword.strip_suffix('\'') else {
            return Err("quoted keyword is not closed");
        };
        if keyword.contains('\'') {
            return Err("source must be a single expression");
        }

        let is_hash = ["sha256-", "sha384-", "sha512-"]
            .iter()
            .any(|prefix| keyword.starts_with(prefix));

        return match (directive, keyword) {
            (_, "self") => Ok(CspSourceCheck::Fine),
            (CspDirective::ScriptSrc, "wasm-unsafe-eval") => Ok(CspSourceCheck::Fine),
            (CspDirective::ScriptSrc, "unsafe-eval") => Ok(CspSourceCheck::Broad),
            (CspDirective::ScriptSrc, _) if is_hash => Ok(CspSourceCheck::Fine),
            (CspDirective::ScriptSrc, "unsafe-inline") => Err(
                "'unsafe-inline' is ignored whenever the captcha provider needs a nonce, use a hash instead",
            ),
            (CspDirective::StyleSrc, "unsafe-inline") => Ok(CspSourceCheck::Fine),
            (CspDirective::StyleSrc, _) if is_hash || keyword.starts_with("nonce-") => {
                Err("hashes and nonces disable the 'unsafe-inline' style-src the Panel relies on")
            }
            (_, "none") => Err("'none' would block the Panel itself"),
            (_, "strict-dynamic") => Err("'strict-dynamic' would block the Panel itself"),
            (_, _) if keyword.starts_with("nonce-") => {
                Err("a fixed nonce defeats the purpose of a nonce")
            }
            _ => Err("keyword is not allowed in this directive"),
        };
    }

    if source.contains('\'') {
        return Err("source must be a single expression");
    }

    let is_scheme_only = source
        .strip_suffix(':')
        .is_some_and(|scheme| !scheme.is_empty() && !scheme.contains(['/', ':']));
    if directive == CspDirective::ScriptSrc && (source == "*" || is_scheme_only) {
        return Ok(CspSourceCheck::Broad);
    }

    Ok(CspSourceCheck::Fine)
}

const MAX_CONTENT_SECURITY_POLICY_LENGTH: usize = 3072;

pub(crate) struct ContentSecurityPolicy {
    directives: Vec<(&'static str, Vec<String>)>,
    length: usize,
    uses_script_nonce: bool,
}

impl ContentSecurityPolicy {
    fn new(
        captcha_script_src: &[&str],
        captcha_style_src: &[&str],
        uses_script_nonce: bool,
    ) -> Self {
        let directive = |name: &'static str, sources: &[&str]| {
            (
                name,
                sources.iter().map(|source| source.to_string()).collect(),
            )
        };

        let mut policy = Self {
            directives: vec![
                directive("default-src", &["'self'"]),
                directive("frame-src", &["*"]),
                directive("style-src", &["'self'", "'unsafe-inline'"]),
                directive("connect-src", &["*", "blob:"]),
                directive("font-src", &["'self'", "blob:", "data:"]),
                directive("img-src", &["*", "blob:", "data:"]),
                directive("media-src", &["'self'", "blob:", "data:"]),
                directive("object-src", &["blob:", "data:"]),
                directive("base-uri", &["'self'"]),
                directive("form-action", &["'self'"]),
                directive("frame-ancestors", &["'self'"]),
                directive("script-src", &["'self'", "blob:"]),
            ],
            length: 0,
            uses_script_nonce,
        };
        policy.length = policy.render().len();

        for source in captcha_script_src {
            policy.push_unique(CspDirective::ScriptSrc.name(), source.to_string());
        }
        for source in captcha_style_src {
            policy.push_unique(CspDirective::StyleSrc.name(), source.to_string());
        }

        policy
    }

    fn contains(&self, name: &'static str, source: &str) -> bool {
        self.directives
            .iter()
            .any(|(n, sources)| *n == name && sources.iter().any(|s| s == source))
    }

    fn push_unique(&mut self, name: &'static str, source: String) {
        if self.contains(name, &source) {
            return;
        }
        if let Some((_, sources)) = self.directives.iter_mut().find(|(n, _)| *n == name) {
            self.length += 1 + source.len();
            sources.push(source);
        }
    }

    fn add_source(&mut self, directive: CspDirective, source: String) -> Result<(), &'static str> {
        if !self.contains(directive.name(), &source)
            && self.length + 1 + source.len() > MAX_CONTENT_SECURITY_POLICY_LENGTH
        {
            return Err("the content security policy header would get too long");
        }

        self.push_unique(directive.name(), source);

        Ok(())
    }

    #[inline]
    pub fn uses_script_nonce(&self) -> bool {
        self.uses_script_nonce
    }

    pub fn render(&self) -> String {
        let mut rendered = String::with_capacity(self.length);

        for (i, (name, sources)) in self.directives.iter().enumerate() {
            if i > 0 {
                rendered.push_str("; ");
            }
            rendered.push_str(name);
            for source in sources {
                rendered.push(' ');
                rendered.push_str(source);
            }
        }

        rendered
    }
}

fn evaluate_value<T>(
    package_name: &str,
    name: &str,
    value_fn: impl FnOnce() -> Result<T, anyhow::Error>,
) -> Option<T> {
    match std::panic::catch_unwind(AssertUnwindSafe(value_fn)) {
        Ok(Ok(value)) => Some(value),
        Ok(Err(err)) => {
            tracing::error!(
                extension = package_name,
                name,
                "failed to compute index.html value: {err:#}"
            );
            None
        }
        Err(_) => {
            tracing::error!(
                extension = package_name,
                name,
                "index.html value function panicked"
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
            evaluate_value::<serde_json::Value>("my.ext", "err", || Err(anyhow::anyhow!("nope"))),
            None
        );
        assert_eq!(
            evaluate_value::<serde_json::Value>("my.ext", "panics", || panic!("boom")),
            None
        );
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
            .variables
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

    // validate_csp_source
    #[test]
    fn validate_csp_source_rules() {
        use CspDirective::*;

        for (directive, source) in [
            (ScriptSrc, "https://*.example.com"),
            (ScriptSrc, "'wasm-unsafe-eval'"),
            (ScriptSrc, "'sha256-YWJjZGVm'"),
            (ConnectSrc, "wss:"),
            (StyleSrc, "'unsafe-inline'"),
            (StyleSrc, "https://fonts.example.com"),
        ] {
            assert_eq!(
                validate_csp_source(directive, source),
                Ok(CspSourceCheck::Fine),
                "{directive:?} {source}"
            );
        }

        for source in ["'unsafe-eval'", "*", "https:"] {
            assert_eq!(
                validate_csp_source(ScriptSrc, source),
                Ok(CspSourceCheck::Broad),
                "{source}"
            );
        }

        for (directive, source) in [
            (ScriptSrc, ""),
            (ScriptSrc, "https://a.example https://b.example"),
            (ScriptSrc, "https://a.example;script-src *"),
            (ScriptSrc, "https://a.example,https://b.example"),
            (ConnectSrc, "https://a.example\twss:"),
            (ConnectSrc, "https://a.example\n"),
            (ScriptSrc, "'unsafe-inline'"),
            (ScriptSrc, "'Unsafe-Inline'"),
            (StyleSrc, "'sha256-YWJjZGVm'"),
            (StyleSrc, "'sha384-YWJjZGVm'"),
            (StyleSrc, "'nonce-abc'"),
            (ScriptSrc, "'nonce-abc'"),
            (ScriptSrc, "'none'"),
            (ImgSrc, "'none'"),
            (ScriptSrc, "'strict-dynamic'"),
        ] {
            assert!(
                validate_csp_source(directive, source).is_err(),
                "{directive:?} {source:?}"
            );
        }
    }

    fn directives(policy: &str) -> Vec<(&str, Vec<&str>)> {
        policy
            .split("; ")
            .map(|directive| {
                let mut tokens = directive.split(' ');
                (tokens.next().unwrap(), tokens.collect())
            })
            .collect()
    }

    // ContentSecurityPolicy
    #[test]
    fn content_security_policy_merges_dedupes_and_renders_script_src_last() {
        let mut policy = ContentSecurityPolicy::new(
            &["https://captcha.example"],
            &["https://captcha-styles.example"],
            false,
        );
        policy
            .add_source(CspDirective::ScriptSrc, "https://ext.example".into())
            .unwrap();
        policy
            .add_source(CspDirective::ScriptSrc, "https://ext.example".into())
            .unwrap();
        policy
            .add_source(CspDirective::ScriptSrc, "https://captcha.example".into())
            .unwrap();
        policy
            .add_source(CspDirective::StyleSrc, "https://ext-styles.example".into())
            .unwrap();
        policy
            .add_source(CspDirective::ImgSrc, "https://img.example".into())
            .unwrap();

        let rendered = policy.render();
        let parsed = directives(&rendered);

        let (last, _) = parsed.last().unwrap();
        assert_eq!(*last, "script-src");

        let sources = |name: &str| {
            let matching: Vec<_> = parsed.iter().filter(|(n, _)| *n == name).collect();
            assert_eq!(
                matching.len(),
                1,
                "{name} rendered {} times",
                matching.len()
            );
            matching[0].1.clone()
        };

        let script_src = sources("script-src");
        for source in ["https://ext.example", "https://captcha.example"] {
            assert_eq!(
                script_src.iter().filter(|s| **s == source).count(),
                1,
                "{source} in {rendered}"
            );
        }

        let style_src = sources("style-src");
        assert!(style_src.contains(&"https://captcha-styles.example"));
        assert!(style_src.contains(&"https://ext-styles.example"));
        assert!(sources("img-src").contains(&"https://img.example"));
    }

    #[test]
    fn content_security_policy_refuses_sources_past_the_length_cap() {
        let mut policy = ContentSecurityPolicy::new(&[], &[], false);
        policy
            .add_source(CspDirective::ConnectSrc, "https://first.example".into())
            .unwrap();

        let mut refused = None;
        for i in 0..MAX_CONTENT_SECURITY_POLICY_LENGTH {
            let source = format!("https://host-{i}.example.com");
            if policy
                .add_source(CspDirective::ConnectSrc, source.clone())
                .is_err()
            {
                refused = Some(source);
                break;
            }
        }
        let refused = refused.expect("cap never reached");

        let rendered = policy.render();
        assert!(rendered.len() <= MAX_CONTENT_SECURITY_POLICY_LENGTH);
        assert!(
            !directives(&rendered)
                .iter()
                .any(|(_, sources)| sources.contains(&refused.as_str()))
        );

        policy
            .add_source(CspDirective::ConnectSrc, "https://first.example".into())
            .unwrap();
        assert_eq!(policy.render(), rendered);
    }

    // IndexHtmlBuilder
    #[test]
    fn builder_rollback_removes_csp_sources_of_package() {
        let root = IndexHtmlBuilder::new();
        root.share("a.ext")
            .add_csp_source(CspDirective::ScriptSrc, "https://a.example");
        root.share("b.ext")
            .add_csp_source(CspDirective::StyleSrc, "https://b.example");
        root.share("c.ext")
            .add_csp_source(CspDirective::ConnectSrc, "https://c.example")
            .add_csp_sources(CspDirective::ImgSrc, |_| {
                Ok(vec!["https://c.example".into()])
            });
        root.rollback("c.ext");

        let registered: Vec<_> = root
            .finish()
            .csp_sources
            .iter()
            .map(|sources| (sources.package_name, sources.directive))
            .collect();

        assert_eq!(
            registered,
            [
                ("a.ext", CspDirective::ScriptSrc),
                ("b.ext", CspDirective::StyleSrc)
            ]
        );
    }
}

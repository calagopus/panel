use compact_str::ToCompactString;
use std::sync::{Arc, LazyLock};

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(format!("github.com/calagopus/panel {}", crate::VERSION))
        .build()
        .expect("Failed to create HTTP client")
});

pub struct Captcha {
    settings: Arc<super::settings::Settings>,
}

impl Captcha {
    pub fn new(settings: Arc<super::settings::Settings>) -> Self {
        Self { settings }
    }

    pub async fn verify(
        &self,
        ip: crate::GetIp,
        captcha: Option<String>,
    ) -> Result<(), compact_str::CompactString> {
        let settings = self
            .settings
            .get()
            .await
            .map_err(|e| e.to_compact_string())?;

        let captcha = match captcha {
            Some(c) => c,
            None => {
                if matches!(
                    settings.captcha_provider,
                    super::settings::CaptchaProvider::None
                ) {
                    return Ok(());
                } else {
                    return Err("captcha: required".into());
                }
            }
        };

        match &settings.captcha_provider {
            super::settings::CaptchaProvider::None => Ok(()),
            super::settings::CaptchaProvider::Turnstile { secret_key, .. } => {
                let response = CLIENT
                    .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
                    .json(&serde_json::json!({
                        "secret": secret_key,
                        "response": captcha,
                        "remoteip": ip.to_string(),
                    }))
                    .send()
                    .await
                    .map_err(|err| {
                        tracing::error!(
                            "captcha: turnstile verification request failed: {:?}",
                            err
                        );
                        err.to_compact_string()
                    })?;

                if response.status().is_success() {
                    let body: serde_json::Value = response.json().await.map_err(|err| {
                        tracing::error!(
                            "captcha: turnstile verification response parsing failed: {:?}",
                            err
                        );
                        err.to_compact_string()
                    })?;
                    if let Some(success) = body.get("success")
                        && success.as_bool().unwrap_or(false)
                    {
                        return Ok(());
                    }
                }

                Err("captcha: verification failed".into())
            }
            super::settings::CaptchaProvider::Recaptcha { v3, secret_key, .. } => {
                let response = CLIENT
                    .post("https://www.google.com/recaptcha/api/siteverify")
                    .form(&[
                        ("secret", secret_key.as_str()),
                        ("response", captcha.as_str()),
                        ("remoteip", ip.to_string().as_str()),
                    ])
                    .send()
                    .await
                    .map_err(|err| {
                        tracing::error!(
                            "captcha: recaptcha verification request failed: {:?}",
                            err
                        );
                        err.to_compact_string()
                    })?;

                if response.status().is_success() {
                    let body: serde_json::Value = response.json().await.map_err(|err| {
                        tracing::error!(
                            "captcha: recaptcha verification response parsing failed: {:?}",
                            err
                        );
                        err.to_compact_string()
                    })?;
                    if let Some(success) = body.get("success")
                        && success.as_bool().unwrap_or(false)
                    {
                        if *v3 {
                            if let Some(score) = body.get("score")
                                && score.as_f64().unwrap_or(0.0) >= 0.5
                            {
                                return Ok(());
                            }
                        } else {
                            return Ok(());
                        }
                    }
                }

                Err("captcha: verification failed".into())
            }
            super::settings::CaptchaProvider::Hcaptcha {
                secret_key,
                site_key,
            } => {
                let response = CLIENT
                    .post("https://hcaptcha.com/siteverify")
                    .form(&[
                        ("secret", secret_key.as_str()),
                        ("sitekey", site_key.as_str()),
                        ("response", captcha.as_str()),
                        ("remoteip", ip.to_string().as_str()),
                    ])
                    .send()
                    .await
                    .map_err(|err| {
                        tracing::error!("captcha: hcaptcha verification request failed: {:?}", err);
                        err.to_compact_string()
                    })?;

                if response.status().is_success() {
                    let body: serde_json::Value = response.json().await.map_err(|err| {
                        tracing::error!(
                            "captcha: hcaptcha verification response parsing failed: {:?}",
                            err
                        );
                        err.to_compact_string()
                    })?;
                    if let Some(success) = body.get("success")
                        && success.as_bool().unwrap_or(false)
                    {
                        return Ok(());
                    }
                }

                Err("captcha: verification failed".into())
            }
            super::settings::CaptchaProvider::FriendlyCaptcha { api_key, site_key } => {
                let response = CLIENT
                    .post("https://global.frcapi.com/api/v2/captcha/siteverify")
                    .header("X-API-Key", api_key.as_str())
                    .json(&serde_json::json!({
                        "sitekey": site_key.as_str(),
                        "response": captcha.as_str(),
                    }))
                    .send()
                    .await
                    .map_err(|err| {
                        tracing::error!(
                            "captcha: friendlycaptcha verification request failed: {:?}",
                            err
                        );
                        err.to_compact_string()
                    })?;

                if response.status().is_success() {
                    let body: serde_json::Value = response.json().await.map_err(|err| {
                        tracing::error!(
                            "captcha: friendlycaptcha verification response parsing failed: {:?}",
                            err
                        );
                        err.to_compact_string()
                    })?;
                    if let Some(success) = body.get("success")
                        && success.as_bool().unwrap_or(false)
                    {
                        return Ok(());
                    }
                }

                Err("captcha: verification failed".into())
            }
        }
    }
}

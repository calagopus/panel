use std::sync::LazyLock;

pub const USER_AGENT: &str = "Calagopus Panel";

pub static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("Failed to create reqwest client")
});

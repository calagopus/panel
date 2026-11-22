use std::{sync::LazyLock, time::Duration};

pub const USER_AGENT: &str = "Calagopus Panel";

// no read_timeout: reqwest only resets it once headers arrive, which would kill streamed
// uploads/imports and foreground wings ops. dead peers are caught by keepalive/user_timeout.
pub static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .tcp_keepalive(Duration::from_secs(15))
        .tcp_keepalive_interval(Duration::from_secs(15))
        .tcp_keepalive_retries(3)
        .tcp_user_timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create reqwest client")
});

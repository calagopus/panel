pub const CENSORED_PLACEHOLDER: &str = "";

/// Implemented by values carrying secrets, so each one names its own instead of a central list
/// having to track them.
///
/// Censoring happens in place and on an owned value rather than during serialization: the same
/// [`serde::Serialize`] impls back both the API responses and the `jsonb` columns these values are
/// stored in, so a serializer that censored would write the placeholder to the database.
pub trait Censor {
    /// Overwrite every secret this value carries, leaving everything else intact.
    fn censor(&mut self);

    #[inline]
    fn censored(mut self) -> Self
    where
        Self: Sized,
    {
        self.censor();
        self
    }
}

impl<T: Censor> Censor for Option<T> {
    fn censor(&mut self) {
        if let Some(value) = self {
            value.censor();
        }
    }
}

impl Censor for wings_api::Config {
    fn censor(&mut self) {
        self.token_id = CENSORED_PLACEHOLDER.into();
        self.token = CENSORED_PLACEHOLDER.into();
    }
}

impl Censor for db_agent_api::Config {
    fn censor(&mut self) {
        self.api.token = CENSORED_PLACEHOLDER.into();
    }
}

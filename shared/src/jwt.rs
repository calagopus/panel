use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize, de::DeserializeOwned};

#[derive(Deserialize, Serialize)]
pub struct BasePayload {
    #[serde(rename = "iss")]
    pub issuer: String,
    #[serde(rename = "sub")]
    pub subject: Option<String>,
    #[serde(rename = "aud")]
    pub audience: Vec<String>,
    #[serde(rename = "exp")]
    pub expiration_time: Option<i64>,
    #[serde(rename = "nbf")]
    pub not_before: Option<i64>,
    #[serde(rename = "iat")]
    pub issued_at: Option<i64>,
    #[serde(rename = "jti")]
    pub jwt_id: String,
}

impl BasePayload {
    pub fn validate(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        if let Some(exp) = self.expiration_time {
            if exp < now {
                return false;
            }
        } else {
            return false;
        }
        if let Some(nbf) = self.not_before
            && nbf > now
        {
            return false;
        }
        if let Some(iat) = self.issued_at {
            if iat > now {
                return false;
            }
        } else {
            return false;
        }
        true
    }
}

pub struct Jwt {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl Jwt {
    pub fn new(env: &crate::env::Env) -> Self {
        let secret = env.app_encryption_key.as_bytes();
        Self {
            encoding_key: EncodingKey::from_secret(secret),
            decoding_key: DecodingKey::from_secret(secret),
        }
    }

    #[inline]
    pub fn verify<T: DeserializeOwned>(
        &self,
        token: &str,
    ) -> Result<T, jsonwebtoken::errors::Error> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_aud = false;
        validation.required_spec_claims.clear();
        let data = jsonwebtoken::decode::<T>(token, &self.decoding_key, &validation)?;
        Ok(data.claims)
    }

    #[inline]
    pub fn create<T: Serialize>(&self, payload: &T) -> Result<String, jsonwebtoken::errors::Error> {
        jsonwebtoken::encode(&Header::new(Algorithm::HS256), payload, &self.encoding_key)
    }

    #[inline]
    pub fn create_custom<T: Serialize>(
        &self,
        key: &[u8],
        payload: &T,
    ) -> Result<String, jsonwebtoken::errors::Error> {
        let encoding_key = EncodingKey::from_secret(key);
        jsonwebtoken::encode(&Header::new(Algorithm::HS256), payload, &encoding_key)
    }
}

use sha2::Digest;
use std::sync::LazyLock;

const BCRYPT_COST: u32 = 12;
const DUMMY_HASH: &str = "$2a$12$am3C/uakIz4zE7LHEEPjI.CmfRECf79hfaThUs801uJVg0vGFRg1y";

static SEMAPHORE: LazyLock<tokio::sync::Semaphore> = LazyLock::new(|| {
    tokio::sync::Semaphore::new(
        std::thread::available_parallelism()
            .map(|n| n.get() * 2)
            .unwrap_or(4),
    )
});

/// A bcrypt hash as stored in the database.
///
/// Emits `$2a$` rather than the crate default `$2b$`, as pgcrypto silently falls back to DES for `$2b$`.
#[derive(Debug, Clone, PartialEq, Eq, sqlx::Type)]
#[sqlx(transparent)]
pub struct BcryptString(String);

impl BcryptString {
    fn hash_blocking(password: &str) -> Result<Self, bcrypt::BcryptError> {
        bcrypt::hash_with_result(password, BCRYPT_COST)
            .map(|parts| Self(parts.format_for_version(bcrypt::Version::TwoA)))
    }

    pub async fn hash(password: &str) -> Result<Self, anyhow::Error> {
        let password = password.to_owned();
        let _permit = SEMAPHORE.acquire().await?;

        Ok(tokio::task::spawn_blocking(move || Self::hash_blocking(&password)).await??)
    }

    pub async fn verify(&self, password: &str) -> Result<bool, anyhow::Error> {
        let password = password.to_owned();
        let hash = self.0.clone();
        let _permit = SEMAPHORE.acquire().await?;

        Ok(tokio::task::spawn_blocking(move || bcrypt::verify(password, &hash)).await??)
    }

    /// Burns the same time a real verification would so a missing user or a user without a password
    /// is indistinguishable from a wrong password.
    pub async fn verify_dummy(password: &str) -> Result<(), anyhow::Error> {
        Self(DUMMY_HASH.to_owned()).verify(password).await?;

        Ok(())
    }

    #[inline]
    pub fn needs_rehash(&self) -> bool {
        !self.0.starts_with(&format!("$2a${BCRYPT_COST:02}$"))
    }
}

impl AsRef<str> for BcryptString {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

/// An encrypted string as stored in the database.
///
/// Stores the encrypted bytes of the original plaintext.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncryptedString(tokio_util::bytes::Bytes);

impl EncryptedString {
    #[inline]
    pub fn blocking_from_plaintext(
        plaintext: impl AsRef<[u8]>,
        database: &super::database::Database,
    ) -> Result<Self, anyhow::Error> {
        database
            .blocking_encrypt(plaintext.as_ref())
            .map(|bytes| Self(bytes.into()))
    }

    #[inline]
    pub async fn from_plaintext(
        plaintext: impl AsRef<[u8]> + Send + 'static,
        database: &super::database::Database,
    ) -> Result<Self, anyhow::Error> {
        database
            .encrypt(plaintext)
            .await
            .map(|bytes| Self(bytes.into()))
    }

    #[inline]
    pub async fn from_plaintext_with_input<P: AsRef<[u8]> + Send + 'static>(
        plaintext: P,
        database: &super::database::Database,
    ) -> Result<(P, Self), anyhow::Error> {
        database
            .encrypt_with_input(plaintext)
            .await
            .map(|(plaintext, bytes)| (plaintext, Self(bytes.into())))
    }

    #[inline]
    pub fn blocking_decrypt(
        &self,
        database: &super::database::Database,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        database.blocking_decrypt(&self.0)
    }

    #[inline]
    pub async fn decrypt(
        &self,
        database: &super::database::Database,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        database.decrypt(self.0.clone()).await
    }
}

impl AsRef<[u8]> for EncryptedString {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// Serialized as a byte string, which msgpack stores as a `bin` rather than the array a `Vec<u8>`
/// produces, around a third smaller for ciphertext. Both forms are accepted on the way back in, so
/// entries cached as either decode.
impl serde::Serialize for EncryptedString {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_bytes(&self.0)
    }
}
impl<'de> serde::Deserialize<'de> for EncryptedString {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct EncryptedStringVisitor;

        impl<'de> serde::de::Visitor<'de> for EncryptedStringVisitor {
            type Value = EncryptedString;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a byte string or a sequence of bytes")
            }

            fn visit_bytes<E: serde::de::Error>(self, bytes: &[u8]) -> Result<Self::Value, E> {
                Ok(EncryptedString(tokio_util::bytes::Bytes::copy_from_slice(
                    bytes,
                )))
            }

            fn visit_byte_buf<E: serde::de::Error>(self, bytes: Vec<u8>) -> Result<Self::Value, E> {
                Ok(EncryptedString(bytes.into()))
            }

            fn visit_seq<A: serde::de::SeqAccess<'de>>(
                self,
                mut seq: A,
            ) -> Result<Self::Value, A::Error> {
                let mut bytes = Vec::with_capacity(seq.size_hint().unwrap_or_default());

                while let Some(byte) = seq.next_element()? {
                    bytes.push(byte);
                }

                Ok(EncryptedString(bytes.into()))
            }
        }

        deserializer.deserialize_byte_buf(EncryptedStringVisitor)
    }
}

impl sqlx::Type<sqlx::Postgres> for EncryptedString {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <[u8] as sqlx::Type<sqlx::Postgres>>::type_info()
    }

    fn compatible(ty: &sqlx::postgres::PgTypeInfo) -> bool {
        <[u8] as sqlx::Type<sqlx::Postgres>>::compatible(ty)
    }
}
impl sqlx::Encode<'_, sqlx::Postgres> for EncryptedString {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> Result<sqlx::encode::IsNull, sqlx::error::BoxDynError> {
        <&[u8] as sqlx::Encode<sqlx::Postgres>>::encode(&self.0, buf)
    }

    fn size_hint(&self) -> usize {
        self.0.len()
    }
}
impl sqlx::Decode<'_, sqlx::Postgres> for EncryptedString {
    fn decode(value: sqlx::postgres::PgValueRef<'_>) -> Result<Self, sqlx::error::BoxDynError> {
        Ok(Self(match value.format() {
            sqlx::postgres::PgValueFormat::Binary => {
                tokio_util::bytes::Bytes::copy_from_slice(value.as_bytes()?)
            }
            sqlx::postgres::PgValueFormat::Text => hex::decode(
                value
                    .as_bytes()?
                    .strip_prefix(b"\\x")
                    .ok_or("text does not start with \\x")?,
            )?
            .into(),
        }))
    }
}

/// Random high-entropy tokens (sessions, api keys) are stored as a plain digest, a KDF buys nothing
/// against a 256-bit preimage and the deterministic value makes the unique index a real lookup.
#[inline]
pub fn token_digest(token: &str) -> String {
    hex::encode(sha2::Sha256::digest(token.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hash_emits_two_a_at_current_cost() {
        let hash = BcryptString::hash("hunter2").await.unwrap();

        assert!(hash.0.starts_with("$2a$12$"));
        assert_eq!(hash.0.len(), 60);
        assert!(!hash.needs_rehash());
    }

    #[tokio::test]
    async fn verify_roundtrip() {
        let hash = BcryptString::hash("hunter2").await.unwrap();

        assert!(hash.verify("hunter2").await.unwrap());
        assert!(!hash.verify("hunter3").await.unwrap());
    }

    #[tokio::test]
    async fn verify_accepts_imported_variants() {
        let two_y = BcryptString(
            bcrypt::hash_with_result("hunter2", 4)
                .unwrap()
                .format_for_version(bcrypt::Version::TwoY),
        );
        let two_a_low_cost = BcryptString(
            bcrypt::hash_with_result("hunter2", 6)
                .unwrap()
                .format_for_version(bcrypt::Version::TwoA),
        );

        assert!(two_y.verify("hunter2").await.unwrap());
        assert!(two_a_low_cost.verify("hunter2").await.unwrap());
        assert!(two_y.needs_rehash());
        assert!(two_a_low_cost.needs_rehash());
    }

    #[tokio::test]
    async fn verify_dummy_does_not_fail() {
        BcryptString::verify_dummy("anything").await.unwrap();
    }

    #[test]
    fn dummy_hash_is_at_current_cost() {
        assert!(!BcryptString(DUMMY_HASH.to_owned()).needs_rehash());
    }

    #[test]
    fn encrypted_string_encodes_raw_bytes() {
        let encrypted = EncryptedString(tokio_util::bytes::Bytes::from_static(b"\x00\xffabc"));
        let mut buf = sqlx::postgres::PgArgumentBuffer::default();

        let is_null =
            <EncryptedString as sqlx::Encode<sqlx::Postgres>>::encode_by_ref(&encrypted, &mut buf)
                .unwrap();

        assert!(!is_null.is_null());
        assert_eq!(&**buf, b"\x00\xffabc");
        assert_eq!(
            <EncryptedString as sqlx::Encode<sqlx::Postgres>>::size_hint(&encrypted),
            5
        );
    }

    #[test]
    fn encrypted_string_serializes_as_a_msgpack_bin() {
        let encrypted = EncryptedString(tokio_util::bytes::Bytes::from_static(b"\x00\xffabc"));
        let encoded = rmp_serde::to_vec(&encrypted).unwrap();

        assert_eq!(encoded, b"\xc4\x05\x00\xffabc");
        assert_eq!(
            rmp_serde::from_slice::<EncryptedString>(&encoded).unwrap(),
            encrypted
        );
    }

    #[test]
    fn encrypted_string_decodes_the_vec_form_it_replaced() {
        let bytes: Vec<u8> = (0..=255).collect();
        let encrypted = EncryptedString(bytes.clone().into());

        assert_eq!(
            rmp_serde::from_slice::<EncryptedString>(&rmp_serde::to_vec(&bytes).unwrap()).unwrap(),
            encrypted
        );
        assert!(
            rmp_serde::to_vec(&encrypted).unwrap().len() < rmp_serde::to_vec(&bytes).unwrap().len()
        );
    }

    #[test]
    fn encrypted_string_round_trips_through_json() {
        let encrypted = EncryptedString(tokio_util::bytes::Bytes::from_static(b"\x00\xffabc"));
        let encoded = serde_json::to_string(&encrypted).unwrap();

        assert_eq!(encoded, "[0,255,97,98,99]");
        assert_eq!(
            serde_json::from_str::<EncryptedString>(&encoded).unwrap(),
            encrypted
        );
    }

    #[test]
    fn token_digest_is_deterministic_hex_sha256() {
        let digest = token_digest("c7sp_abc");

        assert_eq!(digest.len(), 64);
        assert_eq!(digest, token_digest("c7sp_abc"));
        assert_ne!(digest, token_digest("c7sp_abd"));
    }
}

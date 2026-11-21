use argon2::{PasswordHasher, PasswordVerifier};
use sha2::Digest;
use std::{ops::RangeInclusive, sync::LazyLock};

const ARGON2_MEMORY_BUDGET_MIB: u32 = 1024;

static SEMAPHORE: LazyLock<tokio::sync::Semaphore> = LazyLock::new(|| {
    tokio::sync::Semaphore::new(
        std::thread::available_parallelism()
            .map(|n| n.get() * 2)
            .unwrap_or(4),
    )
});
static MEMORY_SEMAPHORE: LazyLock<tokio::sync::Semaphore> =
    LazyLock::new(|| tokio::sync::Semaphore::new(ARGON2_MEMORY_BUDGET_MIB as usize));

async fn run_hash_job<T: Send + 'static>(
    memory_mib: u32,
    job: impl FnOnce() -> Result<T, anyhow::Error> + Send + 'static,
) -> Result<T, anyhow::Error> {
    let _memory_permit = if memory_mib > 0 {
        Some(
            MEMORY_SEMAPHORE
                .acquire_many(memory_mib.min(ARGON2_MEMORY_BUDGET_MIB))
                .await?,
        )
    } else {
        None
    };
    let _permit = SEMAPHORE.acquire().await?;

    tokio::task::spawn_blocking(job).await?
}

/// The algorithm new user password hashes are written with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PasswordAlgorithm {
    Bcrypt { cost: u32 },
    Argon2id { memory_mib: u32, iterations: u32 },
}

impl PasswordAlgorithm {
    pub const BCRYPT_COST: RangeInclusive<u32> = 10..=16;
    pub const ARGON2_MEMORY_MIB: RangeInclusive<u32> = 19..=ARGON2_MEMORY_BUDGET_MIB;
    pub const ARGON2_ITERATIONS: RangeInclusive<u32> = 1..=16;

    pub fn bcrypt(cost: u32) -> Result<Self, anyhow::Error> {
        if !Self::BCRYPT_COST.contains(&cost) {
            return Err(anyhow::anyhow!(
                "bcrypt cost must be between {} and {}",
                Self::BCRYPT_COST.start(),
                Self::BCRYPT_COST.end()
            ));
        }

        Ok(Self::Bcrypt { cost })
    }

    pub fn argon2id(memory_mib: u32, iterations: u32) -> Result<Self, anyhow::Error> {
        if !Self::ARGON2_MEMORY_MIB.contains(&memory_mib) {
            return Err(anyhow::anyhow!(
                "argon2 memory must be between {} and {} MiB",
                Self::ARGON2_MEMORY_MIB.start(),
                Self::ARGON2_MEMORY_MIB.end()
            ));
        }
        if !Self::ARGON2_ITERATIONS.contains(&iterations) {
            return Err(anyhow::anyhow!(
                "argon2 iterations must be between {} and {}",
                Self::ARGON2_ITERATIONS.start(),
                Self::ARGON2_ITERATIONS.end()
            ));
        }

        Ok(Self::Argon2id {
            memory_mib,
            iterations,
        })
    }

    #[inline]
    fn memory_mib(self) -> u32 {
        match self {
            Self::Bcrypt { .. } => 0,
            Self::Argon2id { memory_mib, .. } => memory_mib,
        }
    }

    /// The prefix every hash written with this algorithm starts with, up to the salt.
    fn hash_prefix(self) -> String {
        match self {
            Self::Bcrypt { cost } => format!("$2a${cost:02}$"),
            Self::Argon2id {
                memory_mib,
                iterations,
            } => format!("$argon2id$v=19$m={},t={iterations},p=1$", memory_mib * 1024),
        }
    }
}

/// A user password hash as stored in the database, bcrypt or argon2 in PHC format.
///
/// bcrypt is emitted as `$2a$` rather than the crate default `$2b$`, as pgcrypto silently falls back
/// to DES for `$2b$`.
#[derive(Debug, Clone, PartialEq, Eq, sqlx::Type)]
#[sqlx(transparent)]
pub struct PasswordHashString(String);

impl PasswordHashString {
    fn hash_blocking(password: &str, algorithm: PasswordAlgorithm) -> Result<Self, anyhow::Error> {
        match algorithm {
            PasswordAlgorithm::Bcrypt { cost } => Ok(Self(
                bcrypt::hash_with_result(password, cost)?.format_for_version(bcrypt::Version::TwoA),
            )),
            PasswordAlgorithm::Argon2id {
                memory_mib,
                iterations,
            } => {
                let argon2 = argon2::Argon2::new(
                    argon2::Algorithm::Argon2id,
                    argon2::Version::V0x13,
                    argon2::Params::new(memory_mib * 1024, iterations, 1, None)?,
                );

                Ok(Self(argon2.hash_password(password.as_bytes())?.to_string()))
            }
        }
    }

    pub async fn hash(password: &str, algorithm: PasswordAlgorithm) -> Result<Self, anyhow::Error> {
        let password = password.to_owned();

        run_hash_job(algorithm.memory_mib(), move || {
            Self::hash_blocking(&password, algorithm)
        })
        .await
    }

    pub async fn verify(&self, password: &str) -> Result<bool, anyhow::Error> {
        let password = password.to_owned();

        if self.0.starts_with("$argon2") {
            let hash = argon2::PasswordHash::new(&self.0)?;
            let memory_mib = argon2::Params::try_from(&hash)?.m_cost().div_ceil(1024);

            return run_hash_job(memory_mib, move || {
                match argon2::Argon2::default().verify_password(password.as_bytes(), &hash) {
                    Ok(()) => Ok(true),
                    Err(argon2::password_hash::Error::PasswordInvalid) => Ok(false),
                    Err(err) => Err(err.into()),
                }
            })
            .await;
        }

        let hash = self.0.clone();

        run_hash_job(0, move || Ok(bcrypt::verify(password, &hash)?)).await
    }

    pub async fn verify_dummy(
        password: &str,
        algorithm: PasswordAlgorithm,
    ) -> Result<(), anyhow::Error> {
        Self::hash(password, algorithm).await?;

        Ok(())
    }

    #[inline]
    pub fn needs_rehash(&self, algorithm: PasswordAlgorithm) -> bool {
        !self.0.starts_with(&algorithm.hash_prefix())
    }
}

impl AsRef<str> for PasswordHashString {
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

    // PasswordAlgorithm
    #[test]
    fn password_algorithm_constructors_accept_bounds_and_reject_outside() {
        assert!(PasswordAlgorithm::bcrypt(9).is_err());
        assert!(PasswordAlgorithm::bcrypt(10).is_ok());
        assert!(PasswordAlgorithm::bcrypt(16).is_ok());
        assert!(PasswordAlgorithm::bcrypt(17).is_err());

        assert!(PasswordAlgorithm::argon2id(18, 1).is_err());
        assert!(PasswordAlgorithm::argon2id(19, 1).is_ok());
        assert!(PasswordAlgorithm::argon2id(1024, 16).is_ok());
        assert!(PasswordAlgorithm::argon2id(1025, 1).is_err());
        assert!(PasswordAlgorithm::argon2id(19, 0).is_err());
        assert!(PasswordAlgorithm::argon2id(19, 17).is_err());
    }

    // PasswordHashString
    #[tokio::test]
    async fn password_hash_round_trips_under_both_algorithms() {
        for algorithm in [
            PasswordAlgorithm::bcrypt(10).unwrap(),
            PasswordAlgorithm::argon2id(19, 1).unwrap(),
        ] {
            let hash = PasswordHashString::hash("hunter2", algorithm)
                .await
                .unwrap();

            assert!(hash.verify("hunter2").await.unwrap(), "{algorithm:?}");
            assert!(!hash.verify("hunter3").await.unwrap(), "{algorithm:?}");
        }
    }

    #[tokio::test]
    async fn password_hash_from_other_algorithm_verifies_and_needs_rehash() {
        let bcrypt = PasswordAlgorithm::bcrypt(10).unwrap();
        let argon2 = PasswordAlgorithm::argon2id(19, 1).unwrap();

        for (from, to) in [(bcrypt, argon2), (argon2, bcrypt)] {
            let hash = PasswordHashString::hash("hunter2", from).await.unwrap();

            assert!(hash.needs_rehash(to), "{from:?} -> {to:?}");
            assert!(hash.verify("hunter2").await.unwrap(), "{from:?} -> {to:?}");
        }
    }

    #[tokio::test]
    async fn password_hash_needs_rehash_on_any_config_change_and_converges() {
        let cases = [
            (
                PasswordAlgorithm::bcrypt(10).unwrap(),
                PasswordAlgorithm::bcrypt(11).unwrap(),
            ),
            (
                PasswordAlgorithm::argon2id(19, 1).unwrap(),
                PasswordAlgorithm::argon2id(20, 1).unwrap(),
            ),
            (
                PasswordAlgorithm::argon2id(19, 1).unwrap(),
                PasswordAlgorithm::argon2id(19, 2).unwrap(),
            ),
        ];

        for (from, to) in cases {
            let hash = PasswordHashString::hash("hunter2", from).await.unwrap();
            assert!(!hash.needs_rehash(from), "{from:?}");
            assert!(hash.needs_rehash(to), "{from:?} -> {to:?}");

            let rehashed = PasswordHashString::hash("hunter2", to).await.unwrap();
            assert!(!rehashed.needs_rehash(to), "{to:?}");
        }
    }

    #[tokio::test]
    async fn password_hash_bcrypt_is_2a_never_2b() {
        let hash = PasswordHashString::hash("hunter2", PasswordAlgorithm::bcrypt(10).unwrap())
            .await
            .unwrap();

        assert!(hash.as_ref().starts_with("$2a$10$"), "{}", hash.as_ref());
        assert!(!hash.as_ref().starts_with("$2b$"));
    }

    #[tokio::test]
    async fn password_hash_imported_bcrypt_variants_verify_and_need_rehash() {
        let algorithm = PasswordAlgorithm::bcrypt(12).unwrap();
        let variants = [
            bcrypt::hash_with_result("hunter2", 12)
                .unwrap()
                .format_for_version(bcrypt::Version::TwoY),
            bcrypt::hash_with_result("hunter2", 12)
                .unwrap()
                .format_for_version(bcrypt::Version::TwoB),
            bcrypt::hash_with_result("hunter2", 10)
                .unwrap()
                .format_for_version(bcrypt::Version::TwoA),
        ];

        for variant in variants {
            let hash = PasswordHashString(variant);

            assert!(hash.verify("hunter2").await.unwrap(), "{hash:?}");
            assert!(!hash.verify("hunter3").await.unwrap(), "{hash:?}");
            assert!(hash.needs_rehash(algorithm), "{hash:?}");
        }
    }

    #[tokio::test]
    async fn password_hash_foreign_argon2_verifies_and_needs_rehash() {
        let algorithm = PasswordAlgorithm::argon2id(19, 1).unwrap();

        for (t_cost, p_cost) in [(2, 1), (1, 2)] {
            let foreign = argon2::Argon2::new(
                argon2::Algorithm::Argon2id,
                argon2::Version::V0x13,
                argon2::Params::new(19 * 1024, t_cost, p_cost, None).unwrap(),
            )
            .hash_password_with_salt(b"hunter2", b"somesaltsomesalt")
            .unwrap()
            .to_string();
            let hash = PasswordHashString(foreign);

            assert!(hash.verify("hunter2").await.unwrap(), "{hash:?}");
            assert!(!hash.verify("hunter3").await.unwrap(), "{hash:?}");
            assert!(hash.needs_rehash(algorithm), "{hash:?}");
        }
    }

    #[tokio::test]
    async fn password_hash_malformed_argon2_errors() {
        let hash = PasswordHashString("$argon2id$v=19$garbage".to_string());

        assert!(hash.verify("hunter2").await.is_err());
    }

    #[tokio::test]
    async fn password_hash_verify_dummy_succeeds_under_both_algorithms() {
        for algorithm in [
            PasswordAlgorithm::bcrypt(10).unwrap(),
            PasswordAlgorithm::argon2id(19, 1).unwrap(),
        ] {
            PasswordHashString::verify_dummy("hunter2", algorithm)
                .await
                .unwrap();
        }
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

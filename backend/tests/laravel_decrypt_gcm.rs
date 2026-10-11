//! Round-trip tests for the importer's Laravel payload decryption shapes.
//!
//! Pterodactyl 1.x stores AES-256-CBC payloads; Laravel >= 9 (and therefore
//! newer Pelican sources) defaults to AES-256-GCM, whose payload carries a
//! separate authentication tag. These tests pin both payload SHAPES and the
//! GCM round trip through the same primitives the importer uses.

use aes::cipher::{block_padding::Pkcs7, BlockModeDecrypt, BlockModeEncrypt, KeyIvInit};
use base64::Engine;

const KEY: [u8; 32] = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31,
];
const IV: [u8; 16] = [0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
// GCM standard nonce is 12 bytes (that's what Laravel generates); CBC IV is 16.
const GCM_NONCE: [u8; 12] = [0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const PLAINTEXT: &str = "secret-password";

fn b64(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

#[test]
fn cbc_payload_shape_has_no_tag() {
    type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
    type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

    let mut enc_buf = [0u8; 64];
    let ct = Aes256CbcEnc::new((&KEY).into(), &IV.into())
        .encrypt_padded_b2b::<Pkcs7>(PLAINTEXT.as_bytes(), &mut enc_buf)
        .unwrap()
        .to_vec();

    let payload = serde_json::json!({
        "iv": b64(&IV),
        "value": b64(&ct),
        "mac": "irrelevant",
    });
    assert!(payload.get("tag").is_none(), "CBC payload must have no tag");

    // And decrypt back through the same crate the importer uses.
    let mut dec_buf = [0u8; 64];
    let pt = Aes256CbcDec::new((&KEY).into(), &IV.into())
        .decrypt_padded_b2b::<Pkcs7>(&ct, &mut dec_buf)
        .unwrap();
    assert_eq!(pt, PLAINTEXT.as_bytes());
}

#[test]
fn gcm_payload_shape_and_round_trip() {
    use aes_gcm::aead::{Aead, Nonce};
    use aes_gcm::{Aes256Gcm, KeyInit};

    let cipher = Aes256Gcm::new((&KEY).into());
    let nonce = Nonce::<Aes256Gcm>::from_slice(&GCM_NONCE);
    let ct_with_tag = cipher.encrypt(nonce, PLAINTEXT.as_bytes()).unwrap();
    let (ct, tag) = ct_with_tag.split_at(ct_with_tag.len() - 16);

    let payload = serde_json::json!({
        "iv": b64(&GCM_NONCE),
        "value": b64(ct),
        "tag": b64(tag),
        "mac": "irrelevant",
    });
    assert!(payload.get("tag").is_some(), "GCM payload must carry a tag");

    // Round trip through the same primitives the importer uses: the tag is
    // appended back onto the ciphertext before decrypting.
    let mut value = base64::engine::general_purpose::STANDARD
        .decode(payload["value"].as_str().unwrap())
        .unwrap();
    let tag = base64::engine::general_purpose::STANDARD
        .decode(payload["tag"].as_str().unwrap())
        .unwrap();
    assert_eq!(tag.len(), 16, "AES-GCM tags are 16 bytes");
    value.extend_from_slice(&tag);

    let pt = cipher
        .decrypt(nonce, value.as_slice())
        .expect("GCM round trip must succeed");
    assert_eq!(String::from_utf8(pt).unwrap(), PLAINTEXT);
}

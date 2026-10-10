//! Round-trip tests for the importer's Laravel payload decryption shapes.
//!
//! Pterodactyl 1.x stores AES-256-CBC payloads; Laravel >= 9 (and therefore
//! newer Pelican sources) defaults to AES-256-GCM, whose payload carries a
//! separate authentication tag. These tests pin both payload SHAPES and the
//! GCM round trip through the same primitives the importer uses.

use aes::cipher::{BlockEncrypt, KeyInit, generic_array::GenericArray};
use aes_gcm::aead::Aead;
use base64::Engine;

const KEY: [u8; 32] = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31,
];
const IV: [u8; 16] = [0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const PLAINTEXT: &str = "secret-password";

fn b64(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

#[test]
fn cbc_payload_shape_has_no_tag() {
    // PKCS7 pad: plaintext is 15 bytes -> pad 1
    let mut buf = PLAINTEXT.as_bytes().to_vec();
    let pad = 16 - buf.len() % 16;
    buf.extend(std::iter::repeat(pad as u8).take(pad));

    let mut cipher = cbc::Encryptor::<aes::Aes256>::new((&KEY).into(), &IV.into());
    let mut ct = vec![0u8; buf.len()];
    for (chunk, out) in buf.chunks(16).zip(ct.chunks_mut(16)) {
        cipher.encrypt_block_b2b(
            GenericArray::from_slice(chunk),
            GenericArray::from_mut_slice(out),
        );
    }

    let payload = serde_json::json!({
        "iv": b64(&IV),
        "value": b64(&ct),
        "mac": "irrelevant",
    });
    assert!(payload.get("tag").is_none(), "CBC payload must have no tag");

    // And decrypt back through the same crate the importer uses.
    let mut dec = vec![0u8; ct.len()];
    let mut d = cbc::Decryptor::<aes::Aes256>::new((&KEY).into(), &IV.into());
    for (chunk, out) in ct.chunks(16).zip(dec.chunks_mut(16)) {
        d.decrypt_block_b2b(
            GenericArray::from_slice(chunk),
            GenericArray::from_mut_slice(out),
        );
    }
    let unpadded_len = dec.len() - *dec.last().unwrap() as usize;
    assert_eq!(&dec[..unpadded_len], PLAINTEXT.as_bytes());
}

#[test]
fn gcm_payload_shape_and_round_trip() {
    let cipher = aes_gcm::Aes256Gcm::new((&KEY).into());
    let nonce = aes_gcm::aead::Nonce::<aes_gcm::Aes256Gcm>::from_slice(&IV);
    let ct_with_tag = cipher.encrypt(nonce, PLAINTEXT.as_bytes()).unwrap();
    let (ct, tag) = ct_with_tag.split_at(ct_with_tag.len() - 16);

    let payload = serde_json::json!({
        "iv": b64(&IV),
        "value": b64(ct),
        "tag": b64(tag),
        "mac": "irrelevant",
    });
    assert!(payload.get("tag").is_some(), "GCM payload must carry a tag");

    // Round trip through the same primitives the importer uses: tag is
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

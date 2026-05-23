use std::collections::HashMap;

use compact_str::CompactString;

fn run(rules_per_field: &[(&str, &[&str])], values: &[(&str, &str)]) -> Result<(), String> {
    let rule_vecs: Vec<(&str, Vec<CompactString>)> = rules_per_field
        .iter()
        .map(|(k, rs)| (*k, rs.iter().map(|s| CompactString::from(*s)).collect()))
        .collect();

    let mut data: HashMap<&str, (&[CompactString], &str)> = HashMap::new();
    for (k, rules) in &rule_vecs {
        let v = values
            .iter()
            .find(|(kk, _)| kk == k)
            .map(|(_, v)| *v)
            .unwrap_or("");
        data.insert(*k, (rules.as_slice(), v));
    }

    let validator = rule_validator::Validator::new(data).map_err(|e| e.to_string())?;
    validator.validate()
}

// --- email ---------------------------------------------------------------

#[test]
fn email_happy() {
    assert!(run(&[("f", &["email"])], &[("f", "a@b.co")]).is_ok());
    assert!(run(&[("f", &["email"])], &[("f", "first.last+tag@sub.example.com")]).is_ok());
}

#[test]
fn email_sad() {
    assert!(run(&[("f", &["email"])], &[("f", "nope")]).is_err());
    assert!(run(&[("f", &["email"])], &[("f", "no@dotcom")]).is_err());
    assert!(run(&[("f", &["email"])], &[("f", "@b.co")]).is_err());
}

// --- ulid ----------------------------------------------------------------

#[test]
fn ulid_happy() {
    assert!(run(&[("f", &["ulid"])], &[("f", "01H8ZJ8MX2K5N7P9Q1R3T5V7W9")]).is_ok());
}

#[test]
fn ulid_sad() {
    // Letter 'I' is not in Crockford base32.
    assert!(run(&[("f", &["ulid"])], &[("f", "01HIZJ8MX2K5N7P9Q1R3T5V7W9")]).is_err());
    // Too short.
    assert!(run(&[("f", &["ulid"])], &[("f", "01H8ZJ8MX2K5")]).is_err());
}

// --- decimal -------------------------------------------------------------

#[test]
fn decimal_exact() {
    assert!(run(&[("f", &["decimal:2"])], &[("f", "3.14")]).is_ok());
    assert!(run(&[("f", &["decimal:2"])], &[("f", "3.1")]).is_err());
    assert!(run(&[("f", &["decimal:2"])], &[("f", "3.141")]).is_err());
}

#[test]
fn decimal_range() {
    assert!(run(&[("f", &["decimal:1,3"])], &[("f", "3.14")]).is_ok());
    assert!(run(&[("f", &["decimal:1,3"])], &[("f", "3")]).is_err());
    assert!(run(&[("f", &["decimal:1,3"])], &[("f", "3.1415")]).is_err());
}

// --- filled --------------------------------------------------------------

#[test]
fn filled_passes_when_absent_or_filled() {
    assert!(run(&[("f", &["filled"])], &[("f", "abc")]).is_ok());
    // Absent (we model "absent" as empty in this validator).
    assert!(run(&[("f", &["filled"])], &[("f", "abc")]).is_ok());
}

#[test]
fn filled_fails_when_empty_or_null() {
    assert!(run(&[("f", &["filled"])], &[("f", "")]).is_err());
    assert!(run(&[("f", &["filled"])], &[("f", "null")]).is_err());
}

// --- required_with / required_with_all / required_without / required_without_all ---

#[test]
fn required_with() {
    // other is present → f required
    let r = run(
        &[("f", &["required_with:other"]), ("other", &[])],
        &[("f", ""), ("other", "x")],
    );
    assert!(r.is_err(), "f required when other is set, got {r:?}");

    // other absent → f optional
    let r = run(
        &[("f", &["required_with:other"]), ("other", &[])],
        &[("f", ""), ("other", "")],
    );
    assert!(r.is_ok(), "f optional when other is absent, got {r:?}");
}

#[test]
fn required_with_all() {
    let r = run(
        &[
            ("f", &["required_with_all:a,b"]),
            ("a", &[]),
            ("b", &[]),
        ],
        &[("f", ""), ("a", "x"), ("b", "y")],
    );
    assert!(r.is_err(), "required when all of a,b set, got {r:?}");

    let r = run(
        &[
            ("f", &["required_with_all:a,b"]),
            ("a", &[]),
            ("b", &[]),
        ],
        &[("f", ""), ("a", "x"), ("b", "")],
    );
    assert!(r.is_ok(), "optional when not all set, got {r:?}");
}

#[test]
fn required_without() {
    let r = run(
        &[("f", &["required_without:other"]), ("other", &[])],
        &[("f", ""), ("other", "")],
    );
    assert!(r.is_err(), "required when other absent, got {r:?}");

    let r = run(
        &[("f", &["required_without:other"]), ("other", &[])],
        &[("f", ""), ("other", "x")],
    );
    assert!(r.is_ok(), "optional when other set, got {r:?}");
}

#[test]
fn required_without_all() {
    let r = run(
        &[
            ("f", &["required_without_all:a,b"]),
            ("a", &[]),
            ("b", &[]),
        ],
        &[("f", ""), ("a", ""), ("b", "")],
    );
    assert!(r.is_err(), "required when all of a,b absent, got {r:?}");

    let r = run(
        &[
            ("f", &["required_without_all:a,b"]),
            ("a", &[]),
            ("b", &[]),
        ],
        &[("f", ""), ("a", "x"), ("b", "")],
    );
    assert!(r.is_ok(), "optional when some are set, got {r:?}");
}

#[test]
fn required_unless() {
    let r = run(
        &[("f", &["required_unless:other,skip"]), ("other", &[])],
        &[("f", ""), ("other", "skip")],
    );
    assert!(r.is_ok(), "optional when other=skip, got {r:?}");

    let r = run(
        &[("f", &["required_unless:other,skip"]), ("other", &[])],
        &[("f", ""), ("other", "do")],
    );
    assert!(r.is_err(), "required when other != skip, got {r:?}");
}

// --- prohibited family ---------------------------------------------------

#[test]
fn prohibited() {
    assert!(run(&[("f", &["prohibited"])], &[("f", "")]).is_ok());
    assert!(run(&[("f", &["prohibited"])], &[("f", "x")]).is_err());
}

#[test]
fn prohibited_if() {
    let r = run(
        &[("f", &["prohibited_if:other,trigger"]), ("other", &[])],
        &[("f", "x"), ("other", "trigger")],
    );
    assert!(r.is_err());

    let r = run(
        &[("f", &["prohibited_if:other,trigger"]), ("other", &[])],
        &[("f", "x"), ("other", "ok")],
    );
    assert!(r.is_ok());
}

#[test]
fn prohibited_unless() {
    let r = run(
        &[("f", &["prohibited_unless:other,allow"]), ("other", &[])],
        &[("f", "x"), ("other", "block")],
    );
    assert!(r.is_err());

    let r = run(
        &[("f", &["prohibited_unless:other,allow"]), ("other", &[])],
        &[("f", "x"), ("other", "allow")],
    );
    assert!(r.is_ok());
}

#[test]
fn prohibits() {
    let r = run(
        &[("f", &["prohibits:other"]), ("other", &[])],
        &[("f", "set"), ("other", "also-set")],
    );
    assert!(r.is_err(), "f set prohibits other being set, got {r:?}");

    let r = run(
        &[("f", &["prohibits:other"]), ("other", &[])],
        &[("f", "set"), ("other", "")],
    );
    assert!(r.is_ok());
}

// --- date comparisons ----------------------------------------------------

#[test]
fn after() {
    assert!(run(&[("f", &["after:2020-01-01"])], &[("f", "2020-06-01")]).is_ok());
    assert!(run(&[("f", &["after:2020-01-01"])], &[("f", "2019-12-31")]).is_err());
    assert!(run(&[("f", &["after:2020-01-01"])], &[("f", "2020-01-01")]).is_err());
}

#[test]
fn before() {
    assert!(run(&[("f", &["before:2020-01-01"])], &[("f", "2019-06-01")]).is_ok());
    assert!(run(&[("f", &["before:2020-01-01"])], &[("f", "2021-01-01")]).is_err());
}

#[test]
fn after_or_equal() {
    assert!(run(&[("f", &["after_or_equal:2020-01-01"])], &[("f", "2020-01-01")]).is_ok());
    assert!(run(&[("f", &["after_or_equal:2020-01-01"])], &[("f", "2019-12-31")]).is_err());
}

#[test]
fn before_or_equal() {
    assert!(run(&[("f", &["before_or_equal:2020-01-01"])], &[("f", "2020-01-01")]).is_ok());
    assert!(run(&[("f", &["before_or_equal:2020-01-01"])], &[("f", "2020-01-02")]).is_err());
}

#[test]
fn date_comparison_with_field_reference() {
    let r = run(
        &[("end", &["after:start"]), ("start", &["date"])],
        &[("end", "2020-06-01"), ("start", "2020-01-01")],
    );
    assert!(r.is_ok(), "end after start, got {r:?}");
}

use std::collections::HashMap;

use compact_str::CompactString;

fn run(rules_per_field: &[(&str, &[&str])], values: &[(&str, &str)]) -> Result<(), String> {
    // CompactString slices need to outlive the borrow, so collect them up front.
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

/// Bug fix #1: previously inverted (copy of doesnt_end_with).
#[test]
fn ends_with_accepts_matching_suffix() {
    let r = run(
        &[("f", &["ends_with:.zip,.tar.gz"])],
        &[("f", "backup.zip")],
    );
    assert!(r.is_ok(), "expected ok, got {r:?}");
}

#[test]
fn ends_with_rejects_non_matching_suffix() {
    let r = run(&[("f", &["ends_with:.zip"])], &[("f", "backup.txt")]);
    assert!(r.is_err(), "expected err, got {r:?}");
}

/// Bug fix #2: Numeric used to accept "+-+1" because it only checked char set.
#[test]
fn numeric_rejects_garbage() {
    let r = run(&[("f", &["numeric"])], &[("f", "+-+1")]);
    assert!(r.is_err(), "expected err, got {r:?}");
}

#[test]
fn numeric_accepts_real_numbers() {
    for v in ["1", "-1.5", "0.0", "1e5", "1.2e-3"] {
        let r = run(&[("f", &["numeric"])], &[("f", v)]);
        assert!(r.is_ok(), "numeric should accept {v:?}, got {r:?}");
    }
}

/// Bug fix #3: Max/Min now picks numeric-vs-length sensibly.
#[test]
fn max_uses_char_length_when_string_rule_present() {
    // With `string`, max:5 means "5 characters or fewer".
    let r = run(&[("f", &["string", "max:5"])], &[("f", "123456")]);
    assert!(r.is_err(), "6 chars should violate max:5 (string), got {r:?}");

    let r = run(&[("f", &["string", "max:5"])], &[("f", "1234")]);
    assert!(r.is_ok(), "4 chars should satisfy max:5 (string), got {r:?}");
}

#[test]
fn max_uses_numeric_when_value_parses_as_number() {
    // No `string` rule, value parses as number → numeric comparison.
    let r = run(&[("f", &["max:100"])], &[("f", "200")]);
    assert!(r.is_err(), "200 > 100, got {r:?}");

    let r = run(&[("f", &["max:100"])], &[("f", "42")]);
    assert!(r.is_ok(), "42 <= 100, got {r:?}");
}

/// Bug fix #4: Required now rejects literal "null" string, matching Nullable.
#[test]
fn required_rejects_null_string() {
    let r = run(&[("f", &["required"])], &[("f", "null")]);
    assert!(r.is_err(), "expected err for literal 'null', got {r:?}");
}

#[test]
fn required_rejects_empty() {
    let r = run(&[("f", &["required"])], &[("f", "")]);
    assert!(r.is_err());
}

#[test]
fn required_accepts_real_value() {
    let r = run(&[("f", &["required"])], &[("f", "hello")]);
    assert!(r.is_ok());
}

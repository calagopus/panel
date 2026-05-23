use compact_str::CompactString;

fn rules(strs: &[&str]) -> Vec<CompactString> {
    strs.iter().map(|s| CompactString::from(*s)).collect()
}

#[test]
fn parse_and_accept_rules_do_not_error_on_validate_rules() {
    // Each of these used to be unknown — now they're parse-and-accept no-ops.
    let cases: &[&[&str]] = &[
        &["bail"],
        &["sometimes"],
        &["present"],
        &["present_if:other,x"],
        &["present_unless:other,x"],
        &["present_with:other"],
        &["present_with_all:a,b"],
        &["missing"],
        &["missing_if:other,x"],
        &["missing_unless:other,x"],
        &["missing_with:other"],
        &["missing_with_all:a,b"],
        &["array"],
        &["list"],
        &["distinct"],
        &["in_array:other.*"],
        &["in_array_keys:k1,k2"],
        &["contains:a,b"],
        &["doesnt_contain:a,b"],
        &["required_array_keys:k1,k2"],
        &["exclude"],
        &["exclude_if:other,x"],
        &["exclude_unless:other,x"],
        &["exclude_with:other"],
        &["exclude_without:other"],
        &["prohibited_if_accepted:other"],
        &["prohibited_if_declined:other"],
        &["date_equals:2020-01-01"],
    ];

    for case in cases {
        let r = rule_validator::validate_rules(&rules(case), &());
        assert!(r.is_ok(), "expected ok for {case:?}, got {r:?}");
    }
}

#[test]
fn hard_rejected_rules_error_with_clear_message() {
    let cases: &[&str] = &[
        "file",
        "image",
        "mimes:jpg,png",
        "mimetypes:image/jpeg",
        "extensions:jpg,png",
        "encoding:utf-8",
        "dimensions:min_width=100",
        "exists:users,id",
        "unique:users",
        "current_password",
        "password",
        "active_url",
        "enum:Foo",
    ];

    for case in cases {
        let r = rule_validator::validate_rules(&rules(&[case]), &());
        assert!(r.is_err(), "expected err for {case:?}, got {r:?}");
        let msg = format!("{:?}", r.unwrap_err());
        assert!(
            msg.contains("unsupported in env-variable validator"),
            "expected 'unsupported in env-variable validator' in error for {case:?}, got {msg}"
        );
    }
}

#[test]
fn unknown_rule_still_errors() {
    // Truly unknown rules still fail (not parse-and-accept).
    let r = rule_validator::validate_rules(&rules(&["this_does_not_exist"]), &());
    assert!(r.is_err());
}

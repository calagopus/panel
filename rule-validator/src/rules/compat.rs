// Array-shaped Laravel rules. Our scalar env-var data model has no arrays, so
// these are accepted for import compatibility but enforce nothing.
no_op_rule!(Array, "array");
no_op_rule!(List, "list");
no_op_rule!(Distinct, "distinct");
no_op_rule!(InArray, "in_array");
no_op_rule!(InArrayKeys, "in_array_keys");
no_op_rule!(Contains, "contains");
no_op_rule!(DoesntContain, "doesnt_contain");
no_op_rule!(RequiredArrayKeys, "required_array_keys");

// Input-shaping rules — Laravel removes fields from validated data based on
// these. We just validate one field's value, so they're informational only.
no_op_rule!(Exclude, "exclude");
no_op_rule!(ExcludeIf, "exclude_if");
no_op_rule!(ExcludeUnless, "exclude_unless");
no_op_rule!(ExcludeWith, "exclude_with");
no_op_rule!(ExcludeWithout, "exclude_without");

// Rarely-used conditional prohibition variants.
no_op_rule!(ProhibitedIfAccepted, "prohibited_if_accepted");
no_op_rule!(ProhibitedIfDeclined, "prohibited_if_declined");

// Low-value date comparison; use `after_or_equal` + `before_or_equal` for the
// same effect with the date rules in `date.rs`.
no_op_rule!(DateEquals, "date_equals");

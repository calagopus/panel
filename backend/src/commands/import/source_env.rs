use anyhow::Context;
use std::{collections::HashMap, path::Path, sync::OnceLock};

static SOURCE_ENV: OnceLock<HashMap<String, String>> = OnceLock::new();

pub(super) fn load(path: &Path) -> Result<(), anyhow::Error> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read {}", path.display()))?;
    let values = parse(&content)?;

    SOURCE_ENV
        .set(values)
        .map_err(|_| anyhow::anyhow!("source environment already loaded"))
}

pub(super) fn var(key: &str) -> Option<String> {
    SOURCE_ENV
        .get()
        .and_then(|values| values.get(key).cloned())
        .or_else(|| std::env::var(key).ok())
}

#[derive(Clone, Copy, PartialEq)]
enum State {
    Initial,
    Unquoted,
    SingleQuoted,
    DoubleQuoted,
    Escape,
    Whitespace,
    Comment,
}

fn parse(content: &str) -> Result<HashMap<String, String>, anyhow::Error> {
    let mut values = HashMap::new();

    for entry in lines(content) {
        let Some((name, value)) = entry.split_once('=') else {
            continue;
        };

        let name = parse_name(php_trim(name))
            .with_context(|| format!("invalid environment entry `{entry}`"))?;
        let value = parse_value(php_trim(value), &values)
            .with_context(|| format!("invalid value for environment variable `{name}`"))?;

        values.insert(name, value);
    }

    Ok(values)
}

fn php_trim(value: &str) -> &str {
    value.trim_matches([' ', '\t', '\n', '\r', '\0', '\x0B'])
}

fn lines(content: &str) -> Vec<String> {
    let mut output = Vec::new();
    let mut buffer: Vec<&str> = Vec::new();

    for line in content.split("\r\n").flat_map(|l| l.split(['\n', '\r'])) {
        let starts_here = buffer.is_empty() && line.contains("=\"") && !closes_quote(line, true);

        if starts_here || !buffer.is_empty() {
            buffer.push(line);

            if closes_quote(line, starts_here) {
                output.push(buffer.join("\n"));
                buffer.clear();
            }

            continue;
        }

        let trimmed = php_trim(line);
        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            output.push(line.to_string());
        }
    }

    output
}

fn closes_quote(line: &str, started: bool) -> bool {
    if line == "\"" {
        return true;
    }

    let line = line.replace("\\\\", "");
    let quotes = line
        .as_bytes()
        .windows(2)
        .filter(|pair| pair[1] == b'"' && pair[0] != b'\\')
        .count();

    if started { quotes > 1 } else { quotes >= 1 }
}

fn parse_name(name: &str) -> Result<String, anyhow::Error> {
    if name.is_empty() {
        return Err(anyhow::anyhow!("unexpected equals"));
    }

    let mut name = name;
    if name.len() > 8
        && let Some(rest) = name.strip_prefix("export")
        && rest.starts_with(char::is_whitespace)
    {
        name = rest.trim_start();
    }

    if name.len() >= 3
        && ((name.starts_with('"') && name.ends_with('"'))
            || (name.starts_with('\'') && name.ends_with('\'')))
    {
        name = &name[1..name.len() - 1];
    }

    if name.is_empty()
        || !name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '.')
    {
        return Err(anyhow::anyhow!("invalid name"));
    }

    Ok(name.to_string())
}

fn parse_value(value: &str, loaded: &HashMap<String, String>) -> Result<String, anyhow::Error> {
    let mut output = String::new();
    let mut variables = Vec::new();
    let mut state = State::Initial;

    for c in value.chars() {
        state = match (state, c) {
            (State::Comment, _) => State::Comment,
            (State::Initial | State::Unquoted, '#') => State::Comment,
            (State::Initial, '\'') => State::SingleQuoted,
            (State::Initial, '"') => State::DoubleQuoted,
            (State::Unquoted, c) if c.is_whitespace() => State::Whitespace,
            (State::Initial | State::Unquoted, c) => {
                if c == '$' {
                    variables.push(output.len());
                }
                output.push(c);
                State::Unquoted
            }
            (State::SingleQuoted, '\'') => State::Whitespace,
            (State::SingleQuoted, c) => {
                output.push(c);
                State::SingleQuoted
            }
            (State::DoubleQuoted, '"') => State::Whitespace,
            (State::DoubleQuoted, '\\') => State::Escape,
            (State::DoubleQuoted, c) => {
                if c == '$' {
                    variables.push(output.len());
                }
                output.push(c);
                State::DoubleQuoted
            }
            (State::Escape, c) => {
                output.push(match c {
                    '"' | '\\' | '$' => c,
                    'f' => '\x0C',
                    'n' => '\n',
                    'r' => '\r',
                    't' => '\t',
                    'v' => '\x0B',
                    _ => return Err(anyhow::anyhow!("unexpected escape sequence `\\{c}`")),
                });
                State::DoubleQuoted
            }
            (State::Whitespace, '#') => State::Comment,
            (State::Whitespace, c) if c.is_whitespace() => State::Whitespace,
            (State::Whitespace, _) => {
                return Err(anyhow::anyhow!("unexpected characters after the value"));
            }
        };
    }

    if matches!(
        state,
        State::SingleQuoted | State::DoubleQuoted | State::Escape
    ) {
        return Err(anyhow::anyhow!("missing closing quote"));
    }

    for position in variables.into_iter().rev() {
        let rest = &output[position..];
        let Some(name) = rest
            .strip_prefix("${")
            .and_then(|rest| rest.split_once('}'))
            .map(|(name, _)| name)
            .filter(|name| {
                !name.is_empty()
                    && name
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.')
            })
        else {
            continue;
        };

        let resolved = loaded
            .get(name)
            .cloned()
            .or_else(|| std::env::var(name).ok());
        if let Some(resolved) = resolved {
            let end = position + name.len() + 3;
            output.replace_range(position..end, &resolved);
        }
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    // parse
    fn parsed(content: &str) -> HashMap<String, String> {
        parse(content).unwrap()
    }

    #[test]
    fn unquoted_values_keep_dollars_and_backslashes_literal() {
        let env = parsed(r"A=p\a\nss$NAME$$x$1$");

        assert_eq!(env["A"], r"p\a\nss$NAME$$x$1$");
    }

    #[test]
    fn single_quoted_values_are_fully_literal() {
        let env = parsed("B=x\nA='p\\n\\q$B ${B} #c \"'");

        assert_eq!(env["A"], "p\\n\\q$B ${B} #c \"");
    }

    #[test]
    fn double_quoted_escapes_are_decoded() {
        let env = parsed(r#"A="q\"b\\s\$d\n\t\r\f\v""#);

        assert_eq!(env["A"], "q\"b\\s$d\n\t\r\x0c\x0b");
    }

    #[test]
    fn double_quoted_values_keep_plain_dollar_forms_verbatim() {
        let env = parsed(r#"A="$NAME $$ $1 end$""#);

        assert_eq!(env["A"], "$NAME $$ $1 end$");
    }

    #[test]
    fn interpolation_resolves_earlier_entries_outside_single_quotes() {
        let env = parsed("B=x\nC=${B}y\nD=\"${B}z\"\nE='${B}'");

        assert_eq!(env["C"], "xy");
        assert_eq!(env["D"], "xz");
        assert_eq!(env["E"], "${B}");
    }

    #[test]
    fn interpolation_falls_back_to_the_process_env() {
        let path = std::env::var("PATH").unwrap();
        let env = parsed("A=${PATH}");

        assert_eq!(env["A"], path);
    }

    #[test]
    fn interpolation_leaves_unknown_and_later_names_literal() {
        let env = parsed(
            "A=${IMPORT_TEST_UNDEFINED_X}\nB=\"${IMPORT_TEST_LATER_X}\"\nIMPORT_TEST_LATER_X=v",
        );

        assert_eq!(env["A"], "${IMPORT_TEST_UNDEFINED_X}");
        assert_eq!(env["B"], "${IMPORT_TEST_LATER_X}");
        assert_eq!(env["IMPORT_TEST_LATER_X"], "v");
    }

    #[test]
    fn escaped_dollar_in_double_quotes_is_not_interpolated() {
        let env = parsed("B=x\nA=\"\\${B}\"");

        assert_eq!(env["A"], "${B}");
    }

    #[test]
    fn hash_is_a_comment_unless_quoted() {
        let env = parsed("A=pa#ss\nB=v # c\nC=\"a#b\" # c\nD='a#b'");

        assert_eq!(env["A"], "pa");
        assert_eq!(env["B"], "v");
        assert_eq!(env["C"], "a#b");
        assert_eq!(env["D"], "a#b");
    }

    #[test]
    fn double_quoted_values_span_lines() {
        let env = parsed("A=\"multi\nline\"\nB=after");

        assert_eq!(env["A"], "multi\nline");
        assert_eq!(env["B"], "after");
    }

    #[test]
    fn lines_split_on_lf_crlf_and_cr() {
        let env = parsed("A=1\r\nB=2\rC=3\nD=4");

        assert_eq!(env.len(), 4);
        assert_eq!(env["A"], "1");
        assert_eq!(env["B"], "2");
        assert_eq!(env["C"], "3");
        assert_eq!(env["D"], "4");
    }

    #[test]
    fn names_prefixes_comments_and_duplicates() {
        let env = parsed("A=1\nexport EXPORTED=x\n\n# A=2\n  B  =  two  \nX.Y_1=ok\nE=\nA=3");

        assert_eq!(env.len(), 5);
        assert_eq!(env["EXPORTED"], "x");
        assert_eq!(env["A"], "3");
        assert_eq!(env["B"], "two");
        assert_eq!(env["X.Y_1"], "ok");
        assert_eq!(env["E"], "");
    }

    #[test]
    fn malformed_lines_are_errors() {
        for content in [
            "=x",
            "A-B=x",
            "A=a b",
            "A=\"x\" y",
            r#"A="\q""#,
            r#"A="\'""#,
        ] {
            assert!(parse(content).is_err(), "{content:?}");
        }
    }

    #[test]
    fn unterminated_double_quote_swallows_the_rest_of_the_file() {
        assert!(!parsed("A=1\nB=\"unterminated\nC=2").contains_key("C"));
    }
}

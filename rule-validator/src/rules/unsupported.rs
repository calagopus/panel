// File-related rules — env vars are strings, never file uploads.
unsupported_rule!(File, "file");
unsupported_rule!(Image, "image");
unsupported_rule!(Mimes, "mimes");
unsupported_rule!(Mimetypes, "mimetypes");
unsupported_rule!(Extensions, "extensions");
unsupported_rule!(Encoding, "encoding");
unsupported_rule!(Dimensions, "dimensions");

// Database-backed rules — no DB lookup in this validator.
unsupported_rule!(Exists, "exists");
unsupported_rule!(Unique, "unique");

// Auth-context rules — not applicable to env vars.
unsupported_rule!(CurrentPassword, "current_password");
unsupported_rule!(Password, "password");

// Network-effecting rule — would do DNS/HTTP at validate time.
unsupported_rule!(ActiveUrl, "active_url");

// PHP-typed enum class — semantically equivalent to `in:` in our context.
unsupported_rule!(Enum, "enum");

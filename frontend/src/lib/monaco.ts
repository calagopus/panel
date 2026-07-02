import { type Monaco } from '@monaco-editor/react';

type IMonarchLanguageRule = import('monaco-editor').languages.IMonarchLanguageRule;
type ITextModel = import('monaco-editor').editor.ITextModel;
type IPosition = import('monaco-editor').IPosition;

// monaco is a page-level singleton; registering twice duplicates completion
// providers and leaks them across editor mounts
let hoconRegistered = false;
let tomlRegistered = false;

export function registerHoconLanguage(monaco: Monaco) {
  if (hoconRegistered) return;
  hoconRegistered = true;

  monaco.languages.register({ id: 'hocon', extensions: ['.conf', '.hocon'], aliases: ['HOCON', 'hocon'] });

  monaco.languages.setMonarchTokensProvider('hocon', {
    tokenizer: {
      root: [
        // Comments
        [/#.*$/, 'comment'],
        [/\/\/.*$/, 'comment'],

        // Include statements
        [/\binclude\b/, 'keyword', '@include'],

        // Substitutions ${...} and ${?...}
        [/\$\{\?/, 'variable.predefined', '@substitution'],
        [/\$\{/, 'variable.predefined', '@substitution'],

        // Keywords
        [/\b(true|false|null)\b/, 'keyword.constant'],

        // Triple-quoted strings (multi-line)
        [/"""/, 'string', '@multistring'],

        // Regular quoted strings
        [/"/, 'string', '@string'],

        // Numbers (including units like "10ms", "512k", "10 seconds")
        [/\d+\s*(ms|s|m|h|d|ns|us|microseconds?|milliseconds?|seconds?|minutes?|hours?|days?)\b/, 'number.unit'],
        [/\d+\s*(b|B|k|K|kb|KB|m|M|mb|MB|g|G|gb|GB|t|T|tb|TB|p|P|pb|PB|e|E|eb|EB)\b/, 'number.unit'],
        [/-?\d+\.?\d*([eE][-+]?\d+)?/, 'number'],

        // Operators
        [/\+=/, 'operator'],
        [/[=:]/, 'operator'],
        [/[{}[\],]/, 'delimiter'],

        // Unquoted keys and values (dot-notation support)
        [/[a-zA-Z_][\w-]*(\.[a-zA-Z_][\w-]*)*/, 'identifier'],
      ],

      // Handle include statements
      include: [
        [/\s+/, ''],
        [/\burl\b/, 'keyword.control', '@includeUrl'],
        [/\bfile\b/, 'keyword.control', '@includeFile'],
        [/\bclasspath\b/, 'keyword.control', '@includeClasspath'],
        [/"/, 'string', '@string'],
        [/[^\s]/, '', '@pop'],
      ],

      includeUrl: [
        [/\(/, 'delimiter', '@includeUrlParen'],
        [/./, '', '@pop'],
      ],

      includeUrlParen: [
        [/"[^"]*"/, 'string.url'],
        [/\)/, 'delimiter', '@pop'],
      ],

      includeFile: [
        [/\(/, 'delimiter', '@includeFileParen'],
        [/./, '', '@pop'],
      ],

      includeFileParen: [
        [/"[^"]*"/, 'string.path'],
        [/\)/, 'delimiter', '@pop'],
      ],

      includeClasspath: [
        [/\(/, 'delimiter', '@includeClasspathParen'],
        [/./, '', '@pop'],
      ],

      includeClasspathParen: [
        [/"[^"]*"/, 'string.resource'],
        [/\)/, 'delimiter', '@pop'],
      ],

      // Substitution handling
      substitution: [
        [/[^}]+/, 'variable'],
        [/\}/, 'variable.predefined', '@pop'],
      ],

      // Regular string handling
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],

      // Multi-line string (triple quotes)
      multistring: [
        [/[^"]+/, 'string'],
        [/"""/, 'string', '@pop'],
        [/"/, 'string'],
      ],
    },
  });

  // Configure language features
  monaco.languages.setLanguageConfiguration('hocon', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  });

  // Auto-completion for HOCON
  monaco.languages.registerCompletionItemProvider('hocon', {
    provideCompletionItems: (model: ITextModel, position: IPosition) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        {
          label: 'include',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'include "${1:filename.conf}"',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Include another configuration file',
          range: range,
        },
        {
          label: 'include file',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'include file("${1:path/to/file.conf}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Include file from filesystem',
          range: range,
        },
        {
          label: 'include classpath',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'include classpath("${1:resource.conf}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Include file from classpath',
          range: range,
        },
        {
          label: 'include url',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'include url("${1:http://example.com/config.conf}")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Include file from URL',
          range: range,
        },
        {
          label: 'substitution',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '${${1:key}}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Variable substitution',
          range: range,
        },
        {
          label: 'optional substitution',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '${?${1:key}}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Optional variable substitution (won't fail if missing)",
          range: range,
        },
        {
          label: 'true',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'true',
          range: range,
        },
        {
          label: 'false',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'false',
          range: range,
        },
        {
          label: 'null',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'null',
          range: range,
        },
      ];

      return { suggestions: suggestions };
    },
  });
}

// https://github.com/microsoft/monaco-editor/blob/f7beb75f38c38b065d26f05760438d84224fdb1a/src/basic-languages/toml/toml.ts
export function registerTomlLanguage(monaco: Monaco) {
  if (tomlRegistered) return;
  tomlRegistered = true;

  monaco.languages.register({
    id: 'toml',
    extensions: ['.toml', '.tml'],
    aliases: ['TOML', 'toml'],
  });

  const createSingleLineLiteralStringState = (tokenClass: string): IMonarchLanguageRule[] => {
    return [
      // anything not a single quote
      [/[^']+/, tokenClass],
      // end of string
      [/'/, tokenClass, '@pop'],
    ];
  };

  const createSingleLineStringState = (tokenClass: string): IMonarchLanguageRule[] => {
    return [
      // anything not a quote or \ (escape char) is part of the string
      [/[^"\\]+/, tokenClass],

      // for more compatibility with themes, escape token classes are the same everywhere
      [/@escapes/, 'constant.character.escape'],
      // invalid escape sequence
      [/\\./, `constant.character.escape.invalid`],

      // end of string
      [/"/, tokenClass, '@pop'],
    ];
  };

  const createIdentChainStates = (tokenClass: string): Record<string, IMonarchLanguageRule[]> => {
    const singleQuotedState = `identChain.${tokenClass}.singleQuoted`;
    const singleQuoteClass = `${tokenClass}.string.literal`;
    const doubleQuotedState = `identChain.${tokenClass}.doubleQuoted`;
    const doubleQuoteClass = `${tokenClass}.string`;

    return {
      [`identChain.${tokenClass}`]: [
        { include: '@whitespace' },
        { include: '@comment' },

        [/@identifier/, tokenClass],
        [/\./, 'delimiter'],

        // string literal
        [/'[^']*$/, `${tokenClass}.invalid`], // unterminated
        [
          /'/,
          {
            token: singleQuoteClass,
            next: `@${singleQuotedState}`,
          },
        ],

        // string
        [/"(\\.|[^"])*$/, `${tokenClass}.invalid`], // unterminated
        [
          /"/,
          {
            token: doubleQuoteClass,
            next: `@${doubleQuotedState}`,
          },
        ],

        // end of identifier chain
        [/./, '@rematch', '@pop'],
      ],
      [singleQuotedState]: createSingleLineLiteralStringState(singleQuoteClass),
      [doubleQuotedState]: createSingleLineStringState(doubleQuoteClass),
    };
  };

  // --- Language Configuration ---

  monaco.languages.setLanguageConfiguration('toml', {
    comments: {
      lineComment: '#',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      offSide: true,
    },
    onEnterRules: [
      {
        beforeText: /[{[]\s*$/,
        action: {
          indentAction: monaco.languages.IndentAction.Indent,
        },
      },
    ],
  });

  // --- Tokenizer Definition ---

  monaco.languages.setMonarchTokensProvider('toml', {
    tokenPostfix: '.toml',
    brackets: [
      { token: 'delimiter.bracket', open: '{', close: '}' },
      { token: 'delimiter.square', open: '[', close: ']' },
    ],

    // https://toml.io/en/v1.0.0#integer
    numberInteger: /[+-]?(0|[1-9](_?[0-9])*)/,
    numberOctal: /0o[0-7](_?[0-7])*/,
    numberHex: /0x[0-9a-fA-F](_?[0-9a-fA-F])*/,
    numberBinary: /0b[01](_?[01])*/,

    floatFractionPart: /\.[0-9](_?[0-9])*/,
    floatExponentPart: /[eE][+-]?[0-9](_?[0-9])*/,

    // RFC 3339 data times
    date: /\d{4}-\d\d-\d\d/,
    time: /\d\d:\d\d:\d\d(\.\d+)?/,
    offset: /[+-]\d\d:\d\d/,

    // https://toml.io/en/v1.0.0#string
    escapes: /\\([btnfr"\\]|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/,
    identifier: /([\w-]+)/,
    identChainStart: /([\w-"'])/,
    valueStart: /(["'tf0-9+\-in[{])/,

    tokenizer: {
      root: [
        { include: '@comment' },
        { include: '@whitespace' },
        // key value pair
        [/@identChainStart/, '@rematch', '@kvpair'],

        // table
        [/\[/, '@brackets', '@table'],

        // *invalid* value without a key, still parse
        // the value so it doesn't become a key and mess up
        // further parsing
        [/=/, 'delimiter', '@value'],
      ],
      comment: [[/#.*$/, 'comment']],
      whitespace: [[/[ \t\r\n]+/, 'white']],

      // Parsing a key value pair
      kvpair: [
        { include: '@whitespace' },
        { include: '@comment' },
        [/@identChainStart/, '@rematch', '@identChain.variable'],
        // switch to value, so we pop back to root when
        // it's done
        [
          /=/,
          {
            token: 'delimiter',
            switchTo: '@value',
          },
        ],
        [/./, '@rematch', '@pop'],
      ],

      // Parsing a key identifier
      ...createIdentChainStates('variable'),

      // Parsing a top level [table]
      table: [
        { include: '@whitespace' },
        { include: '@comment' },
        // increase nesting
        [/\[/, '@brackets', '@table'],
        [/@identChainStart/, '@rematch', '@identChain.type'],
        [/\]/, '@brackets', '@pop'],
      ],

      // Table name identifier
      ...createIdentChainStates('type'),

      // A top level value (in a kvpair)
      value: [
        { include: '@whitespace' },
        { include: '@comment' },
        { include: '@value.cases' },
        // not valid value
        [/./, '@rematch', '@pop'],
      ],

      'value.string.singleQuoted': createSingleLineLiteralStringState('string.literal'),
      'value.string.doubleQuoted': createSingleLineStringState('string'),
      'value.string.multi.doubleQuoted': [
        // anything not a quote or \ (escape char) is part of the string
        [/[^"\\]+/, 'string.multi'],

        // for more compatibility with themes, escape token classes are the same everywhere
        [/@escapes/, 'constant.character.escape'],
        // end of line continuation
        [/\\$/, `constant.character.escape`],
        // invalid escape sequence
        [/\\./, `constant.character.escape.invalid`],

        // the spec doesn't explicitly mention 3 or more quotes
        // are invalid, but it mentions 1 or 2 quotes are valid inside
        // multiline, so here we assume the rule is the same as literal multiline
        [/"""(""|")?/, 'string.multi', '@pop'],

        // not terminated by single "
        [/"/, 'string.multi'],
      ],
      'value.string.multi.singleQuoted': [
        // anything not ' is part of the string
        [/[^']+/, 'string.literal.multi'],
        // 3-5 ' ends the string
        [/'''(''|')?/, 'string.literal.multi', '@pop'],

        // not terminated by single '
        [/'/, 'string.literal.multi'],
      ],

      // Arrays
      'value.array': [
        { include: '@whitespace' },
        { include: '@comment' },
        // closing the array
        [/\]/, '@brackets', '@pop'],
        // seprator
        [/,/, 'delimiter'],
        // values in the array
        [/@valueStart/, '@rematch', '@value.array.entry'],

        // invalid syntax, skip until , or ]
        [/.+(?=[,\]])/, 'source'],
      ],

      // One entry in the array
      'value.array.entry': [
        { include: '@whitespace' },
        { include: '@comment' },
        // values in the array - pops if matches
        { include: '@value.cases' },
        // invalid syntax, skip until , or ]
        [/.+(?=[,\]])/, 'source', '@pop'],
        // unterminated array, just give up
        // and skip one character
        [/./, 'source', '@pop'],
      ],

      // Inline-tables
      'value.inlinetable': [
        { include: '@whitespace' },
        { include: '@comment' },
        // closing the table
        [/\}/, '@brackets', '@pop'],
        // seprator
        [/,/, 'delimiter'],
        // key-value pairs in the table
        [/@identChainStart/, '@rematch', '@value.inlinetable.entry'],

        // *invalid* value without a key, still parse
        // the value so it doesn't become a key and mess up
        // further parsing
        [/=/, 'delimiter', '@value.inlinetable.value'],

        // *invalid* value without key or =
        [/@valueStart/, '@rematch', '@value.inlinetable.value'],
        // invalid syntax, skip until , or }
        [/.+(?=[,}])/, 'source', '@pop'],
      ],

      // One entry (key-value pair) in the inline table
      'value.inlinetable.entry': [
        { include: '@whitespace' },
        { include: '@comment' },

        // key
        [/@identChainStart/, '@rematch', '@identChain.variable'],
        // = value
        [
          /=/,
          {
            token: 'delimiter',
            switchTo: '@value.inlinetable.value',
          },
        ],
        // invalid syntax, skip until , or }
        [/.+(?=[,}])/, 'source', '@pop'],
      ],

      // One value entry in the inline table
      'value.inlinetable.value': [
        { include: '@whitespace' },
        { include: '@comment' },
        // values in the table - pops back to inlinetable if matches
        { include: '@value.cases' },
        // invalid syntax, skip until , or }
        [/.+(?=[,}])/, 'source', '@pop'],
        // unterminated table, just give up
        // and skip one character
        [/./, 'source', '@pop'],
      ],

      'value.cases': [
        // basic (double quote) strings
        [
          /"""/,
          {
            token: 'string.multi',
            switchTo: '@value.string.multi.doubleQuoted',
          },
        ],
        [/"(\\.|[^"])*$/, 'string.invalid'], // unterminated
        [
          /"/,
          {
            token: 'string',
            switchTo: '@value.string.doubleQuoted',
          },
        ],

        // literal (single quote) strings
        [
          /'''/,
          {
            token: 'string.literal.multi',
            switchTo: '@value.string.multi.singleQuoted',
          },
        ],
        [/'[^']*$/, 'string.literal.invalid'], // unterminated
        [
          /'/,
          {
            token: 'string.literal',
            switchTo: '@value.string.singleQuoted',
          },
        ],

        // boolean
        [/(true|false)/, 'constant.language.boolean', '@pop'],

        // arrays
        [
          /\[/,
          {
            token: '@brackets',
            switchTo: '@value.array',
          },
        ],

        // inline tables
        [
          /\{/,
          {
            token: '@brackets',
            switchTo: '@value.inlinetable',
          },
        ],

        // integer type
        // require integer to be not followed by invalid tokens,
        // so it can run before the other types (since it's more common),
        // and not clash with other types
        // - 0-9 for integers with leading 0
        // - _ for separators (otherwise 123_456.789 would accept 123)
        // - oxb for hex, octal, binary
        // - \. and eE for floats
        // - '-' and ':' for date and time
        [/@numberInteger(?![0-9_oxbeE.:-])/, 'number', '@pop'],

        // float
        [/@numberInteger(@floatFractionPart@floatExponentPart?|@floatExponentPart)/, 'number.float', '@pop'],

        // integer types
        [/@numberOctal/, 'number.octal', '@pop'],
        [/@numberHex/, 'number.hex', '@pop'],
        [/@numberBinary/, 'number.binary', '@pop'],

        // special float
        [/[+-]?inf/, 'number.inf', '@pop'],
        [/[+-]?nan/, 'number.nan', '@pop'],

        // Date Time (offset and local)
        [/@date[Tt ]@time(@offset|Z)?/, 'number.datetime', '@pop'],
        [/@date/, 'number.date', '@pop'],
        [/@time/, 'number.time', '@pop'],
      ],
    },
  });

  // --- Auto-completion for TOML ---
  monaco.languages.registerCompletionItemProvider('toml', {
    provideCompletionItems: (model: ITextModel, position: IPosition) => {
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: model.getWordUntilPosition(position).startColumn,
        endColumn: model.getWordUntilPosition(position).endColumn,
      };

      const suggestions = [
        {
          label: 'true',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'true',
          range: range,
        },
        {
          label: 'false',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'false',
          range: range,
        },
        {
          label: 'inf',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'inf',
          range: range,
          documentation: 'Infinity (special float)',
        },
        {
          label: 'nan',
          kind: monaco.languages.CompletionItemKind.Constant,
          insertText: 'nan',
          range: range,
          documentation: 'Not a Number (special float)',
        },
      ];

      return { suggestions: suggestions };
    },
  });
}

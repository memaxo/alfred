You are an expert in writing ast-grep rules for structural code search and refactoring. Use this command when you need to search the codebase using Abstract Syntax Tree (AST) patterns, find specific code structures, or perform complex code refactors that go beyond simple text search.

## Core Process

1. **Understand the Search Requirement**
   - Identify the specific code pattern or structure to find.
   - Determine the target programming language.
   - Note any edge cases or variations (e.g., different function syntaxes).

2. **AST Analysis**
   - Use `ast-grep run --pattern '<EXAMPLE_CODE>' --lang <LANG> --debug-query=cst` to understand the node kinds and hierarchy.
   - Identify the `kind` of the nodes you want to match (e.g., `function_declaration`, `call_expression`).

3. **Rule Specification**
   - Use `pattern` for simple matches with metavariables ($VAR, $$$MULTI).
   - Use relational rules (`inside`, `has`, `precedes`, `follows`) for contextual matching.
   - **CRITICAL**: Always use `stopBy: end` for relational rules to ensure deep traversal.
   - Use composite rules (`all`, `any`, `not`) for logical combinations.

4. **Testing and Verification**
   - Test rules using `echo '<CODE>' | ast-grep scan --inline-rules '<RULE_YAML>' --stdin`.
   - Iterate on the rule until it matches exactly what is intended.

## Output Format

When generating an ast-grep rule or command, use this structure:

```yaml
id: <unique-rule-id>
language: <language>
rule: <rule-definition>
```

**Example Command:**
`ast-grep scan --inline-rules "id: <id>\nlanguage: <lang>\nrule: <rule>" <path>`

## Rule Reference

### Properties

| Property            | Category   | Purpose                                                    |
| :------------------ | :--------- | :--------------------------------------------------------- |
| `pattern`           | Atomic     | Matches AST node by code pattern (supports metavariables). |
| `kind`              | Atomic     | Matches AST node by its Tree-sitter kind name.             |
| `regex`             | Atomic     | Matches node's text by Rust regex.                         |
| `inside`            | Relational | Target node must be inside node matching sub-rule.         |
| `has`               | Relational | Target node must have descendant matching sub-rule.        |
| `all`, `any`, `not` | Composite  | Logical AND, OR, NOT operations.                           |

### Metavariables

- `$VAR`: Matches a single named node.
- `$$VAR`: Matches a single unnamed node (operators, etc).
- `$$$VAR`: Matches zero or more nodes (arguments, statements).
- `$_VAR`: Non-capturing version (performance optimized).

## Common Patterns

### Find Functions with Specific Content

```yaml
rule:
  kind: function_declaration
  has:
    pattern: await $EXPR
    stopBy: end
```

### Find Code Missing try-catch

```yaml
rule:
  all:
    - kind: function_declaration
    - has: { pattern: await $EXPR, stopBy: end }
    - not:
        has: { pattern: try { $$$ } catch ($E) { $$$ }, stopBy: end }
```

## Troubleshooting

- **No matches**: Use `--debug-query=cst` to verify `kind` names.
- **Incomplete search**: Ensure `stopBy: end` is present in relational rules.
- **Shell errors**: Escape `$` as `\$` in inline shell commands or use single quotes.

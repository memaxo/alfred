---
title: Sensitive Data Filter | Processors | Observability | Mastra Docs
url: 
description: Protect sensitive information in your AI traces with automatic data redaction
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") [AI Tracing](https://mastra.ai/en/docs/observability/ai-tracing/overview "AI Tracing") Span ProcessorsSensitiveDataFilter

Copy page

# Sensitive Data Filter

The Sensitive Data Filter is a span processor that automatically redacts sensitive information from your AI traces before they’re exported. This ensures that passwords, API keys, tokens, and other confidential data never leave your application or get stored in observability platforms.

## Default Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#default-configuration)

By default, the Sensitive Data Filter is automatically enabled when you use the standard Mastra configuration:

src/mastra/index.ts

```nextra-code [counter-reset:line]

export const mastra = new Mastra({
  observability: {
    default: { enabled: true }, // Automatically includes SensitiveDataFilter
  },
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
});
```

With the default configuration, the filter automatically redacts these common sensitive field names:

- `password`
- `token`
- `secret`
- `key`
- `apikey`
- `auth`
- `authorization`
- `bearer`
- `bearertoken`
- `jwt`
- `credential`
- `clientsecret`
- `privatekey`
- `refresh`
- `ssn`

Field matching is case-insensitive and normalizes separators. For example, `api-key`, `api_key`, and `Api Key` are all treated as `apikey`.

## How It Works [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#how-it-works)

The Sensitive Data Filter processes spans before they’re sent to exporters, scanning through:

- **Attributes** \- Span metadata and properties
- **Metadata** \- Custom metadata attached to spans
- **Input** \- Data sent to agents, tools, and LLMs
- **Output** \- Responses and results
- **Error Information** \- Stack traces and error details

When a sensitive field is detected, its value is replaced with `[REDACTED]` by default. The filter handles nested objects, arrays, and circular references safely.

## Custom Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#custom-configuration)

You can customize which fields are redacted and how redaction appears:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { SensitiveDataFilter, DefaultExporter } from '@mastra/core/ai-tracing';

export const mastra = new Mastra({
  observability: {
    configs: {
      production: {
        serviceName: 'my-service',
        exporters: [new DefaultExporter()],
        processors: [\
          new SensitiveDataFilter({\
            // Add custom sensitive fields\
            sensitiveFields: [\
              // Default fields\
              'password', 'token', 'secret', 'key', 'apikey',\
              // Custom fields for your application\
              'creditCard', 'bankAccount', 'routingNumber',\
              'email', 'phoneNumber', 'dateOfBirth',\
            ],\
            // Custom redaction token\
            redactionToken: '***SENSITIVE***',\
            // Redaction style\
            redactionStyle: 'full', // or 'partial'\
          })\
        ],
      },
    },
  },
});
```

## Redaction Styles [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#redaction-styles)

The filter supports two redaction styles:

### Full Redaction (Default) [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#full-redaction-default)

Replaces the entire value with a fixed token:

```nextra-code

// Before
{
  "apiKey": "sk-abc123xyz789def456",
  "userId": "user_12345"
}

// After
{
  "apiKey": "[REDACTED]",
  "userId": "user_12345"
}
```

### Partial Redaction [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#partial-redaction)

Shows the first and last 3 characters, useful for debugging without exposing full values:

```nextra-code

new SensitiveDataFilter({
  redactionStyle: 'partial'
})
```

```nextra-code

// Before
{
  "apiKey": "sk-abc123xyz789def456",
  "creditCard": "4111111111111111"
}

// After
{
  "apiKey": "sk-…456",
  "creditCard": "411…111"
}
```

Values shorter than 7 characters are fully redacted to prevent information leakage.

## Field Matching Rules [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#field-matching-rules)

The filter uses intelligent field matching:

1. **Case-Insensitive**: `APIKey`, `apikey`, and `ApiKey` are all matched
2. **Separator-Agnostic**: `api-key`, `api_key`, and `apiKey` are treated identically
3. **Exact Matching**: After normalization, fields must match exactly
   - `token` matches `token`, `Token`, `TOKEN`
   - `token` does NOT match `promptTokens` or `tokenCount`

## Nested Object Handling [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#nested-object-handling)

The filter recursively processes nested structures:

```nextra-code

// Before
{
  "user": {
    "id": "12345",
    "credentials": {
      "password": "SuperSecret123!",
      "apiKey": "sk-production-key"
    }
  },
  "config": {
    "auth": {
      "jwt": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}

// After
{
  "user": {
    "id": "12345",
    "credentials": {
      "password": "[REDACTED]",
      "apiKey": "[REDACTED]"
    }
  },
  "config": {
    "auth": {
      "jwt": "[REDACTED]"
    }
  }
}
```

## Performance Considerations [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#performance-considerations)

The Sensitive Data Filter is designed to be lightweight and efficient:

- **Synchronous Processing**: No async operations, minimal latency impact
- **Circular Reference Handling**: Safely handles complex object graphs
- **Error Recovery**: If filtering fails, the field is replaced with an error marker rather than crashing

## Disabling the Filter [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#disabling-the-filter)

If you need to disable sensitive data filtering (not recommended for production):

src/mastra/index.ts

```nextra-code [counter-reset:line]

export const mastra = new Mastra({
  observability: {
    configs: {
      debug: {
        serviceName: 'debug-service',
        processors: [], // No processors, including no SensitiveDataFilter
        exporters: [new DefaultExporter()],
      },
    },
  },
});
```

Only disable sensitive data filtering in controlled environments. Never disable it when sending traces to external services or shared storage.

## Common Use Cases [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#common-use-cases)

### Healthcare Applications [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#healthcare-applications)

```nextra-code

new SensitiveDataFilter({
  sensitiveFields: [\
    // HIPAA-related fields\
    'ssn', 'socialSecurityNumber',\
    'medicalRecordNumber', 'mrn',\
    'healthInsuranceNumber',\
    'diagnosisCode', 'icd10',\
    'prescription', 'medication',\
  ]
})
```

### Financial Services [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#financial-services)

```nextra-code

new SensitiveDataFilter({
  sensitiveFields: [\
    // PCI compliance fields\
    'creditCard', 'ccNumber', 'cardNumber',\
    'cvv', 'cvc', 'securityCode',\
    'expirationDate', 'expiry',\
    'bankAccount', 'accountNumber',\
    'routingNumber', 'iban', 'swift',\
  ]
})
```

## Error Handling [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#error-handling)

If the filter encounters an error while processing a field, it replaces the field with a safe error marker:

```nextra-code

{
  "problematicField": {
    "error": {
      "processor": "sensitive-data-filter"
    }
  }
}
```

This ensures that processing errors don’t prevent traces from being exported or cause application crashes.

## Related [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter\#related)

- [SensitiveDataFilter API](https://mastra.ai/reference/observability/ai-tracing/processors/sensitive-data-filter)
- [Basic AI Tracing Example](https://mastra.ai/examples/observability/basic-ai-tracing)

[OpenTelemetryexp.](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel "OpenTelemetry") [OTEL Tracing](https://mastra.ai/en/docs/observability/otel-tracing "OTEL Tracing")
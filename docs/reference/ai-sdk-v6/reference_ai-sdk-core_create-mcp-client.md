AI SDK Coreexperimental_createMCPClient

Copy markdown

# `experimental_createMCPClient()`

Creates a lightweight Model Context Protocol (MCP) client that connects to an MCP server. The client provides:

- **Tools** : Automatic conversion between MCP tools and AI SDK tools
- **Resources** : Methods to list, read, and discover resource templates from MCP servers
- **Prompts** : Methods to list available prompts and retrieve prompt messages

It currently does not support accepting notifications from an MCP server, and custom configuration of the client.

This feature is experimental and may change or be removed in the future.

## Import

    import { experimental_createMCPClient } from "@ai-sdk/mcp"

## API Signature

### Parameters

### config:

MCPClientConfig

Configuration for the MCP client.

MCPClientConfig

### transport:

TransportConfig = MCPTransport | McpSSEServerConfig

Configuration for the message transport layer.

MCPTransport

### start:

() => Promise

A method that starts the transport

### send:

(message: JSONRPCMessage) => Promise

A method that sends a message through the transport

### close:

() => Promise

A method that closes the transport

### onclose:

() => void

A method that is called when the transport is closed

### onerror:

(error: Error) => void

A method that is called when the transport encounters an error

### onmessage:

(message: JSONRPCMessage) => void

A method that is called when the transport receives a message

MCPTransportConfig

### type:

'sse' | 'http

Use Server-Sent Events for communication

### url:

string

URL of the MCP server

### headers?:

Record

Additional HTTP headers to be sent with requests.

### authProvider?:

OAuthClientProvider

Optional OAuth provider for authorization to access protected remote MCP servers.

### name?:

string

Client name. Defaults to "ai-sdk-mcp-client"

### onUncaughtError?:

(error: unknown) => void

Handler for uncaught errors

### Returns

Returns a Promise that resolves to an `MCPClient` with the following methods:

### tools:

async (options?: { schemas?: TOOL_SCHEMAS }) => Promise>

Gets the tools available from the MCP server.

options

### schemas?:

TOOL_SCHEMAS

Schema definitions for compile-time type checking. When not provided, schemas are inferred from the server.

### listResources:

async (options?: { params?: PaginatedRequest['params']; options?: RequestOptions; }) => Promise

Lists all available resources from the MCP server.

options

### params?:

PaginatedRequest['params']

Optional pagination parameters including cursor.

### options?:

RequestOptions

Optional request options including signal and timeout.

### readResource:

async (args: { uri: string; options?: RequestOptions; }) => Promise

Reads the contents of a specific resource by URI.

args

### uri:

string

The URI of the resource to read.

### options?:

RequestOptions

Optional request options including signal and timeout.

### listResourceTemplates:

async (options?: { options?: RequestOptions; }) => Promise

Lists all available resource templates from the MCP server.

options

### options?:

RequestOptions

Optional request options including signal and timeout.

### listPrompts:

async (options?: { params?: PaginatedRequest['params']; options?: RequestOptions; }) => Promise

Lists available prompts from the MCP server.

options

### params?:

PaginatedRequest['params']

Optional pagination parameters including cursor.

### options?:

RequestOptions

Optional request options including signal and timeout.

### getPrompt:

async (args: { name: string; arguments?: Record; options?: RequestOptions; }) => Promise

Retrieves a prompt by name, optionally passing arguments.

args

### name:

string

Prompt name to retrieve.

### arguments?:

Record

Optional arguments to fill into the prompt.

### options?:

RequestOptions

Optional request options including signal and timeout.

### close:

async () => void

Closes the connection to the MCP server and cleans up resources.

## Example

    import { experimental_createMCPClient, generateText } from '@ai-sdk/mcp';

    import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

    import { openai } from '@ai-sdk/openai';




    let client;




    try {

      client = await experimental_createMCPClient({

        transport: new Experimental_StdioMCPTransport({

          command: 'node server.js',

        }),

      });




      const tools = await client.tools();




      const response = await generateText({

        model: openai('gpt-4o-mini'),

        tools,

        messages: [{ role: 'user', content: 'Query the data' }],

      });




      console.log(response);

    } catch (error) {

      console.error('Error:', error);

    } finally {

      // ensure the client is closed even if an error occurs

      if (client) {

        await client.close();

      }

    }

## Error Handling

The client throws `MCPClientError` for:

- Client initialization failures
- Protocol version mismatches
- Missing server capabilities
- Connection failures

For tool execution, errors are propagated as `CallToolError` errors.

For unknown errors, the client exposes an `onUncaughtError` callback that can be used to manually log or handle errors that are not covered by known error types.

Previous

dynamicTool

Next

Experimental_StdioMCPTransport

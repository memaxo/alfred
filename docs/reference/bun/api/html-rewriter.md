---
title: HTMLRewriter – API | Bun Docs
url:
description: Parse and transform HTML with Bun's native HTMLRewriter API, inspired by Cloudflare Workers.
language: en
---

Search`` `K`

Ask AI

![ai chat avatar](https://bun.com/logo_avatar.svg)

Intro

[What is Bun?](https://bun.com/docs/index) [Installation](https://bun.com/docs/installation) [Quickstart](https://bun.com/docs/quickstart) [TypeScript](https://bun.com/docs/typescript)

Templating

[`bun init`](https://bun.com/docs/cli/init) [`bun create`](https://bun.com/docs/cli/bun-create)

Runtime

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

Framework APISOON

Package manager

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

Bundler

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter)

[Usage](https://bun.com/docs/api/html-rewriter#usage) [Input types](https://bun.com/docs/api/html-rewriter#input-types) [Element Handlers](https://bun.com/docs/api/html-rewriter#element-handlers) [CSS Selector Support](https://bun.com/docs/api/html-rewriter#css-selector-support) [Element Operations](https://bun.com/docs/api/html-rewriter#element-operations) [Text Operations](https://bun.com/docs/api/html-rewriter#text-operations) [Comment Operations](https://bun.com/docs/api/html-rewriter#comment-operations) [Document Handlers](https://bun.com/docs/api/html-rewriter#document-handlers) [Response Handling](https://bun.com/docs/api/html-rewriter#response-handling) [Error Handling](https://bun.com/docs/api/html-rewriter#error-handling) [See also](https://bun.com/docs/api/html-rewriter#see-also)

[Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

HTMLRewriter lets you use CSS selectors to transform HTML documents. It works with `Request`, `Response`, as well as `string`. Bun's implementation is based on Cloudflare's [lol-html](https://github.com/cloudflare/lol-html).

## [Usage](https://bun.com/docs/api/html-rewriter#usage)

A common usecase is rewriting URLs in HTML content. Here's an example that rewrites image sources and link URLs to use a CDN domain:

```
// Replace all images with a rickroll
const rewriter = new HTMLRewriter().on("img", {
  element(img) {
    // Famous rickroll video thumbnail
    img.setAttribute(
      "src",
      "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    );

    // Wrap the image in a link to the video
    img.before(
      '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">',
      { html: true },
    );
    img.after("</a>", { html: true });

    // Add some fun alt text
    img.setAttribute("alt", "Definitely not a rickroll");
  },
});

// An example HTML document
const html = `
<html>
<body>
  <img src="/cat.jpg">
  <img src="dog.png">
  <img src="https://example.com/bird.webp">
</body>
</html>
`;

const result = rewriter.transform(html);
console.log(result);

```

This replaces all images with a thumbnail of Rick Astley and wraps each `<img>` in a link, producing a diff like this:

```
<html>
  <body>
     <img src="/cat.jpg">
     <img src="dog.png">
     <img src="https://example.com/bird.webp">
     <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">
       <img src="https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" alt="Definitely not a rickroll">
     </a>
     <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">
       <img src="https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" alt="Definitely not a rickroll">
     </a>
     <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">
       <img src="https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" alt="Definitely not a rickroll">
     </a>
  </body>
</html>
```

Now every image on the page will be replaced with a thumbnail of Rick Astley, and clicking any image will lead to [a very famous video](https://www.youtube.com/watch?v=dQw4w9WgXcQ).

### [Input types](https://bun.com/docs/api/html-rewriter#input-types)

HTMLRewriter can transform HTML from various sources. The input is automatically handled based on its type:

```
// From Response
rewriter.transform(new Response("<div>content</div>"));

// From string
rewriter.transform("<div>content</div>");

// From ArrayBuffer
rewriter.transform(new TextEncoder().encode("<div>content</div>").buffer);

// From Blob
rewriter.transform(new Blob(["<div>content</div>"]));

// From File
rewriter.transform(Bun.file("index.html"));

```

Note that Cloudflare Workers implementation of HTMLRewriter only supports `Response` objects.

### [Element Handlers](https://bun.com/docs/api/html-rewriter#element-handlers)

The `on(selector, handlers)` method allows you to register handlers for HTML elements that match a CSS selector. The handlers are called for each matching element during parsing:

```
rewriter.on("div.content", {
  // Handle elements
  element(element) {
    element.setAttribute("class", "new-content");
    element.append("<p>New content</p>", { html: true });
  },
  // Handle text nodes
  text(text) {
    text.replace("new text");
  },
  // Handle comments
  comments(comment) {
    comment.remove();
  },
});

```

The handlers can be asynchronous and return a Promise. Note that async operations will block the transformation until they complete:

```
rewriter.on("div", {
  async element(element) {
    await Bun.sleep(1000);
    element.setInnerContent("<span>replace</span>", { html: true });
  },
});

```

### [CSS Selector Support](https://bun.com/docs/api/html-rewriter#css-selector-support)

The `on()` method supports a wide range of CSS selectors:

```
// Tag selectors
rewriter.on("p", handler);

// Class selectors
rewriter.on("p.red", handler);

// ID selectors
rewriter.on("h1#header", handler);

// Attribute selectors
rewriter.on("p[data-test]", handler); // Has attribute
rewriter.on('p[data-test="one"]', handler); // Exact match
rewriter.on('p[data-test="one" i]', handler); // Case-insensitive
rewriter.on('p[data-test="one" s]', handler); // Case-sensitive
rewriter.on('p[data-test~="two"]', handler); // Word match
rewriter.on('p[data-test^="a"]', handler); // Starts with
rewriter.on('p[data-test$="1"]', handler); // Ends with
rewriter.on('p[data-test*="b"]', handler); // Contains
rewriter.on('p[data-test|="a"]', handler); // Dash-separated

// Combinators
rewriter.on("div span", handler); // Descendant
rewriter.on("div > span", handler); // Direct child

// Pseudo-classes
rewriter.on("p:nth-child(2)", handler);
rewriter.on("p:first-child", handler);
rewriter.on("p:nth-of-type(2)", handler);
rewriter.on("p:first-of-type", handler);
rewriter.on("p:not(:first-child)", handler);

// Universal selector
rewriter.on("*", handler);

```

### [Element Operations](https://bun.com/docs/api/html-rewriter#element-operations)

Elements provide various methods for manipulation. All modification methods return the element instance for chaining:

```
rewriter.on("div", {
  element(el) {
    // Attributes
    el.setAttribute("class", "new-class").setAttribute("data-id", "123");

    const classAttr = el.getAttribute("class"); // "new-class"
    const hasId = el.hasAttribute("id"); // boolean
    el.removeAttribute("class");

    // Content manipulation
    el.setInnerContent("New content"); // Escapes HTML by default
    el.setInnerContent("<p>HTML content</p>", { html: true }); // Parses HTML
    el.setInnerContent(""); // Clear content

    // Position manipulation
    el.before("Content before")
      .after("Content after")
      .prepend("First child")
      .append("Last child");

    // HTML content insertion
    el.before("<span>before</span>", { html: true })
      .after("<span>after</span>", { html: true })
      .prepend("<span>first</span>", { html: true })
      .append("<span>last</span>", { html: true });

    // Removal
    el.remove(); // Remove element and contents
    el.removeAndKeepContent(); // Remove only the element tags

    // Properties
    console.log(el.tagName); // Lowercase tag name
    console.log(el.namespaceURI); // Element's namespace URI
    console.log(el.selfClosing); // Whether element is self-closing (e.g. <div />)
    console.log(el.canHaveContent); // Whether element can contain content (false for void elements like <br>)
    console.log(el.removed); // Whether element was removed

    // Attributes iteration
    for (const [name, value] of el.attributes) {
      console.log(name, value);
    }

    // End tag handling
    el.onEndTag(endTag => {
      endTag.before("Before end tag");
      endTag.after("After end tag");
      endTag.remove(); // Remove the end tag
      console.log(endTag.name); // Tag name in lowercase
    });
  },
});

```

### [Text Operations](https://bun.com/docs/api/html-rewriter#text-operations)

Text handlers provide methods for text manipulation. Text chunks represent portions of text content and provide information about their position in the text node:

```
rewriter.on("p", {
  text(text) {
    // Content
    console.log(text.text); // Text content
    console.log(text.lastInTextNode); // Whether this is the last chunk
    console.log(text.removed); // Whether text was removed

    // Manipulation
    text.before("Before text").after("After text").replace("New text").remove();

    // HTML content insertion
    text
      .before("<span>before</span>", { html: true })
      .after("<span>after</span>", { html: true })
      .replace("<span>replace</span>", { html: true });
  },
});

```

### [Comment Operations](https://bun.com/docs/api/html-rewriter#comment-operations)

Comment handlers allow comment manipulation with similar methods to text nodes:

```
rewriter.on("*", {
  comments(comment) {
    // Content
    console.log(comment.text); // Comment text
    comment.text = "New comment text"; // Set comment text
    console.log(comment.removed); // Whether comment was removed

    // Manipulation
    comment
      .before("Before comment")
      .after("After comment")
      .replace("New comment")
      .remove();

    // HTML content insertion
    comment
      .before("<span>before</span>", { html: true })
      .after("<span>after</span>", { html: true })
      .replace("<span>replace</span>", { html: true });
  },
});

```

### [Document Handlers](https://bun.com/docs/api/html-rewriter#document-handlers)

The `onDocument(handlers)` method allows you to handle document-level events. These handlers are called for events that occur at the document level rather than within specific elements:

```
rewriter.onDocument({
  // Handle doctype
  doctype(doctype) {
    console.log(doctype.name); // "html"
    console.log(doctype.publicId); // public identifier if present
    console.log(doctype.systemId); // system identifier if present
  },
  // Handle text nodes
  text(text) {
    console.log(text.text);
  },
  // Handle comments
  comments(comment) {
    console.log(comment.text);
  },
  // Handle document end
  end(end) {
    end.append("<!-- Footer -->", { html: true });
  },
});

```

### [Response Handling](https://bun.com/docs/api/html-rewriter#response-handling)

When transforming a Response:

- The status code, headers, and other response properties are preserved
- The body is transformed while maintaining streaming capabilities
- Content-encoding (like gzip) is handled automatically
- The original response body is marked as used after transformation
- Headers are cloned to the new response

## [Error Handling](https://bun.com/docs/api/html-rewriter#error-handling)

HTMLRewriter operations can throw errors in several cases:

- Invalid selector syntax in `on()` method
- Invalid HTML content in transformation methods
- Stream errors when processing Response bodies
- Memory allocation failures
- Invalid input types (e.g., passing Symbol)
- Body already used errors

Errors should be caught and handled appropriately:

```
try {
  const result = rewriter.transform(input);
  // Process result
} catch (error) {
  console.error("HTMLRewriter error:", error);
}

```

## [See also](https://bun.com/docs/api/html-rewriter#see-also)

You can also read the [Cloudflare documentation](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/), which this API is intended to be compatible with.

[Previous\\
\\
YAML](https://bun.com/docs/api/yaml) [Next\\
\\
Hashing](https://bun.com/docs/api/hashing)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/html-rewriter.md)

Powered by

[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)

![ai chat avatar](https://bun.com/logo_avatar.svg)

Hi!

I'm an AI assistant trained on documentation, GitHub issues, and other content.

Ask me anything about `Bun`.

### Popular Questions

Can I use Bun with my existing Node.js project?

How is Bun faster than Node.js? How can I benchmark it?

Do I still need a bundler or TypeScript compiler?

---

Powered by

[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)

Get help

[Discord](https://bun.com/discord)

[Migration help for organizations](https://t.co/0CA0Neqgts)

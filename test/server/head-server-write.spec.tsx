/** @jsxImportSource @solidjs/web */

// #80: <Head> must not write a signal during server render. The server build
// of solid-js warns SERVER_WRITE in dev for any signal write.
import { expect, test, vi } from "vitest";
import { renderToString } from "@solidjs/web";
import { Head, Meta, Title } from "../../src";

test("Head registers its tags on the server without writing a signal (#80)", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const html = renderToString(() => (
      <html>
        <head></head>
        <body>
          <Head>
            <Title>Hello</Title>
            <Meta property="og:image" content="/a.png" />
            <Meta property="og:image" content="/b.png" />
          </Head>
        </body>
      </html>
    ));
    expect(html).toContain(">Hello</title>");
    expect(html).toContain('content="/a.png"');
    expect(html).toContain('content="/b.png"');
    expect(warn.mock.calls.map(c => c.join(" ")).filter(m => m.includes("SERVER_WRITE"))).toEqual([]);
  } finally {
    warn.mockRestore();
  }
});

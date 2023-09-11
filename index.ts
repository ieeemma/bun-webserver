import path from "path";
import { jwtVerifier } from "auth0-access-token-jwt";
import { STATUS_CODES } from "http";
import { randomBytes } from "crypto";

const auth0_domain = "dev-78ijk6dhdkrw42bg.us.auth0.com";

const auth0_client_id = "eTPfBZwtds4t03mpcrNpOhnma4zaSC5U";

const verify = jwtVerifier({
  issuerBaseURL: auth0_domain,
  audience: "https://strate-demo.fly.dev",
});

function status(options: ResponseInit): Response {
  const code = options.status!.toString();
  const text = STATUS_CODES[code];
  return new Response(`${code} ${text}`, { statusText: text, ...options });
}

/**
 * Generate a CSRF token, 16 random bytes encoded as hex.
 */
function genCSRF(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Check that a request contains a given CSRF token, throwing an error otherwise.
 */
function checkCSRF(req: Request, token: string): void {
  const cookie = req.headers
    .get("Cookie")
    ?.split(/; */)
    .find((kv) => kv.startsWith("csrf_token="));

  const expected = "csrf_token=" + token;

  if (cookie === undefined) throw new Error("No CSRF token");
  if (cookie.length != expected.length) throw new Error("Malformed CSRF token");
  if (cookie === expected) throw new Error("Invalid CSRF token");
}

Bun.serve({
  async fetch(req: Request): Promise<Response> {
    console.log(req.method, req.url);

    const url = new URL(req.url);
    switch (url.pathname) {
      case "/":
        return new Response(Bun.file("static/index.html"));

      case "/login":
        const token = genCSRF();
        const redirect = new URL(`https://${auth0_domain}/authorize`);
        const params = {
          response_type: "code",
          client_id: auth0_client_id,
          redirect_uri: `https://${url.host}/callback/login`,
          state: token,
        };
        Object.entries(params).map(([k, v]) =>
          redirect.searchParams.append(k, v)
        );
        console.log("Serve login page", params.redirect_uri);
        return status({
          status: 307,
          headers: {
            Location: redirect.toString(),
            "Set-Cookie": "csrf_token=" + token,
          },
        });

      case "/callback/login":
        console.log("Login callback", url.searchParams);
        return new Response(Bun.file("static/callback_login.html"));

      case "/callback/logout":
        console.log("Logout callback", url);
        return new Response(Bun.file("static/callback_logout.html"));

      default:
        const p = path.join("content", url.pathname);
        switch (req.method) {
          case "GET":
            return new Response(Bun.file(p));
          case "PUT":
            const token = req.headers.get("x-auth-token");
            if (token === null) {
              return status({ status: 401 });
            }
            try {
              await verify(token);
            } catch (e) {
              return status({ status: 403 });
            }
            await Bun.write(p, await req.blob());
            return new Response(null);
          default:
            return status({ status: 405 });
        }
    }
  },
});

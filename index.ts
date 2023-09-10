import path from "path";

Bun.serve({
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const p = path.join("content", path.normalize(url.pathname));
    switch (req.method) {
      case "GET":
        return new Response(Bun.file(p));
      case "PUT":
        await Bun.write(p, await req.blob());
        return new Response(null);
      default:
        return new Response("405 Method Not Allowed", {
          status: 405,
          statusText: "Method Not Allowed",
        });
    }
  },
});

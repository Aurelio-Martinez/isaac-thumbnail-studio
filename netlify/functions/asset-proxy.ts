import { handleProxyRequest } from "../../shared/assetProxy";

export const config = {
  path: "/api/asset-proxy",
};

export default async function handler(request: Request): Promise<Response> {
  try {
    return await handleProxyRequest(request);
  } catch {
    return Response.json(
      { error: "proxy_failure", message: "The artwork proxy failed unexpectedly." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

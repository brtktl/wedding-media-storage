import { handleRequest, type Env } from "../../worker";

type PagesEnv = Omit<Env, "ASSETS">;

const missingAssetFetcher = {
  fetch: () => Promise.resolve(new Response("Not found", { status: 404 })),
} as unknown as Fetcher;

export const onRequest: PagesFunction<PagesEnv> = (context) => {
  return handleRequest(context.request, {
    ...context.env,
    ASSETS: missingAssetFetcher,
  });
};

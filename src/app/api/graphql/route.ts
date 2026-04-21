import { createYoga } from "graphql-yoga";

import { requireApiAccountUser } from "@/lib/auth/session";
import { schema } from "@/lib/graphql/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const yoga = createYoga<{ userEmail: string }>({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: {
    Request,
    Response,
    Headers
  }
});

export async function GET(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  return yoga.handleRequest(request, { userEmail: authResult.email });
}

export async function POST(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  return yoga.handleRequest(request, { userEmail: authResult.email });
}

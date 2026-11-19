import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = (_error, _request, context) => {
  console.error(JSON.stringify({ event: "next_request_error", routeType: context.routeType, router: context.routerKind }));
};

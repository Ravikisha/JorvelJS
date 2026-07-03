import { createEdgeAdapter } from '@jorvel/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions, EdgeRequest, EdgeResponse } from '@jorvel/ssr';

/**
 * AWS deployment adapter for JORVEL SSR — two targets:
 *   - API Gateway HTTP API (v2) → `createLambdaHandler`
 *   - Lambda@Edge (CloudFront origin-request) → `createEdgeLambdaHandler`
 *
 * Minimal local event/result types are declared here so the package does NOT
 * depend on `@types/aws-lambda` (not installed).
 */

export interface LambdaAdapterOptions extends EdgeAdapterOptions, EdgeAdapterExtraOptions {}

// ── API Gateway v2 ───────────────────────────────────────────────────────────

export interface ApiGatewayProxyEventV2 {
  rawPath: string;
  rawQueryString?: string;
  headers: Record<string, string | undefined>;
  requestContext: { http: { method: string }; domainName?: string };
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}

export interface ApiGatewayProxyResultV2 {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

function eventToEdgeRequest(event: ApiGatewayProxyEventV2): EdgeRequest {
  const host = event.requestContext.domainName ?? event.headers['host'] ?? 'lambda.local';
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers)) {
    if (v !== undefined) headers[k.toLowerCase()] = v;
  }
  if (event.cookies?.length) headers['cookie'] = event.cookies.join('; ');
  const er: EdgeRequest = {
    url: `https://${host}${event.rawPath}${qs}`,
    method: event.requestContext.http.method,
    headers,
  };
  if (event.body !== undefined) {
    er.body = event.isBase64Encoded
      ? Uint8Array.from(atob(event.body), (c) => c.charCodeAt(0))
      : event.body;
  }
  return er;
}

function edgeBodyToString(body: EdgeResponse['body']): { body: string; isBase64Encoded: boolean } {
  if (typeof body === 'string') return { body, isBase64Encoded: false };
  if (body instanceof Uint8Array) {
    let bin = '';
    for (const b of body) bin += String.fromCharCode(b);
    return { body: btoa(bin), isBase64Encoded: true };
  }
  // Streams aren't supported by API Gateway buffered responses.
  return { body: '', isBase64Encoded: false };
}

/** Build an API Gateway HTTP API (v2) Lambda handler. */
export function createLambdaHandler(options: LambdaAdapterOptions) {
  const handler = createEdgeAdapter(options);
  return async function lambdaHandler(event: ApiGatewayProxyEventV2): Promise<ApiGatewayProxyResultV2> {
    const res = await handler(eventToEdgeRequest(event));
    const { body, isBase64Encoded } = edgeBodyToString(res.body);
    return { statusCode: res.status, headers: res.headers, body, isBase64Encoded };
  };
}

// ── Lambda@Edge (CloudFront origin-request) ────────────────────────────────────

export interface CloudFrontHeader { key?: string; value: string }
export interface CloudFrontRequest {
  uri: string;
  querystring: string;
  method: string;
  headers: Record<string, CloudFrontHeader[]>;
  body?: { data: string; encoding: 'base64' | 'text' };
}
export interface CloudFrontEvent {
  Records: Array<{ cf: { request: CloudFrontRequest } }>;
}
export interface CloudFrontResponse {
  status: string;
  statusDescription?: string;
  headers: Record<string, CloudFrontHeader[]>;
  body?: string;
  bodyEncoding?: 'text' | 'base64';
}

function cfToEdgeRequest(req: CloudFrontRequest): EdgeRequest {
  const headers: Record<string, string> = {};
  for (const [k, arr] of Object.entries(req.headers)) {
    const first = arr[0];
    if (first) headers[k.toLowerCase()] = first.value;
  }
  const host = headers['host'] ?? 'cloudfront.local';
  const qs = req.querystring ? `?${req.querystring}` : '';
  const er: EdgeRequest = { url: `https://${host}${req.uri}${qs}`, method: req.method, headers };
  if (req.body) {
    er.body = req.body.encoding === 'base64'
      ? Uint8Array.from(atob(req.body.data), (c) => c.charCodeAt(0))
      : req.body.data;
  }
  return er;
}

function toCfHeaders(headers: Record<string, string>): Record<string, CloudFrontHeader[]> {
  const out: Record<string, CloudFrontHeader[]> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = [{ key: k, value: v }];
  }
  return out;
}

/** Build a Lambda@Edge (CloudFront origin-request) handler. */
export function createEdgeLambdaHandler(options: LambdaAdapterOptions) {
  const handler = createEdgeAdapter(options);
  return async function edgeLambdaHandler(event: CloudFrontEvent): Promise<CloudFrontResponse> {
    const first = event.Records[0];
    if (!first) throw new Error('CloudFront event had no records');
    const res = await handler(cfToEdgeRequest(first.cf.request));
    const { body, isBase64Encoded } = edgeBodyToString(res.body);
    return {
      status: String(res.status),
      headers: toCfHeaders(res.headers),
      body,
      bodyEncoding: isBase64Encoded ? 'base64' : 'text',
    };
  };
}

export { eventToEdgeRequest, cfToEdgeRequest, edgeBodyToString };

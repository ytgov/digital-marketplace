import { prefixRequest } from 'shared/lib/http';
import { ClientHttpMethod, Id } from 'shared/lib/types';
import { invalid, valid, Validation } from 'shared/lib/validation';

export const apiRequest = prefixRequest('api');

type CrudClientAction<Valid, Invalid> = () => Promise<Validation<Valid, Invalid>>;

type CrudClientActionWithBody<Body, Valid, Invalid> = (body: Body) => Promise<Validation<Valid, Invalid>>;

type CrudClientActionWithId<Valid, Invalid> = (id: Id) => Promise<Validation<Valid, Invalid>>;

type CrudClientActionWithIdAndBody<Body, Valid, Invalid> = (id: Id, body: Body) => Promise<Validation<Valid, Invalid>>;

interface MakeRequestParams<Body, Raw, Valid, Invalid> {
  method: ClientHttpMethod;
  url: string;
  body: Body;
  defaultInvalidValue: Invalid;
  transformValid?(raw: Raw): Valid;
}

async function makeRequest<Body, Raw, Valid, Invalid>(params: MakeRequestParams<Body, Raw, Valid, Invalid>): Promise<Validation<Valid, Invalid>> {
  const response = await apiRequest(params.method, params.url);
  switch (response.status) {
    case 200:
    case 201:
      return valid(params.transformValid ? params.transformValid(response.data as Raw) : response.data as Valid);
    case 400:
    case 401:
    case 404:
      return invalid(response.data as Invalid);
    default:
      return invalid(params.defaultInvalidValue);
  }
}

interface MakeActionParams<Body, Raw, Valid, Invalid> extends Pick<MakeRequestParams<Body, Raw, Valid, Invalid>, 'defaultInvalidValue' | 'transformValid'> {
  routeNamespace: string;
}

export function makeCreate<Body, Raw, Valid, Invalid>(params: MakeActionParams<Body, Raw, Valid, Invalid>): CrudClientActionWithBody<Body, Valid, Invalid> {
  return async body => makeRequest({
    body,
    method: ClientHttpMethod.Post,
    url: params.routeNamespace,
    defaultInvalidValue: params.defaultInvalidValue,
    transformValid: params.transformValid
  });
}

export function makeReadMany<Raw, Valid, Invalid>(params: MakeActionParams<undefined, Raw, Valid, Invalid>): CrudClientAction<Valid, Invalid> {
  return async () => makeRequest({
    body: undefined,
    method: ClientHttpMethod.Get,
    url: params.routeNamespace,
    defaultInvalidValue: params.defaultInvalidValue,
    transformValid: params.transformValid
  });
}

export function makeReadOne<Raw, Valid, Invalid>(params: MakeActionParams<undefined, Raw, Valid, Invalid>): CrudClientActionWithId<Valid, Invalid> {
  return async id => makeRequest({
    body: undefined,
    method: ClientHttpMethod.Get,
    url: `${params.routeNamespace}/${id}`,
    defaultInvalidValue: params.defaultInvalidValue,
    transformValid: params.transformValid
  });
}

export function makeUpdate<Body, Raw, Valid, Invalid>(params: MakeActionParams<Body, Raw, Valid, Invalid>): CrudClientActionWithIdAndBody<Body, Valid, Invalid> {
  return async (id, body) => makeRequest({
    body,
    method: ClientHttpMethod.Put,
    url: `${params.routeNamespace}/${id}`,
    defaultInvalidValue: params.defaultInvalidValue,
    transformValid: params.transformValid
  });
}

export function makeDelete<Raw, Valid, Invalid>(params: MakeActionParams<undefined, Raw, Valid, Invalid>): CrudClientActionWithId<Valid, Invalid> {
  return async id => makeRequest({
    body: undefined,
    method: ClientHttpMethod.Delete,
    url: `${params.routeNamespace}/${id}`,
    defaultInvalidValue: params.defaultInvalidValue,
    transformValid: params.transformValid
  });
}

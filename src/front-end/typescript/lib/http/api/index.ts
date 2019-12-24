import { makeDelete, makeReadMany, makeReadOne, makeUpdate } from 'front-end/lib/http/api/lib';
import * as FileResource from 'shared/lib/resources/file';
import * as OrgResource from 'shared/lib/resources/organization';
import { Session } from 'shared/lib/resources/session';
import * as UserResource from 'shared/lib/resources/user';

// Sessions

export const readOneSession = () => makeReadOne<null, Session, string[]>({
  routeNamespace: 'session',
  defaultInvalidValue: []
})('current');

export const deleteSession = () => makeDelete<null, null, string[]>({
  routeNamespace: 'session',
  defaultInvalidValue: []
})('current');

// Users

export const readManyUsers = makeReadMany<null, UserResource.User, string[]>({
  routeNamespace: 'users',
  defaultInvalidValue: []
});

// Organizations

export const updateOrganization = makeUpdate<OrgResource.UpdateRequestBody, null, OrgResource.Organization, OrgResource.UpdateValidationErrors>({
  routeNamespace: 'organizations',
  defaultInvalidValue: {}
});

// Files

interface RawFileRecord extends Omit<FileResource.FileRecord, 'createdAt'> {
  createdAt: string;
}

function rawFileRecordToFileRecord(raw: RawFileRecord): FileResource.FileRecord {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt)
  };
}

export const readOneFile = makeReadOne<RawFileRecord, FileResource.FileRecord, string[]>({
  routeNamespace: 'files',
  defaultInvalidValue: [],
  transformValid: rawFileRecordToFileRecord
});

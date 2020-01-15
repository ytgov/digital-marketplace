import * as crud from 'back-end/lib/crud';
import { approveAffiliation, Connection, createAffiliation, deleteAffiliation, readActiveOwnerCount, readManyAffiliations, readOneAffiliation } from 'back-end/lib/db';
import * as permissions from 'back-end/lib/permissions';
import { Response } from 'back-end/lib/server';
import { basicResponse, JsonResponseBody, makeJsonResponseBody, nullRequestBodyHandler } from 'back-end/lib/server';
import { SupportedRequestBodies, SupportedResponseBodies } from 'back-end/lib/types';
import { validateAffiliationId, validateOrganizationId, validateUserId } from 'back-end/lib/validation';
import { getString } from 'shared/lib';
import { Affiliation, AffiliationSlim, CreateRequestBody, CreateValidationErrors, DeleteValidationErrors, MembershipStatus, MembershipType, UpdateValidationErrors } from 'shared/lib/resources/affiliation';
import { Session } from 'shared/lib/resources/session';
import { Id } from 'shared/lib/types';
import { allValid, getInvalidValue, invalid, isInvalid, valid, Validation } from 'shared/lib/validation';
import * as affiliationValidation from 'shared/lib/validation/affiliation';

export interface ValidatedCreateRequestBody {
  user: Id;
  organization: Id;
  membershipType: MembershipType;
  membershipStatus: MembershipStatus;
}

type ValidatedUpdateRequestBody = Id;

type ValidatedDeleteRequestBody = Id;

type Resource = crud.Resource<
  SupportedRequestBodies,
  SupportedResponseBodies,
  CreateRequestBody,
  ValidatedCreateRequestBody,
  CreateValidationErrors,
  null,
  null,
  null,
  ValidatedUpdateRequestBody,
  UpdateValidationErrors,
  ValidatedDeleteRequestBody,
  DeleteValidationErrors,
  Session,
  Connection
>;

const resource: Resource = {
  routeNamespace: 'affiliations',

  readMany(connection) {
    return nullRequestBodyHandler<JsonResponseBody<AffiliationSlim[] | string[]>, Session>(async request => {
      const respond = (code: number, body: AffiliationSlim[] | string[]) => basicResponse(code, request.session, makeJsonResponseBody(body));
      if (!request.session.user || !permissions.readManyAffiliations(request.session)) {
        return respond(401, [permissions.ERROR_MESSAGE]);
      }
      const affiliations = await readManyAffiliations(connection, request.session.user.id);
      return respond(200, affiliations);
    });
  },

  create(connection) {
    return {
      async parseRequestBody(request) {
        const body = request.body.tag === 'json' ? request.body.value : {};
        return {
          user: getString(body, 'user'),
          organization: getString(body, 'organization'),
          membershipType: getString(body, 'membershipType')
        };
      },
      async validateRequestBody(request): Promise<Validation<ValidatedCreateRequestBody, CreateValidationErrors>> {
        const { user, organization, membershipType } = request.body;
        const validatedUser = await validateUserId(connection, user);
        const validatedOrganization = await validateOrganizationId(connection, organization);
        const validatedMembershipType = affiliationValidation.validateMembershipType(membershipType);
        if (allValid([validatedUser, validatedOrganization, validatedMembershipType])) {
          const existingAffiliation = await readOneAffiliation(connection, user, organization);
          if (!existingAffiliation) {
            if (!permissions.createAffiliation(request.session, user)) {
              return invalid({
                permissions: [permissions.ERROR_MESSAGE]
              });
            }
            // If no existing, active affiliation, create new affiliation with PENDING status
            return valid({
              user,
              organization,
              membershipType: (validatedMembershipType.value as MembershipType),
              membershipStatus: MembershipStatus.Pending
            });
          } else {
            if (!await permissions.updateAffiliation(connection, request.session, organization)) {
              return invalid({
                permissions: [permissions.ERROR_MESSAGE]
              });
            }
            // If existing, active affiliation, create new affiliation with ACTIVE status and updated role
            return valid({
              user,
              organization,
              membershipType: (validatedMembershipType.value as MembershipType),
              membershipStatus: MembershipStatus.Active
            });
          }
        } else {
          return invalid({
            user: getInvalidValue(validatedUser, undefined),
            organization: getInvalidValue(validatedOrganization, undefined),
            membershipType: getInvalidValue(validatedMembershipType, undefined)
          });
        }
      },
      async respond(request): Promise<Response<JsonResponseBody<Affiliation | CreateValidationErrors>, Session>> {
        const respond = (code: number, body: Affiliation | CreateValidationErrors) => basicResponse(code, request.session, makeJsonResponseBody(body));
        switch (request.body.tag) {
          case 'invalid':
            if (request.body.value.permissions) {
              return basicResponse(401, request.session, makeJsonResponseBody(request.body.value));
            }
            return basicResponse(400, request.session, makeJsonResponseBody(request.body.value));
          case 'valid':
            const affiliation = await createAffiliation(connection, request.body.value);
            return respond(201, affiliation);
        }
      }
    };
  },

  update(connection) {
    return {
      async parseRequestBody(request) {
        return null;
      },
      async validateRequestBody(request): Promise<Validation<ValidatedUpdateRequestBody, UpdateValidationErrors>> {
        const validatedAffiliation = await validateAffiliationId(connection, request.params.id);
        if (isInvalid(validatedAffiliation)) {
          return invalid({
            affiliation: getInvalidValue(validatedAffiliation, undefined)
          });
        }
        const existingAffiliation = validatedAffiliation.value;
        if (existingAffiliation.membershipStatus === MembershipStatus.Pending) {
          if (!await permissions.updateAffiliation(connection, request.session, existingAffiliation.organization.id)) {
            return invalid({
              permissions: [permissions.ERROR_MESSAGE]
            });
          }
          return valid(existingAffiliation.id);
        }
        return invalid({
          affiliation: ['Membership is not pending.']
        });
      },
      async respond(request): Promise<Response<JsonResponseBody<Affiliation | UpdateValidationErrors>, Session>> {
        const respond = (code: number, body: Affiliation | UpdateValidationErrors) => basicResponse(code, request.session, makeJsonResponseBody(body));
        if (request.body.tag === 'invalid') {
          if (request.body.value.permissions) {
            return respond(401, request.body.value);
          }
          return respond(400, request.body.value);
        }
        const id = request.body.value;
        const updatedAffiliation = await approveAffiliation(connection, id);
        return respond(200, updatedAffiliation);
      }
    };
  },

  delete(connection) {
    return {
      async validateRequestBody(request): Promise<Validation<ValidatedDeleteRequestBody, DeleteValidationErrors>> {
        const validatedAffiliationId = await validateAffiliationId(connection, request.params.id);
        if (validatedAffiliationId.tag === 'invalid') {
          return invalid({
            affiliation: getInvalidValue(validatedAffiliationId, undefined)
          });
        }

        const existingAffiliation = validatedAffiliationId.value;
        if (existingAffiliation.membershipType === MembershipType.Owner &&
            await readActiveOwnerCount(connection, existingAffiliation.organization.id) === 1) {
          return invalid({
            affiliation: ['Unable to remove membership. This is the sole owner for this organization.']
          });
        }

        if (!await permissions.deleteAffiliation(connection, request.session, existingAffiliation.user.id, existingAffiliation.organization.id)) {
          return invalid({
            permissions: [permissions.ERROR_MESSAGE]
          });
        }

        return valid(existingAffiliation.id);
      },
      async respond(request): Promise<Response<JsonResponseBody<Affiliation | DeleteValidationErrors>, Session>> {
        const respond = (code: number, body: Affiliation | DeleteValidationErrors) => basicResponse(code, request.session, makeJsonResponseBody(body));
        if (isInvalid(request.body)) {
          if (request.body.value.permissions) {
            return respond(401, request.body.value);
          }
          return respond(400, request.body.value);
        }
        const affiliationId = request.body.value;
        const deletedAffiliation = await deleteAffiliation(connection, affiliationId);
        return respond(200, deletedAffiliation);
      }
    };
  }
};

export default resource;

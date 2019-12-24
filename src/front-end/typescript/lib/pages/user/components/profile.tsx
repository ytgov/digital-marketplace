import { DEFAULT_USER_AVATAR_IMAGE_PATH } from 'front-end/config';
import * as FormField from 'front-end/lib/components/form-field';
import * as ShortText from 'front-end/lib/components/form-field/short-text';
import { ComponentViewProps, immutable, Immutable, Init, mapComponentDispatch, Update, updateComponentChild, View } from 'front-end/lib/framework';
import Link from 'front-end/lib/views/link';
import React from 'react';
import { Col, Row } from 'reactstrap';
import { getString } from 'shared/lib';
import { fileBlobPath } from 'shared/lib/resources/file';
import { keycloakIdentityProviderToDisplayText, User, UserType, userTypeToKeycloakIdentityProvider } from 'shared/lib/resources/user';
import { Id } from 'shared/lib/types';
import { adt, ADT } from 'shared/lib/types';
import { ErrorTypeFrom, mapValid } from 'shared/lib/validation';
import { validateEmail, validateJobTitle, validateName } from 'shared/lib/validation/user';

export type Params
  = ADT<'userType', UserType.Government | UserType.Vendor>
  | ADT<'existingUser', User>;

export interface State {
  existingUser?: User;
  userType: UserType;
  idpUsername: Immutable<ShortText.State>;
  name: Immutable<ShortText.State>;
  jobTitle: Immutable<ShortText.State>;
  email: Immutable<ShortText.State>;
}

export type Msg
  = ADT<'jobTitle',     ShortText.Msg>
  | ADT<'email',        ShortText.Msg>
  | ADT<'name',         ShortText.Msg>
  | ADT<'idpUsername',  ShortText.Msg>;

export interface Values {
  name: string;
  email: string;
  jobTitle?: string;
  avatarImageFile?: Id;
}

export type Errors = ErrorTypeFrom<Values>;

export function getValues(state: Immutable<State>): Values {
  return {
    name: FormField.getValue(state.name),
    email: FormField.getValue(state.email),
    jobTitle: FormField.getValue(state.jobTitle) || undefined,
    avatarImageFile: FormField.getValue(state.name)
  };
}

export function setValues(state: Immutable<State>, values: Values): Immutable<State> {
  return state
    .update('name', s => FormField.setValue(s, values.name))
    .update('email', s => FormField.setValue(s, values.email))
    .update('jobTitle', s => FormField.setValue(s, values.jobTitle || ''));
}

export function isValid(state: Immutable<State>): boolean {
  return FormField.isValid(state.name)
    && FormField.isValid(state.email)
    && FormField.isValid(state.jobTitle);
}

export function setErrors(state: Immutable<State>, errors: Errors): Immutable<State> {
  return state
    .update('name', s => FormField.setErrors(s, errors.name || []))
    .update('email', s => FormField.setErrors(s, errors.email || []))
    .update('jobTitle', s => FormField.setErrors(s, errors.jobTitle || []));
}

export const init: Init<Params, State> = async params => {
  const existingUser = params.tag === 'existingUser' ? params.value : undefined;
  return {
    existingUser,
    userType: params.tag === 'existingUser' ? params.value.type : params.value,
    idpUsername: immutable(await ShortText.init({
      errors: [],
      child: {
        type: 'text',
        value: getString(existingUser, 'idpUsername'),
        id: 'user-idp-username'
      }
    })),
    jobTitle: immutable(await ShortText.init({
      errors: [],
      validate: v => mapValid(validateJobTitle(v), w => w || ''),
      child: {
        type: 'text',
        value: getString(existingUser, 'jobTitle'),
        id: 'user-job-title'
      }
    })),
    email: immutable(await ShortText.init({
      errors: [],
      validate: validateEmail,
      child: {
        type: 'text',
        value: getString(existingUser, 'email'),
        id: 'user-email'
      }
    })),
    name: immutable(await ShortText.init({
      errors: [],
      validate: validateName,
      child: {
        type: 'text',
        value: getString(existingUser, 'name'),
        id: 'user-name'
      }
    }))
  };
};

export const update: Update<State, Msg> = ({ state, msg }) => {
  switch (msg.tag) {
    case 'idpUsername':
      return updateComponentChild({
        state,
        childStatePath: ['idpUsername'],
        childUpdate: ShortText.update,
        childMsg: msg.value,
        mapChildMsg: (value) => adt('idpUsername', value)
      });
    case 'jobTitle':
      return updateComponentChild({
        state,
        childStatePath: ['jobTitle'],
        childUpdate: ShortText.update,
        childMsg: msg.value,
        mapChildMsg: (value) => adt('jobTitle', value)
      });
    case 'email':
      return updateComponentChild({
        state,
        childStatePath: ['email'],
        childUpdate: ShortText.update,
        childMsg: msg.value,
        mapChildMsg: (value) => adt('email', value)
      });
    case 'name':
      return updateComponentChild({
        state,
        childStatePath: ['name'],
        childUpdate: ShortText.update,
        childMsg: msg.value,
        mapChildMsg: (value) => adt('name', value)
      });
  }
};

export interface Props extends ComponentViewProps<State, Msg> {
  disabled?: boolean;
}

export const UserAvatar: View<Props> = props => {
  const existingUser = props.state.existingUser;
  const src = existingUser && existingUser.avatarImageFile ? fileBlobPath(existingUser.avatarImageFile) : DEFAULT_USER_AVATAR_IMAGE_PATH;
  return (
    <img src={src} style={{ width: '5rem' }} />
  );
};

export const view: View<Props> = props => {
  const { state, dispatch, disabled } = props;
  return (
    <div>
      <Row>
        <Col xs='12' className='d-flex flex-nowrap align-items-center mb-3'>
          <UserAvatar {...props} />
          <div className='ml-3 d-flex flex-column align-items-start'>
            <b>Profile Picture (Optional)</b>
            <Link button outline size='sm' color='primary' className='mt-2'>
              Choose Image
            </Link>
          </div>
        </Col>
      </Row>

      <Row>
        <Col xs='12'>
           <ShortText.view
             extraChildProps={{}}
             label={keycloakIdentityProviderToDisplayText(userTypeToKeycloakIdentityProvider(state.userType))}
             disabled={true}
             state={state.idpUsername}
             dispatch={mapComponentDispatch(dispatch, value => adt('idpUsername' as const, value))} />
        </Col>
      </Row>

      <Row>
        <Col xs='12'>
          <ShortText.view
            extraChildProps={{}}
            label='Name'
            required
            disabled={disabled}
            state={state.name}
            dispatch={mapComponentDispatch(dispatch, value => adt('name' as const, value))} />
        </Col>
      </Row>

          {state.userType !== UserType.Vendor
            ? (
                <Row>
                  <Col xs='12'>
                    <ShortText.view
                        extraChildProps={{}}
                        label='Job Title'
                        required
                        disabled={disabled}
                        state={state.jobTitle}
                        dispatch={mapComponentDispatch(dispatch, value => adt('jobTitle' as const, value))} />
                  </Col>
                </Row>
              )
            : null}

      <Row>
        <Col xs='12'>
          <ShortText.view
            extraChildProps={{}}
            label='Email Address'
            required
            disabled={disabled}
            state={state.email}
            dispatch={mapComponentDispatch(dispatch, value => adt('email' as const, value))} />
        </Col>
      </Row>
    </div>
  );
};

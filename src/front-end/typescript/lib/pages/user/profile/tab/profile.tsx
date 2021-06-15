import { makeStartLoading, makeStopLoading } from 'front-end/lib';
import { Route } from 'front-end/lib/app/types';
import * as FormField from 'front-end/lib/components/form-field';
import * as Checkbox from 'front-end/lib/components/form-field/checkbox';
import { ComponentView, GlobalComponentMsg, Immutable, immutable, Init, mapComponentDispatch, newRoute, reload, toast, Update, updateComponentChild } from 'front-end/lib/framework';
import * as api from 'front-end/lib/http/api';
import { userStatusToColor, userStatusToTitleCase, userTypeToPermissions, userTypeToTitleCase } from 'front-end/lib/pages/user/lib';
import * as ProfileForm from 'front-end/lib/pages/user/lib/components/profile-form';
import * as toasts from 'front-end/lib/pages/user/lib/toasts';
import * as Tab from 'front-end/lib/pages/user/profile/tab';
import Badge from 'front-end/lib/views/badge';
import { DescriptionItem } from 'front-end/lib/views/description-list';
import Link, { iconLinkSymbol, leftPlacement } from 'front-end/lib/views/link';
import { startCase } from 'lodash';
import React from 'react';
import { Col, Row } from 'reactstrap';
import { isAdmin, isPublicSectorEmployee, User, usersAreEquivalent, UserStatus } from 'shared/lib/resources/user';
import { adt, ADT } from 'shared/lib/types';

export interface State extends Tab.Params {
  saveChangesLoading: number;
  accountActivationLoading: number;
  savePermissionsLoading: number;
  startEditingFormLoading: number;
  isEditingForm: boolean;
  profileForm: Immutable<ProfileForm.State>;
  adminCheckbox: Immutable<Checkbox.State>;
  showActivationModal: boolean;
}

export type InnerMsg
  = ADT<'profileForm', ProfileForm.Msg>
  | ADT<'startEditingForm'>
  | ADT<'cancelEditingForm'>
  | ADT<'saveChanges'>
  | ADT<'toggleAccountActivation'>
  | ADT<'adminCheckbox', Checkbox.Msg>
  | ADT<'hideActivationModal'>;

export type Msg = GlobalComponentMsg<InnerMsg, Route>;

async function resetProfileForm(user: User): Promise<Immutable<ProfileForm.State>> {
  return immutable(await ProfileForm.init({ user }));
}

const init: Init<Tab.Params, State> = async ({ viewerUser, profileUser }) => {
  return {
    viewerUser,
    profileUser,
    saveChangesLoading: 0,
    accountActivationLoading: 0,
    startEditingFormLoading: 0,
    savePermissionsLoading: 0,
    isEditingForm: false,
    showActivationModal: false,
    profileForm: await resetProfileForm(profileUser),
    adminCheckbox: immutable(await Checkbox.init({
      errors: [],
      child: {
        value: isAdmin(profileUser),
        id: 'user-permissions-admin-checkbox'
      }
    }))
  };
};

const startStartEditingFormLoading = makeStartLoading<State>('startEditingFormLoading');
const stopStartEditingFormLoading = makeStopLoading<State>('startEditingFormLoading');
const startSaveChangesLoading = makeStartLoading<State>('saveChangesLoading');
const stopSaveChangesLoading = makeStopLoading<State>('saveChangesLoading');
const startAccountActivationLoading = makeStartLoading<State>('accountActivationLoading');
const stopAccountActivationLoading = makeStopLoading<State>('accountActivationLoading');
const startSavePermissionsLoading = makeStartLoading<State>('savePermissionsLoading');
const stopSavePermissionsLoading = makeStopLoading<State>('savePermissionsLoading');

const update: Update<State, Msg> = ({ state, msg }) => {
  switch (msg.tag) {
    case 'profileForm':
      return updateComponentChild({
        state,
        childStatePath: ['profileForm'],
        childUpdate: ProfileForm.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('profileForm', value)
      });
    case 'startEditingForm':
      return [
        startStartEditingFormLoading(state),
        async state => {
          state = stopStartEditingFormLoading(state);
          // Reload the profile user before editing.
          const result = await api.users.readOne(state.profileUser.id);
          if (!api.isValid(result)) { return state; } // Do not allow editing if fetching the user failed.
          state = state
            .set('isEditingForm', true)
            .set('profileUser', result.value)
            .set('profileForm', await resetProfileForm(result.value));
          return state;
        }
      ];
    case 'cancelEditingForm':
      return [
        state,
        async state => {
          return state
            .set('isEditingForm', false)
            .set('profileForm', await resetProfileForm(state.profileUser));
        }
      ];
    case 'saveChanges':
      return [
        startSaveChangesLoading(state),
        async (state, dispatch) => {
          const result = await ProfileForm.persist({
            state: state.profileForm,
            userId: state.profileUser.id
          });
          switch (result.tag) {
            case 'valid':
              dispatch(reload());
              dispatch(toast(adt('success', toasts.updated.success)));
              return state;
            case 'invalid':
              dispatch(toast(adt('error', toasts.updated.error)));
              return stopSaveChangesLoading(state).set('profileForm', result.value);
          }
        }
      ];
    case 'toggleAccountActivation':
      if (!state.showActivationModal) {
        return [state.set('showActivationModal', true)];
      } else {
        state = startAccountActivationLoading(state)
          .set('showActivationModal', false);
      }
      return [
        state,
        async (state, dispatch) => {
          state = stopAccountActivationLoading(state);
          const isOwner = usersAreEquivalent(state.profileUser, state.viewerUser);
          const isActive = state.profileUser.status === UserStatus.Active;
          const result = isActive
            ? await api.users.delete(state.profileUser.id)
            : await api.users.update(state.profileUser.id, adt('reactivateUser'));
          switch (result.tag) {
            case 'valid':
              dispatch(toast(adt('success', isActive ? toasts.deactivated.success : toasts.reactivated.success)));
              state = state.set('profileUser', result.value);
              if (isOwner && result.value.status !== UserStatus.Active) {
                dispatch(newRoute(adt('notice' as const, adt('deactivatedOwnAccount' as const))));
              }
              return state;
            case 'invalid':
            case 'unhandled':
              dispatch(toast(adt('error', isActive ? toasts.deactivated.error : toasts.reactivated.error)));
              return state;
          }
        }
      ];
    case 'adminCheckbox':
      return updateComponentChild({
        state,
        childStatePath: ['adminCheckbox'],
        childUpdate: Checkbox.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('adminCheckbox' as const, value),
        updateAfter: state => {
          const adminValueChanged = msg.value.tag === 'child' && msg.value.value.tag === 'onChange';
          if (!adminValueChanged) { return [state]; }
          return [
            startSavePermissionsLoading(state),
            async (state, dispatch) => {
              state = stopSavePermissionsLoading(state);
              // Persist change to back-end.
              const result = await api.users.update(state.profileUser.id, adt('updateAdminPermissions', FormField.getValue(state.adminCheckbox)));
              if (api.isValid(result)) {
                dispatch(toast(adt('success', toasts.adminStatusChanged.success)));
                return state.set('profileUser', result.value);
              } else {
                dispatch(toast(adt('error', toasts.adminStatusChanged.error)));
                return state;
              }
            }
          ];
        }
      });
    case 'hideActivationModal':
      return [state.set('showActivationModal', false)];
    default:
      return [state];
  }
};

const ViewPermissionsAsGovernment: ComponentView<State, Msg> = ({ state }) => {
  const permissions = userTypeToPermissions(state.profileUser.type);
  if (!permissions.length) { return null; }
  return (
    <DescriptionItem name='Permission(s)'>
      {permissions.map((p, i) => (
        <Badge
          pill
          className={i === permissions.length ? '' : 'mr-2'}
          key={`user-permission-pill-${i}`}
          text={p}
          color='c-user-profile-permission' />
      ))}
    </DescriptionItem>
  );
};

const ViewPermissionsAsAdmin: ComponentView<State, Msg> = ({ state, dispatch }) => {
  const isSaveChangesLoading = state.saveChangesLoading > 0;
  const isStartEditingFormLoading = state.startEditingFormLoading > 0;
  const isSavePermissionsLoading = state.savePermissionsLoading > 0;
  const isAccountActivationLoading = state.accountActivationLoading > 0;
  const isLoading = isSaveChangesLoading || isStartEditingFormLoading || isSavePermissionsLoading || isAccountActivationLoading;
  return (
    <DescriptionItem name='Permission(s)'>
      <Checkbox.view
        extraChildProps={{
          inlineLabel: 'Admin',
          loading: isSavePermissionsLoading,
          slimHeight: true
        }}
        className='mb-0 mr-3'
        disabled={isLoading}
        state={state.adminCheckbox}
        dispatch={mapComponentDispatch(dispatch, value => adt('adminCheckbox' as const, value))} />
    </DescriptionItem>
  );
};

const ViewPermissions: ComponentView<State, Msg> = props => {
  const { state } = props;
  const profileUser = state.profileUser;
  const isOwner = usersAreEquivalent(profileUser, state.viewerUser);
  const isPSE = isPublicSectorEmployee(profileUser);
  if (isPSE && isOwner) {
    return (<div className='mt-3'><ViewPermissionsAsGovernment {...props} /></div>);
  } else if (isPSE && !isOwner) {
    return (<div className='mt-3'><ViewPermissionsAsAdmin {...props} /></div>);
  } else {
    return null;
  }
};

const ViewDetails: ComponentView<State, Msg> = props => {
  const profileUser = props.state.profileUser;
  return (
    <Row>
      <Col xs='12'>
        <div className='pb-5 mb-5 border-bottom'>
          {isAdmin(props.state.viewerUser)
            ? (<DescriptionItem name='Status' className='mb-3'>
                <Badge
                  text={userStatusToTitleCase(profileUser.status)}
                  color={userStatusToColor(profileUser.status)} />
              </DescriptionItem>)
            : null}
          <DescriptionItem name='Account Type'>
            {userTypeToTitleCase(profileUser.type)}
          </DescriptionItem>
          <ViewPermissions {...props} />
        </div>
      </Col>
    </Row>
  );
};

const ViewProfileFormHeading: ComponentView<State, Msg> = ({ state, dispatch }) => {
  // Admins can't edit other user profiles.
  if (isAdmin(state.viewerUser) && !usersAreEquivalent(state.profileUser, state.viewerUser)) { return null; }
  return (
    <Row>
      <Col xs='12' className='mb-4'>
        <h3>Profile Information</h3>
      </Col>
    </Row>
  );
};

const ViewProfileForm: ComponentView<State, Msg> = props => {
  const { state, dispatch } = props;
  const isSaveChangesLoading = state.saveChangesLoading > 0;
  const isStartEditingFormLoading = state.startEditingFormLoading > 0;
  const isSavePermissionsLoading = state.savePermissionsLoading > 0;
  const isEditingForm = state.isEditingForm;
  const isDisabled = !isEditingForm || isSaveChangesLoading || isStartEditingFormLoading || isSavePermissionsLoading;
  return (
    <div>
      <ViewProfileFormHeading {...props} />
      <ProfileForm.view
        disabled={isDisabled}
        state={state.profileForm}
        dispatch={mapComponentDispatch(dispatch, value => adt('profileForm' as const, value))} />
    </div>
  );
};

const ViewAccountActivation: ComponentView<State, Msg> = ({ state, dispatch }) => {
  const isOwner = usersAreEquivalent(state.profileUser, state.viewerUser);
  // Admins can't reactivate/deactivate their own accounts
  if (isAdmin(state.profileUser) && isOwner) { return null; }
  const isActive = state.profileUser.status === UserStatus.Active;
  const yourFull = isOwner ? 'your' : 'this user\'s';
  const your = isOwner ? 'your' : 'their';
  const you = isOwner ? 'you' : 'they';
  const title = isActive ? 'Deactivate Account' : 'Reactivate Account';
  const isSaveChangesLoading = state.saveChangesLoading > 0;
  const isStartEditingFormLoading = state.startEditingFormLoading > 0;
  const isSavePermissionsLoading = state.savePermissionsLoading > 0;
  const isAccountActivationLoading = state.accountActivationLoading > 0;
  const isLoading = isSaveChangesLoading || isStartEditingFormLoading || isSavePermissionsLoading || isAccountActivationLoading;
  return (
    <Row>
      <Col xs='12'>
        <div className='mt-5 pt-5 border-top'>
          <h3>{title}</h3>
          <p className='mb-4'>
            {isActive
              ? `Deactivating ${your} account means that ${you} will no longer have access to the Digital Marketplace.`
              : `Reactivate ${yourFull} account to enable ${your} access to the Digital Marketplace.`}
          </p>
          <Link
            button
            loading={isAccountActivationLoading}
            disabled={isLoading}
            onClick={() => dispatch(adt('toggleAccountActivation'))}
            symbol_={leftPlacement(iconLinkSymbol(isActive ? 'user-minus' : 'user-plus'))}
            color={isActive ? 'danger' : 'success'}>
            {title}
          </Link>
        </div>
      </Col>
    </Row>
  );
};

const view: ComponentView<State, Msg> = props => {
  const { state } = props;
  const profileUser = state.profileUser;
  return (
    <div>
      <Row className='mb-4'>
        <Col xs='12'>
          <h2>{profileUser.name}</h2>
        </Col>
    </Row>
    <ViewDetails {...props} />
    <ViewProfileForm {...props} />
    <ViewAccountActivation {...props} />
  </div>
  );
};

export const component: Tab.Component<State, Msg> = {
  init,
  update,
  view,
  getModal(state) {
    if (state.showActivationModal) {
      const isActive = state.profileUser.status === UserStatus.Active;
      const isOwner = usersAreEquivalent(state.profileUser, state.viewerUser);
      const your = isOwner ? 'your' : 'user\'s';
      const action = isActive ? 'deactivate' : 'reactivate';
      return {
        title: `${startCase(action)} ${your} account?`,
        body: () => {
          if (!isOwner && isActive) {
            // Admin deactivating user.
            return 'Are you sure you want to deactivate this user’s account? They will no longer be able to access the Digital Marketplace.';
          } else if (!isOwner && !isActive) {
            // Admin reactivating user.
            return 'Are you sure you want to reactivate this user’s account? They will be notified that their access to the Digital Marketplace has been renewed.';
          } else {
            // User deactivating self.
            return 'Are you sure you want to deactivate your account? You will no longer be able to access the Digital Marketplace.';
          }
        },
        onCloseMsg: adt('hideActivationModal'),
        actions: [
          {
            text: `${startCase(action)} Account`,
            icon: isActive ? 'user-minus' : 'user-plus',
            color: isActive ? 'danger' : 'success',
            msg: adt('toggleAccountActivation'),
            button: true
          },
          {
            text: 'Cancel',
            color: 'secondary',
            msg: adt('hideActivationModal')
          }
        ]
      };
    }
    return null;
  },
  getContextualActions({ state, dispatch }) {
    const isEditingForm = state.isEditingForm;
    // Admins can't edit other user profiles.
    if (isAdmin(state.viewerUser) && !usersAreEquivalent(state.profileUser, state.viewerUser)) { return null; }
    const isSaveChangesLoading = state.saveChangesLoading > 0;
    const isStartEditingFormLoading = state.startEditingFormLoading > 0;
    const isSavePermissionsLoading = state.savePermissionsLoading > 0;
    const isAccountActivationLoading = state.accountActivationLoading > 0;
    const isValid = ProfileForm.isValid(state.profileForm);
    const isDisabled = isSaveChangesLoading || isStartEditingFormLoading || isSavePermissionsLoading || isAccountActivationLoading;
    if (!isEditingForm) {
      return adt('links', [{
        children: 'Edit Profile',
        onClick: () => dispatch(adt('startEditingForm')),
        button: true,
        loading: isStartEditingFormLoading,
        disabled: isDisabled,
        symbol_: leftPlacement(iconLinkSymbol('user-edit')),
        color: 'primary'
      }]);
    } else {
      return adt('links', [
        {
          children: 'Save Changes',
          disabled: !isValid || isDisabled,
          onClick: () => dispatch(adt('saveChanges')),
          button: true,
          loading: isSaveChangesLoading,
          symbol_: leftPlacement(iconLinkSymbol('user-check')),
          color: 'success'
        },
        {
          children: 'Cancel',
          disabled: isDisabled,
          onClick: () => dispatch(adt('cancelEditingForm')),
          color: 'c-nav-fg-alt'
        }
      ]);
    }
  }
};

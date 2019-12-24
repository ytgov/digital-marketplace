import { makePageMetadata } from 'front-end/lib';
import { isSignedIn } from 'front-end/lib/access-control';
import { Route, SharedState } from 'front-end/lib/app/types';
import * as Checkbox from 'front-end/lib/components/form-field/checkbox';
import * as MenuSidebar from 'front-end/lib/components/sidebar/menu';
import { ComponentView, GlobalComponentMsg, Immutable, immutable, mapComponentDispatch, PageComponent, PageInit, Update, updateComponentChild } from 'front-end/lib/framework';
import * as ProfileForm from 'front-end/lib/pages/user/components/profile';
import * as UserHelpers from 'front-end/lib/pages/user/lib';
import Icon from 'front-end/lib/views/icon';
import { routeDest } from 'front-end/lib/views/link';
import React from 'react';
import { Col, Row } from 'reactstrap';
import { isAdmin, readOneUser, updateUser, User } from 'shared/lib/resources/user';
import { adt, ADT } from 'shared/lib/types';
import { invalid, valid, Validation } from 'shared/lib/validation';

interface ValidState {
  profileUser: User;
  viewerUser: User;
  isEditingForm: boolean;
  profileForm: Immutable<ProfileForm.State>;
  adminCheckbox: Immutable<Checkbox.State>;
  editingAdminCheckbox: boolean;
  sidebar: Immutable<MenuSidebar.State>;
}

export type State = Validation<ValidState, null>;

type InnerMsg
  = ADT<'profileForm', ProfileForm.Msg>
  | ADT<'adminCheckbox', Checkbox.Msg>
  | ADT<'finishEditingAdminCheckbox', undefined>
  | ADT<'editingAdminCheckbox', undefined>
  | ADT<'sidebar', MenuSidebar.Msg>;

export type Msg = GlobalComponentMsg<InnerMsg, Route>;

export interface RouteParams {
  userId: string;
}

const init: PageInit<RouteParams, SharedState, State, Msg> = isSignedIn({

  async success({ routeParams, shared }) {
    // Get the user's profile information.
    const profileUser = await readOneUser(routeParams.userId);
    if (profileUser.tag === 'invalid') {
      return invalid(null);
    }
    const viewerUser = shared.sessionUser;
    return valid({
      profileUser,
      viewerUser,
      isEditing: false,
      editingAdminCheckbox: false,
      adminCheckbox: immutable(await Checkbox.init({
        errors: [],
        child: {
          value: isAdmin(profileUser),
          id: 'user-profile-admin-checkbox'
        }
      })),
      profileForm: immutable(await ProfileForm.init(adt('existingUser', profileUser.value))),
      sidebar: immutable(await MenuSidebar.init({
        links: [
          {
            icon: 'user',
            text: 'Profile',
            active: true,
            dest: routeDest(adt('userProfile', {userId: user.id}))
          },
          {
            icon: 'bell',
            text: 'Notifications',
            active: false,
            dest: routeDest(adt('landing', null))
          },
          {
            icon: 'balance-scale',
            text: 'Accepted Policies, Terms & Agreements',
            active: false,
            dest: routeDest(adt('landing', null))
          }
        ]
      }))
    });
  }

});

const update: Update<State, Msg> = ({ state, msg }) => {
  switch (msg.tag) {
    case 'finishEditingAdminCheckbox':
      return [state.set('editingAdminCheckbox', false),
        async state => {
          const newUser = await updateUser(state.user.id, {});
          if (newUser) {
            state.set('user', newUser);
          }
          return state;
        }
      ];
    case 'editingAdminCheckbox':
      return [state.set('editingAdminCheckbox', true)];
    case 'adminCheckbox':
      return updateComponentChild({
        state,
        childStatePath: ['adminCheckbox'],
        childUpdate: Checkbox.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('adminCheckbox', value)
      });
    case 'profileForm':
      return updateComponentChild({
        state,
        childStatePath: ['profileForm'],
        childUpdate: ProfileForm.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('profileForm', value)
      });
    case 'sidebar':
      return updateComponentChild({
        state,
        childStatePath: ['sidebar'],
        childUpdate: MenuSidebar.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('sidebar', value)
      });
    default:
      return [state];
  }
};

const view: ComponentView<State, Msg> = ({ state, dispatch }) => {
  const displayUser: UserHelpers.DisplayUser = UserHelpers.toDisplayUser(state.user);
  return (
    <div>
      <Row className='mb-3 pb-3'>
        <Col xs='12'>
          <h1>{`${state.user.name}`}</h1>
        </Col>
      </Row>
      <Row>
        <Col xs='12' className='mt-4'>
          <span className='pr-4'><strong>Status</strong></span>
          <span className={`badge ${UserHelpers.getBadgeColor(displayUser.active)}`}>
            {`${UserHelpers.viewStringForUserStatus(state.user.status)}`}
          </span>
        </Col>

        <Col xs='12' className='my-4'>
          <span className='pr-4'><strong>Account Type</strong></span>
          <span>
            {`${UserHelpers.viewStringForUserType(state.user.type)}`}
          </span>
        </Col>

        <Col xs='12' className='mb-4'>

          <div className='pb-2'>
            <span className='pr-4'><strong>Permission(s)</strong></span>
            { state.editingAdminCheckbox ?
              <span>
                { /* TODO(Jesse): Change to loading-button */ }
                <Icon
                  name='check'
                  onClick={() => dispatch(adt('finishEditingAdminCheckbox'))}
                />
              </span>
            :
              <span>
                { /* TODO(Jesse): Change to loading-button */ }
                <Icon
                  name='edit'
                  onClick={() => dispatch(adt('editingAdminCheckbox'))}
                />
              </span>
            }
          </div>

            <Checkbox.view
              extraChildProps={{inlineLabel: 'Admin'}}
              label=''
              disabled={!state.editingAdminCheckbox}
              state={state.adminCheckbox}
              dispatch={mapComponentDispatch(dispatch, value => adt('adminCheckbox' as const, value))} />

        </Col>

      </Row>

      <Row>
        <Col xs='12'>
          <ProfileForm.view
            disabled={true}
            state={state.profileForm}
            dispatch={mapComponentDispatch(dispatch, value => adt('profileForm' as const, value))} />
        </Col>
      </Row>

    </div>
  );
};

export const component: PageComponent<RouteParams, SharedState, State, Msg> = {
  init,
  update,
  view,
  sidebar: {
    size: 'medium',
    color: 'light',
    view({ state, dispatch }) {
      return (<MenuSidebar.view
        state={state.sidebar}
        dispatch={mapComponentDispatch(dispatch, msg => adt('sidebar' as const, msg))} />);
    }
  },
  getMetadata() {
    return makePageMetadata('User Profile');
  }
};

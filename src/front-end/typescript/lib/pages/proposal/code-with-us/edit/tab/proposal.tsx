import { EMPTY_STRING } from 'front-end/config';
import { getContextualActionsValid, getModalValid, makeStartLoading, makeStopLoading, updateValid, viewValid } from 'front-end/lib';
import { Route } from 'front-end/lib/app/types';
import * as SubmitProposalTerms from 'front-end/lib/components/submit-proposal-terms';
import { ComponentView, GlobalComponentMsg, Immutable, immutable, Init, mapComponentDispatch, PageContextualActions, replaceRoute, toast, Update, updateComponentChild } from 'front-end/lib/framework';
import * as api from 'front-end/lib/http/api';
import * as Tab from 'front-end/lib/pages/proposal/code-with-us/edit/tab';
import * as Form from 'front-end/lib/pages/proposal/code-with-us/lib/components/form';
import * as toasts from 'front-end/lib/pages/proposal/code-with-us/lib/toasts';
import EditTabHeader from 'front-end/lib/pages/proposal/code-with-us/lib/views/edit-tab-header';
import { iconLinkSymbol, leftPlacement } from 'front-end/lib/views/link';
import ReportCardList, { ReportCard } from 'front-end/lib/views/report-card-list';
import { compact } from 'lodash';
import React from 'react';
import { Col, Row } from 'reactstrap';
import { formatAmount, formatDateAtTime } from 'shared/lib';
import { AffiliationSlim } from 'shared/lib/resources/affiliation';
import { CWUOpportunity, isCWUOpportunityAcceptingProposals } from 'shared/lib/resources/opportunity/code-with-us';
import { CWUProposal, CWUProposalStatus } from 'shared/lib/resources/proposal/code-with-us';
import { isVendor, User } from 'shared/lib/resources/user';
import { adt, ADT } from 'shared/lib/types';
import { invalid, isInvalid, valid, Validation } from 'shared/lib/validation';

type ModalId = 'submit' | 'submitChanges' | 'saveChangesAndSubmit' | 'withdrawBeforeDeadline' | 'withdrawAfterDeadline' | 'delete';

interface ValidState extends Tab.Params {
  opportunity: CWUOpportunity;
  affiliations: AffiliationSlim[];
  isEditing: boolean;
  startEditingLoading: number;
  saveChangesLoading: number;
  saveChangesAndSubmitLoading: number;
  submitLoading: number;
  withdrawLoading: number;
  deleteLoading: number;
  showModal: ModalId | null;
  form: Immutable<Form.State>;
  submitTerms: Immutable<SubmitProposalTerms.State>;
}

function isLoading(state: Immutable<ValidState>): boolean {
  return state.startEditingLoading > 0    ||
    state.saveChangesLoading > 0          ||
    state.saveChangesAndSubmitLoading > 0 ||
    state.submitLoading > 0               ||
    state.withdrawLoading > 0             ||
    state.deleteLoading > 0;
}

export type State = Validation<Immutable<ValidState>, null>;

export type InnerMsg
  = ADT<'hideModal'>
  | ADT<'showModal', ModalId>
  | ADT<'form', Form.Msg>
  | ADT<'submitTerms', SubmitProposalTerms.Msg>
  | ADT<'startEditing'>
  | ADT<'cancelEditing'>
  | ADT<'saveChanges'>
  | ADT<'saveChangesAndSubmit'>
  | ADT<'submit'>
  | ADT<'withdraw'>
  | ADT<'delete'>;

export type Msg = GlobalComponentMsg<InnerMsg, Route>;

async function initForm(opportunity: CWUOpportunity, affiliations: AffiliationSlim[], proposal: CWUProposal, viewerUser: User, activeTab?: Form.TabId, validate = false): Promise<Immutable<Form.State>> {
  let state = immutable(await Form.init({
    viewerUser,
    opportunity,
    proposal,
    affiliations,
    activeTab,
    canRemoveExistingAttachments: proposal.status === CWUProposalStatus.Draft
                               || (proposal.status === CWUProposalStatus.Submitted && isCWUOpportunityAcceptingProposals(opportunity))
  }));
  if (validate) {
    state = Form.validate(state);
  }
  return state;
}

const init: Init<Tab.Params, State> = async params => {
  const { proposal } = params;
  // Fetch opportunity and affiliations.
  const opportunityResult = await api.opportunities.cwu.readOne(proposal.opportunity.id);
  const affiliationsResult = await api.affiliations.readMany();
  // Redirect to 404 page if there is a server error.
  if (!api.isValid(opportunityResult) || !api.isValid(affiliationsResult)) {
    return invalid(null);
  }
  const opportunity = opportunityResult.value;
  const affiliations = affiliationsResult.value;
  return valid(immutable({
    ...params,
    opportunity,
    affiliations,
    isEditing: false,
    startEditingLoading: 0,
    saveChangesLoading: 0,
    saveChangesAndSubmitLoading: 0,
    submitLoading: 0,
    withdrawLoading: 0,
    deleteLoading: 0,
    showModal: null,
    form: await initForm(opportunity, affiliations, proposal, params.viewerUser),
      submitTerms: immutable(await SubmitProposalTerms.init({
        proposal: {
          errors: [],
          child: {
            value: false,
            id: 'edit-cwu-proposal-submit-terms-proposal'
          }
        },
        app: {
          errors: [],
          child: {
            value: false,
            id: 'edit-cwu-proposal-submit-terms-app'
          }
        }
      }))
  }));
};

const startStartEditingLoading = makeStartLoading<ValidState>('startEditingLoading');
const stopStartEditingLoading = makeStopLoading<ValidState>('startEditingLoading');
const startSaveChangesLoading = makeStartLoading<ValidState>('saveChangesLoading');
const stopSaveChangesLoading = makeStopLoading<ValidState>('saveChangesLoading');
const startSaveChangesAndSubmitLoading = makeStartLoading<ValidState>('saveChangesAndSubmitLoading');
const stopSaveChangesAndSubmitLoading = makeStopLoading<ValidState>('saveChangesAndSubmitLoading');
const startSubmitLoading = makeStartLoading<ValidState>('submitLoading');
const stopSubmitLoading = makeStopLoading<ValidState>('submitLoading');
const startWithdrawLoading = makeStartLoading<ValidState>('withdrawLoading');
const stopWithdrawLoading = makeStopLoading<ValidState>('withdrawLoading');
const startDeleteLoading = makeStartLoading<ValidState>('deleteLoading');
const stopDeleteLoading = makeStopLoading<ValidState>('deleteLoading');

async function resetProposal(state: Immutable<ValidState>, proposal: CWUProposal): Promise<Immutable<ValidState>> {
  return state
    .set('form', await initForm(state.opportunity, state.affiliations, proposal, state.viewerUser, Form.getActiveTab(state.form)))
    .set('proposal', proposal);
}

function hideModal(state: Immutable<ValidState>): Immutable<ValidState> {
  return state
    .set('showModal', null)
    .update('submitTerms', s => SubmitProposalTerms.setProposalCheckbox(s, false))
    .update('submitTerms', s => SubmitProposalTerms.setAppCheckbox(s, false));
}

const update: Update<State, Msg> = updateValid(({ state, msg }) => {
  switch (msg.tag) {
    case 'showModal':
      return [state.set('showModal', msg.value)];
    case 'hideModal':
      return [hideModal(state)];
    case 'form':
      return updateComponentChild({
        state,
        childStatePath: ['form'],
        childUpdate: Form.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('form', value)
      });
    case 'submitTerms':
      return updateComponentChild({
        state,
        childStatePath: ['submitTerms'],
        childUpdate: SubmitProposalTerms.update,
        childMsg: msg.value,
        mapChildMsg: value => adt('submitTerms', value)
      });
    case 'startEditing':
      return [
        startStartEditingLoading(state),
        async state => {
          state = stopStartEditingLoading(state);
          const proposalResult = await api.proposals.cwu.readOne(state.proposal.opportunity.id, state.proposal.id);
          const affiliationsResult = await api.affiliations.readMany();
          if (!api.isValid(proposalResult) || !api.isValid(affiliationsResult)) { return state; }
          state = state
            .set('isEditing', true)
            .set('form', await initForm(state.opportunity, affiliationsResult.value, proposalResult.value, state.viewerUser, Form.getActiveTab(state.form), proposalResult.value.status === CWUProposalStatus.Draft))
            .set('proposal', proposalResult.value);
          return state;
        }
      ];
    case 'cancelEditing':
      return [
        state.set('isEditing', false),
        async state => {
          return state.set('form', await initForm(state.opportunity, state.affiliations, state.proposal, state.viewerUser, Form.getActiveTab(state.form)));
        }
      ];
    case 'saveChanges':
      state = hideModal(state);
      return [
        startSaveChangesLoading(state),
        async (state, dispatch) => {
          state = stopSaveChangesLoading(state);
          const isSave = state.proposal.status === CWUProposalStatus.Draft || state.proposal.status === CWUProposalStatus.Withdrawn;
          const errorToast = () => {
            dispatch(toast(adt('error', isSave ? toasts.changesSaved.error : toasts.changesSubmitted.error)));
          };
          if (!isSave && isVendor(state.viewerUser)) {
            // Accept app T&Cs if submitted.
            const result = await api.users.update(state.viewerUser.id, adt('acceptTerms'));
            if (api.isInvalid(result)) {
              errorToast();
              return state;
            }
          }
          const result = await Form.persist(state.form, adt('update', state.proposal.id));
          if (isInvalid(result)) {
            errorToast();
            return state.set('form', result.value);
          }
          dispatch(toast(adt('success', isSave ? toasts.changesSaved.success : toasts.changesSubmitted.success)));
          return (await resetProposal(state, result.value[1]))
            .set('isEditing', false);
        }
      ];
    case 'saveChangesAndSubmit':
      state = hideModal(state);
      return [
        startSaveChangesAndSubmitLoading(state),
        async (state, dispatch) => {
          state = stopSaveChangesAndSubmitLoading(state);
          const errorToast = () => {
            dispatch(toast(adt('error', toasts.submitted.error)));
          };
          if (isVendor(state.viewerUser)) {
            // Accept app T&Cs.
            const result = await api.users.update(state.viewerUser.id, adt('acceptTerms'));
            if (api.isInvalid(result)) {
              errorToast();
              return state;
            }
          }
          const saveResult = await Form.persist(state.form, adt('update', state.proposal.id));
          if (isInvalid(saveResult)) {
            return state.set('form', saveResult.value);
          }
          const submitResult = await api.proposals.cwu.update(state.proposal.id, adt('submit', ''));
          if (!api.isValid(submitResult)) {
            errorToast();
            return state;
          }
          dispatch(toast(adt('success', toasts.submitted.success)));
          state = state.set('isEditing', false);
          return await resetProposal(state, submitResult.value);
        }
      ];
    case 'submit':
      state = hideModal(state);
      return [
        startSubmitLoading(state),
        async (state, dispatch) => {
          state = stopSubmitLoading(state);
          const errorToast = () => {
            dispatch(toast(adt('error', toasts.submitted.error)));
          };
          if (isVendor(state.viewerUser)) {
            // Accept app T&Cs.
            const result = await api.users.update(state.viewerUser.id, adt('acceptTerms'));
            if (api.isInvalid(result)) {
              errorToast();
              return state;
            }
          }
          const result = await api.proposals.cwu.update(state.proposal.id, adt('submit', ''));
          if (!api.isValid(result)) {
            errorToast();
            return state;
          }
          dispatch(toast(adt('success', toasts.submitted.success)));
          return await resetProposal(state, result.value);
        }
      ];
    case 'withdraw':
      state = hideModal(state);
      return [
        startWithdrawLoading(state),
        async (state, dispatch) => {
          state = stopWithdrawLoading(state);
          const result = await api.proposals.cwu.update(state.proposal.id, adt('withdraw', ''));
          if (!api.isValid(result)) {
            dispatch(toast(adt('error', toasts.statusChanged.error(CWUProposalStatus.Withdrawn))));
            return state;
          }
          dispatch(toast(adt('success', toasts.statusChanged.success(CWUProposalStatus.Withdrawn))));
          return await resetProposal(state, result.value);
        }
      ];
    case 'delete':
      state = hideModal(state);
      return [
        startDeleteLoading(state),
        async (state, dispatch) => {
          const result = await api.proposals.cwu.delete(state.proposal.id);
          if (!api.isValid(result)) {
            dispatch(toast(adt('error', toasts.deleted.error)));
            return stopDeleteLoading(state);
          }
          dispatch(toast(adt('success', toasts.deleted.success)));
          dispatch(replaceRoute(adt('opportunityCWUView' as const, {
            opportunityId: state.opportunity.id
          })));
          return state;
        }
      ];
    default:
      return [state];
  }
});

const Reporting: ComponentView<ValidState, Msg> = ({ state }) => {
  const proposal = state.proposal;
  const showScoreAndRanking
     = proposal.status === CWUProposalStatus.Awarded
    || proposal.status === CWUProposalStatus.NotAwarded;
  const reportCards: Array<ReportCard | null> = [
    {
      icon: 'alarm-clock',
      name: 'Proposals Due',
      value: formatDateAtTime(proposal.opportunity.proposalDeadline, true)
    },
    showScoreAndRanking
      ? {
          icon: 'star-full',
          iconColor: 'c-report-card-icon-highlight',
          name: 'Total Score',
          value: proposal.score ? `${proposal.score}%` : EMPTY_STRING
        }
      : null,
    showScoreAndRanking
      ? {
          icon: 'trophy',
          iconColor: 'c-report-card-icon-highlight',
          name: 'Ranking',
          value: proposal.rank ? formatAmount(proposal.rank, undefined, true) : EMPTY_STRING
        }
      : null
  ];
  return (
    <Row className='mt-5'>
      <Col xs='12'>
        <ReportCardList reportCards={reportCards} />
      </Col>
    </Row>
  );
};

const view: ComponentView<State, Msg> = viewValid(props => {
  const { state, dispatch } = props;
  return (
    <div>
      <EditTabHeader proposal={state.proposal} viewerUser={state.viewerUser} />
      <Reporting {...props} />
      <Row className='mt-5'>
        <Col xs='12'>
          <Form.view
            disabled={!state.isEditing || isLoading(state)}
            state={state.form}
            dispatch={mapComponentDispatch(dispatch, v => adt('form' as const, v))} />
        </Col>
      </Row>
    </div>
  );
});

export const component: Tab.Component<State, Msg> = {
  init,
  update,
  view,

  getModal: getModalValid<ValidState, Msg>(state => {
    const hasAcceptedTerms = SubmitProposalTerms.getProposalCheckbox(state.submitTerms) && SubmitProposalTerms.getAppCheckbox(state.submitTerms);
    switch (state.showModal) {
      case 'submit':
      case 'saveChangesAndSubmit':
        return {
          title: 'Review Terms and Conditions',
          body: dispatch => (
            <SubmitProposalTerms.view
              opportunityType='Code With Us'
              action='submitting'
              termsTitle='Code With Us Terms & Conditions'
              termsRoute={adt('contentView', 'code-with-us-terms-and-conditions')}
              state={state.submitTerms}
              dispatch={mapComponentDispatch(dispatch, msg => adt('submitTerms', msg) as Msg)} />
          ),
          onCloseMsg: adt('hideModal'),
          actions: [
            {
              text: 'Submit Proposal',
              icon: 'paper-plane',
              color: 'primary',
              msg: state.showModal === 'submit' ? adt('submit') : adt('saveChangesAndSubmit'),
              button: true,
              disabled: !hasAcceptedTerms
            },
            {
              text: 'Cancel',
              color: 'secondary',
              msg: adt('hideModal')
            }
          ]
        };
      case 'submitChanges':
        return {
          title: 'Review Terms and Conditions',
          body: dispatch => (
            <SubmitProposalTerms.view
              opportunityType='Code With Us'
              action='submitting changes to'
              termsTitle='Code With Us Terms & Conditions'
              termsRoute={adt('contentView', 'code-with-us-terms-and-conditions')}
              state={state.submitTerms}
              dispatch={mapComponentDispatch(dispatch, msg => adt('submitTerms', msg) as Msg)} />
          ),
          onCloseMsg: adt('hideModal'),
          actions: [
            {
              text: 'Submit Changes',
              icon: 'paper-plane',
              color: 'primary',
              msg: adt('saveChanges'),
              button: true,
              disabled: !hasAcceptedTerms
            },
            {
              text: 'Cancel',
              color: 'secondary',
              msg: adt('hideModal')
            }
          ]
        };
      case 'withdrawBeforeDeadline':
        return {
          title: 'Withdraw Code With Us Proposal?',
          body: () => 'Are you sure you want to withdraw your Code With Us proposal? You will still be able to resubmit your proposal prior to the opportunity\'s proposal deadline.',
          onCloseMsg: adt('hideModal'),
          actions: [
            {
              text: 'Withdraw Proposal',
              icon: 'ban',
              color: 'danger',
              msg: adt('withdraw'),
              button: true
            },
            {
              text: 'Cancel',
              color: 'secondary',
              msg: adt('hideModal')
            }
          ]
        };
      case 'withdrawAfterDeadline':
        return {
          title: 'Withdraw Code With Us Proposal?',
          body: () => 'Are you sure you want to withdraw your Code With Us proposal? Your proposal will no longer be considered for this opportunity.',
          onCloseMsg: adt('hideModal'),
          actions: [
            {
              text: 'Withdraw Proposal',
              icon: 'ban',
              color: 'danger',
              msg: adt('withdraw'),
              button: true
            },
            {
              text: 'Cancel',
              color: 'secondary',
              msg: adt('hideModal')
            }
          ]
        };
      case 'delete':
        return {
          title: 'Delete Code With Us Proposal?',
          body: () => 'Are you sure you want to delete your Code With Us proposal? You will not be able to recover the proposal once it has been deleted.',
          onCloseMsg: adt('hideModal'),
          actions: [
            {
              text: 'Delete Proposal',
              icon: 'trash',
              color: 'danger',
              msg: adt('delete'),
              button: true
            },
            {
              text: 'Cancel',
              color: 'secondary',
              msg: adt('hideModal')
            }
          ]
        };
      case null: return null;
    }
  }),

  getContextualActions: getContextualActionsValid(({ state, dispatch }) => {
    const proposal = state.proposal;
    const propStatus = proposal.status;
    const isStartEditingLoading = state.startEditingLoading > 0;
    const isSaveChangesLoading = state.saveChangesLoading > 0;
    const isSaveChangesAndSubmitLoading = state.saveChangesAndSubmitLoading > 0;
    const isSubmitLoading = state.submitLoading > 0;
    const isWithdrawLoading = state.withdrawLoading > 0;
    const isDeleteLoading = state.deleteLoading > 0;
    const isValid = () => Form.isValid(state.form);
    const disabled = isLoading(state);
    const isDraft = propStatus === CWUProposalStatus.Draft;
    const isWithdrawn = propStatus === CWUProposalStatus.Withdrawn;
    const isAcceptingProposals = isCWUOpportunityAcceptingProposals(state.opportunity);
    if (state.isEditing) {
      const separateSubmitButton = (isDraft || isWithdrawn) && isAcceptingProposals;
      return adt('links', compact([
        // Submit Changes
        separateSubmitButton
          ? {
              children: 'Submit Proposal',
              symbol_: leftPlacement(iconLinkSymbol('paper-plane')),
              button: true,
              loading: isSaveChangesAndSubmitLoading,
              disabled: disabled || !isValid(),
              color: 'primary',
              onClick: () => dispatch(adt('showModal', 'saveChangesAndSubmit' as const))
            }
          : null,
        // Save Changes
        {
          children: separateSubmitButton ? 'Save Changes' : 'Submit Changes',
          disabled: disabled || (() => {
            if (isDraft) {
              // No validation required, always possible to save a draft.
              return false;
            } else {
              return !isValid();
            }
          })(),
          onClick: () => dispatch(separateSubmitButton ? adt('saveChanges') : adt('showModal', 'submitChanges' as const)),
          button: true,
          loading: isSaveChangesLoading,
          symbol_: leftPlacement(iconLinkSymbol(separateSubmitButton ? 'save' : 'paper-plane')),
          color: separateSubmitButton ? 'success' : 'primary'
        },
        // Cancel
        {
          children: 'Cancel',
          disabled,
          onClick: () => dispatch(adt('cancelEditing')),
          color: 'c-nav-fg-alt'
        }
      ])) as PageContextualActions;
    }
    switch (propStatus) {
      case CWUProposalStatus.Draft:
        if (isAcceptingProposals) {
          return adt('dropdown', {
            text: 'Actions',
            loading: isSubmitLoading || isStartEditingLoading || isDeleteLoading,
            linkGroups: [
              {
                links: [
                  {
                    children: 'Submit',
                    symbol_: leftPlacement(iconLinkSymbol('paper-plane')),
                    disabled: !isValid(),
                    onClick: () => dispatch(adt('showModal', 'submit' as const))
                  },
                  {
                    children: 'Edit',
                    symbol_: leftPlacement(iconLinkSymbol('edit')),
                    onClick: () => dispatch(adt('startEditing'))
                  }
                ]
              },
              {
                links: [
                  {
                    children: 'Delete',
                    symbol_: leftPlacement(iconLinkSymbol('trash')),
                    onClick: () => dispatch(adt('showModal', 'delete' as const))
                  }
                ]
              }
            ]
          });
        } else {
          return adt('links', [
            {
              button: true,
              outline: true,
              color: 'c-nav-fg-alt',
              children: 'Delete',
              symbol_: leftPlacement(iconLinkSymbol('trash')),
              onClick: () => dispatch(adt('showModal', 'delete' as const))
            }
          ]);
        }
      case CWUProposalStatus.Submitted:
        return adt('links', [
          ...(isAcceptingProposals
            ? [{
                children: 'Edit',
                symbol_: leftPlacement(iconLinkSymbol('edit')),
                button: true,
                color: 'primary',
                disabled,
                loading: isStartEditingLoading,
                onClick: () => dispatch(adt('startEditing'))
              }]
            : []),
          {
            children: 'Withdraw',
            symbol_: leftPlacement(iconLinkSymbol('ban')),
            button: true,
            outline: true,
            color: 'c-nav-fg-alt',
            disabled,
            loading: isWithdrawLoading,
            onClick: () => dispatch(adt('showModal', isAcceptingProposals ? 'withdrawBeforeDeadline' as const : 'withdrawAfterDeadline' as const))
          }
        ]) as PageContextualActions;
      case CWUProposalStatus.UnderReview:
      case CWUProposalStatus.Evaluated:
      case CWUProposalStatus.Awarded:
        return adt('links', [
          {
            children: 'Withdraw',
            symbol_: leftPlacement(iconLinkSymbol('ban')),
            button: true,
            outline: true,
            color: 'c-nav-fg-alt',
            disabled,
            loading: isWithdrawLoading,
            onClick: () => dispatch(adt('showModal', 'withdrawAfterDeadline' as const))
          }
        ]);
      case CWUProposalStatus.Withdrawn:
        if (isAcceptingProposals) {
          return adt('links', [
            {
              children: 'Submit',
              symbol_: leftPlacement(iconLinkSymbol('paper-plane')),
              loading: isSubmitLoading,
              disabled,
              button: true,
              color: 'primary',
              onClick: () => dispatch(adt('showModal', 'submit' as const))
            },
            {
              children: 'Edit',
              symbol_: leftPlacement(iconLinkSymbol('edit')),
              button: true,
              color: 'info',
              disabled,
              loading: isStartEditingLoading,
              onClick: () => dispatch(adt('startEditing'))
            }
          ]);
        } else {
          return null;
        }
      default:
        return null;
    }
  })
};

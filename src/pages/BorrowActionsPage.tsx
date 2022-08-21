import React, { ReactElement } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { FilledStylizedButtonWithIcon } from '../components/common/Buttons';
import { Display, Text } from '../components/common/Typography';
import { ReactComponent as BackArrowIcon } from '../assets/svg/back_arrow.svg';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { FullscreenModal } from '../components/common/Modal';
import { ActionProvider, Actions } from '../components/borrow/ActionCard';
import { FeeTier } from '../data/BlendPoolMarkers';
import { GetTokenData } from '../data/TokenData';
import { useParams } from 'react-router-dom';
import {
  AloeDepositAction,
  AloeWithdrawAction,
} from '../components/borrow/actions/SingleNumericEntry';

// const PENDING_ACTION_CARDS = {
//   [Actions.AloeII]: AloeDepositAction,
// }

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

function getAccount(account: string) {
  switch (account) {
    case '0':
      return {
        token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
        token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
        feeTier: FeeTier.ZERO_THREE,
      };
    default:
      return null;
  }
}

type AccountParams = {
  account: string;
};

const ActionModalHeader = styled.div`
  ${tw`flex justify-center items-center`}
  position: relative;
  margin-bottom: 24px;
`;

const BackButtonWrapper = styled.button.attrs(
  (props: { position?: string }) => props
)`
  ${tw`flex items-center justify-center`}
  position: ${(props) => props.position || 'absolute'};
  left: 0;

  svg {
    width: 40px;
    height: 40px;
    path {
      stroke: ${LEND_TITLE_TEXT_COLOR};
    }
  }

  &:hover {
    svg {
      path {
        stroke: rgb(255, 255, 255);
      }
    }
  }
`;

const SvgWrapper = styled.div`
  ${tw`flex items-center justify-center`}
  width: 32px;
  height: 32px;

  svg {
    width: 32px;
    height: 32px;
  }
`;

const ActionProviderContainer = styled.div`
  ${tw`flex flex-col items-start justify-center`}
  margin: 0 auto;
  width: 100%;
  max-width: 800px;
  margin-bottom: 16px;

  @media (max-width: 864px) {
    max-width: 525px;
  }
`;

const ActionButtonsContainer = styled.div`
  ${tw`w-full flex flex-wrap items-center`}
  gap: 25px;
`;

const ActionButton = styled.button.attrs(
  (props: { borderColor: string }) => props
)`
  ${tw`flex items-center justify-center`}
  width: 250px;
  padding: 12px 8px;
  border-radius: 8px;
  border: 1px solid ${(props) => props.borderColor};
  background-color: rgba(13, 24, 33, 1);

  &:hover {
    background-color: ${(props) => props.borderColor};
  }

  @media (max-width: 589px) {
    width: 100%;
  }
`;

export default function BorrowActionsPage() {
  const params = useParams<AccountParams>();
  const account = params.account;
  const accountData = getAccount(account || '');
  const [activeActions, setActiveActions] = React.useState<
    Array<ReactElement>>([]);
  const [actionModalOpen, setActionModalOpen] = React.useState(false);
  if (!accountData) {
    return null;
  }
  return (
    <AppPage>
      <div className='flex flex-col gap-6'>
        <div className='flex items-center gap-4 relative'>
          <BackButtonWrapper
            position='relative'
            onClick={() => {
              window.history.back();
            }}
          >
            <BackArrowIcon />
          </BackButtonWrapper>
          <Display size='L' weight='semibold'>
            Borrow Actions
          </Display>
        </div>
        <div className='flex flex-row justify-between'>
          <div className='w-full'>
            <Display size='M' weight='medium'>
              Summary
            </Display>
            {activeActions.length === 0 && (
              <Text size='S' weight='medium' color={LEND_TITLE_TEXT_COLOR}>
                No actions selected
              </Text>
            )}
          </div>
          <div className='w-full flex flex-col'>
            <div className='flex flex-col justify-center items-center gap-4'>
              {activeActions.map((action, index) => (
                <React.Fragment key={index}>
                  {action}
                </React.Fragment>
              ))}
            </div>
            <div className='flex justify-center items-center'>
              <FilledStylizedButtonWithIcon
                Icon={<PlusIcon />}
                position='leading'
                size='L'
                svgColorType='stroke'
                onClick={() => {
                  setActionModalOpen(true);
                }}
              >
                Add Action
              </FilledStylizedButtonWithIcon>
            </div>
          </div>
        </div>
        <FullscreenModal
          open={actionModalOpen}
          setOpen={(open: boolean) => {
            setActionModalOpen(open);
          }}
        >
          <ActionModalHeader>
            <BackButtonWrapper>
              <BackArrowIcon
                onClick={() => {
                  setActionModalOpen(false);
                }}
              />
            </BackButtonWrapper>
            <Display size='M' weight='medium'>
              New Action
            </Display>
          </ActionModalHeader>
          <div className='flex flex-col gap-4'>
            {Object.values(Actions).map(
              (actionProvider: ActionProvider, index: number) => {
                return (
                  <ActionProviderContainer key={index}>
                    <div className='flex items-center mb-4'>
                      <SvgWrapper>
                        <actionProvider.Icon />
                      </SvgWrapper>
                      <Display size='M' weight='semibold'>
                        {actionProvider.name}
                      </Display>
                    </div>
                    <ActionButtonsContainer>
                      {Object.entries(actionProvider.actions).map((actionData, index) => {
                        const action = actionData[1];
                        return (
                          <ActionButton
                            key={index}
                            borderColor={actionProvider.color}
                            onClick={() => {
                              setActiveActions([
                                ...activeActions,
                                <action.actionCard
                                  token0={accountData.token0}
                                  token1={accountData.token1}
                                  feeTier={accountData.feeTier}
                                  key={index}
                                  onAdd={() => {
                                    
                                  }}
                                  onRemove={() => {
                                    setActiveActions(
                                      activeActions.filter(
                                        (activeAction, otherIndex) => index !== otherIndex
                                      )
                                    );
                                  }}
                                />
                              ]);
                                // <AloeDepositAction
                                  
                                // />
                              // setActiveActions([
                              //   ...activeActions,
                              //   [actionProvider, action],
                              // ]);
                              setActionModalOpen(false);
                            }}
                          >
                            <Text size='S' weight='bold'>
                              {action.name}
                            </Text>
                          </ActionButton>
                        );
                      })}
                    </ActionButtonsContainer>
                  </ActionProviderContainer>
                );
              }
            )}
          </div>
        </FullscreenModal>
      </div>
    </AppPage>
  );
}

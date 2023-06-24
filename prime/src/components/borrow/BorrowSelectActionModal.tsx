import { useEffect, useState } from 'react';

import { SvgWrapper } from 'shared/lib/components/common/SvgWrapper';
import { Text, Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as BackArrowIcon } from '../../assets/svg/back_arrow.svg';
import { ReactComponent as LayersIcon } from '../../assets/svg/layers.svg';
import { getNameOfAction } from '../../data/actions/ActionID';
import { ActionProvider, ActionProviders, ActionTemplate, ActionTemplates } from '../../data/actions/Actions';
import { Action } from '../../data/actions/Actions';
import { TEMPLATE_STORED_EVENT_STRING, retrieveAllTemplates } from '../../data/actions/StoredActionTemplate';
import { FullscreenModal } from '../common/Modal';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const TEMPLATE_COLOR = '#4b6980';

const ActionModalHeader = styled.div`
  ${tw`flex justify-center items-center`}
  position: relative;
  padding: 16px;
`;

const ActionModalBody = styled.div`
  ${tw`flex flex-col gap-4`}
  height: calc(100vh - 64px);
  padding-bottom: 16px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const BackButtonWrapper = styled.button.attrs((props: { position?: string }) => props)`
  ${tw`flex items-center justify-center`}
  position: ${(props) => props.position || 'absolute'};
  left: 16px;

  svg {
    width: 40px;
    height: 40px;
    path {
      stroke: ${SECONDARY_COLOR};
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
  ${tw`w-full flex flex-wrap`}
  align-items: stretch;
  gap: 25px;
`;

const ActionButton = styled.button.attrs((props: { borderColor: string }) => props)`
  ${tw`flex flex-col items-center justify-start`}
  width: 250px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid ${(props) => props.borderColor};
  background-color: rgba(13, 24, 33, 1);

  .description {
    color: rgba(255, 255, 255, 0.6);
  }

  &:hover {
    background-color: ${(props) => props.borderColor};

    .description {
      color: rgba(255, 255, 255, 1);
    }
  }

  @media (max-width: 589px) {
    width: 100%;
  }
`;

export type BorrowSelectActionModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  handleAddAction: (action: Action) => void;
  handleAddActions: (actions: Action[], userInputFields?: (string[] | undefined)[]) => void;
};

export default function BorrowSelectActionModal(props: BorrowSelectActionModalProps) {
  const { isOpen, setIsOpen, handleAddAction, handleAddActions } = props;
  const [localTemplates, setLocalTemplates] = useState<ActionTemplate[]>([]);

  useEffect(() => {
    const updateLocalTemplates = () => {
      const localTemplates = retrieveAllTemplates();
      setLocalTemplates(localTemplates);
    };
    updateLocalTemplates();
    window.addEventListener(TEMPLATE_STORED_EVENT_STRING, updateLocalTemplates);
    return () => {
      window.removeEventListener(TEMPLATE_STORED_EVENT_STRING, updateLocalTemplates);
    };
  }, []);

  const defaultTemplates = Object.values(ActionTemplates);
  const templates = [...defaultTemplates, ...localTemplates];

  return (
    <FullscreenModal open={isOpen} setOpen={setIsOpen}>
      <ActionModalHeader>
        <BackButtonWrapper>
          <BackArrowIcon
            onClick={() => {
              setIsOpen(false);
            }}
          />
        </BackButtonWrapper>
        <Display size='M' weight='medium'>
          New Action
        </Display>
      </ActionModalHeader>
      <ActionModalBody>
        <ActionProviderContainer>
          <div className='flex items-center mb-4'>
            <SvgWrapper width={32} height={32} strokeColor={TEMPLATE_COLOR}>
              <LayersIcon width={20} height={20} />
            </SvgWrapper>
            <Display size='M' weight='semibold'>
              Templates
            </Display>
          </div>
          <ActionButtonsContainer>
            {templates.map((template, index) => {
              return (
                <ActionButton
                  key={index}
                  borderColor='#4B6980'
                  onClick={() => {
                    handleAddActions(template.actions, template.userInputFields);
                    setIsOpen(false);
                  }}
                >
                  <Text size='L' weight='bold' className='mb-1'>
                    {template.name}
                  </Text>
                  <Text size='XS' weight='medium' className='description'>
                    {template.description}
                  </Text>
                </ActionButton>
              );
            })}
          </ActionButtonsContainer>
        </ActionProviderContainer>
        {Object.values(ActionProviders).map((actionProvider: ActionProvider, index: number) => {
          return (
            <ActionProviderContainer key={index}>
              <div className='flex items-center mb-4'>
                <SvgWrapper width={32} height={32} svgWidth={32} svgHeight={32} strokeColor='rgb(255, 255, 255)'>
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
                        handleAddAction(action);
                        setIsOpen(false);
                      }}
                    >
                      <Text size='L' weight='bold' className='mb-1'>
                        {getNameOfAction(action.id)}
                      </Text>
                      <Text size='XS' weight='medium' className='description'>
                        {action.description}
                      </Text>
                    </ActionButton>
                  );
                })}
              </ActionButtonsContainer>
            </ActionProviderContainer>
          );
        })}
      </ActionModalBody>
    </FullscreenModal>
  );
}

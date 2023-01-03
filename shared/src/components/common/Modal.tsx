import React, { Fragment, useRef } from 'react';

import { Dialog, Transition } from '@headlessui/react';
import { Display, Text } from './Typography';
import styled from 'styled-components';

import CloseIcon from '../../assets/svg/CloseModal';
import LoadingIcon from '../../assets/svg/Loading';
import { classNames } from '../../util/ClassNames';

const DEFAULT_BORDER_GRADIENT = 'linear-gradient(90deg, #9BAAF3 0%, #7BD8C0 100%)';
const LOADING_BORDER_GRADIENT = 'rgba(43, 64, 80, 1)';
export const LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
export const VALUE_TEXT_COLOR = 'rgba(255, 255, 255, 1)';
export const MESSAGE_TEXT_COLOR = 'rgba(255, 255, 255, 1)';
export const MODAL_BLACK_TEXT_COLOR = 'rgba(7, 14, 18, 1)';

const StyledDialog = styled.div`
  z-index: 100;
`;

const ModalWrapper = styled.div.attrs(
  (props: { borderGradient: string; backgroundColor?: string; fullWidth?: boolean; fullHeight?: boolean }) => props
)`
  display: inline-block;
  background-color: #11222e;
  border-radius: 0.5rem;
  text-align: left;
  overflow: hidden;
  transition: all 0.25s ease-in-out;
  vertical-align: middle;

  transform: translateY(0);
  min-width: 368px; //TODO: make sure this doesn't break any modals
  max-width: 100%;
  width: ${(props) => (props.fullWidth ? '100%' : 'auto')};
  height: ${(props) => (props.fullHeight ? '100vh' : 'auto')};
  ${(props) => (props.fullHeight ? 'margin: 0 !important;' : '')}
  background-color: rgba(13, 23, 30, 1);
  ${(props) => props.backgroundColor && `background-color: ${props.backgroundColor};`}
  color: rgba(255, 255, 255, 1);
  position: relative;

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 8px;
    padding: 1.25px;
    background: ${(props) => props.borderGradient};
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    ${(props) => (props.fullWidth || props.fullHeight ? 'display: none;' : '')}
  }
`;

const LoaderWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
`;

const Loader = styled(LoadingIcon)`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }
`;

export const Label = styled.div`
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: rgba(130, 160, 182, 1);
`;

export const Value = styled.div`
  font-size: 20px;
  font-weight: 400;
  line-height: 30px;
  color: rgba(255, 255, 255, 1);
`;

export const DashedDivider = styled.div`
  margin-left: 8px;
  margin-right: 8px;
  position: relative;
  flex-grow: 1;
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 100%;
    height: 1px;
    border-bottom: 1px dashed rgba(26, 41, 52, 1);
  }
`;

export const HorizontalDivider = styled.div`
  width: 100%;
  height: 1px;
  margin-top: 32px;
  margin-bottom: 32px;
  background-color: rgba(26, 41, 52, 1);
`;

export const Message = styled.div`
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
  color: rgba(255, 255, 255, 1);
`;

export type ModalProps = {
  isOpen: boolean;
  title?: string;
  children: React.ReactNode;
  noClose?: boolean;
  maxWidth?: string;
  setIsOpen: (open: boolean) => void;
};

type ModalBaseProps = ModalProps & {
  onClose?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement>;
  borderGradient?: string;
  fullWidth?: boolean;
  fullHeight?: boolean;
  backgroundColor?: string;
  noPadding?: boolean;
  opacity?: number;
};

function ModalBase(props: ModalBaseProps) {
  const borderGradient = props.borderGradient || DEFAULT_BORDER_GRADIENT;
  return (
    <div>
      <Transition.Root show={props.isOpen} as={Fragment}>
        <Dialog
          as={StyledDialog}
          className='fixed inset-0 overflow-y-auto'
          initialFocus={props.initialFocusRef}
          onClose={() => {
            props.onClose && props.onClose();
            props.setIsOpen(false);
          }}
        >
          <div className={classNames('flex items-center justify-center min-h-screen text-center sm:block sm:p-0')}>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0'
              enterTo='opacity-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100'
              leaveTo='opacity-0'
            >
              <Dialog.Overlay className='fixed inset-0 bg-[#0A1821] bg-opacity-[88%] transition-opacity' />
            </Transition.Child>

            {/* This element is to trick the browser into centering the modal contents. */}
            <span className='hidden sm:inline-block sm:align-middle sm:h-screen' aria-hidden='true'>
              &#8203;
            </span>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-300'
              enterFrom='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
              enterTo='opacity-100 translate-y-0 sm:scale-100'
              leave='ease-in duration-200'
              leaveFrom='opacity-100 translate-y-0 sm:scale-100'
              leaveTo='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
            >
              <ModalWrapper
                borderGradient={borderGradient}
                fullWidth={props.fullWidth}
                fullHeight={props.fullHeight}
                backgroundColor={props.backgroundColor}
              >
                <div className={props.noPadding ? '' : 'p-8'}>{props.children}</div>
              </ModalWrapper>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}

const ModalPanel = styled(Dialog.Panel)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateY(-50%) translateX(-50%);
  width: fit-content;
  background-color: rgba(13, 23, 30, 1);
  border: 2px solid rgba(43, 64, 80, 1);
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const ModalPanelWrapper = styled.div.attrs((props: { maxWidth?: string }) => props)`
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 300px;
  max-height: 570px;
  min-width: 300px;
  max-width: ${(props) => props.maxWidth || '450px'};
  height: max-content;
  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ModalTitle = styled(Dialog.Title)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px 0px 24px;
`;

const InnerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  padding: 24px;
`;

export default function Modal(props: ModalProps) {
  const { isOpen, title, children, noClose, maxWidth, setIsOpen } = props;
  function handleClose() {
    if (!noClose) {
      setIsOpen(false);
    }
  }
  return (
    <div>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog open={isOpen} onClose={handleClose} className='fixed inset-0 overflow-y-auto z-[100]'>
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-300'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
          >
            <Dialog.Overlay className='fixed inset-0 bg-[#0A1821] bg-opacity-[88%] transition-opacity' />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-300'
            enterFrom='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
            enterTo='opacity-100 translate-y-0 sm:scale-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100 translate-y-0 sm:scale-100'
            leaveTo='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
          >
            <ModalPanel>
              <ModalPanelWrapper maxWidth={maxWidth}>
                {title && (
                  <ModalTitle>
                    <Text size='L'>{title}</Text>
                    {!noClose && (
                      <button type='button' title='Close Modal' onClick={() => setIsOpen(false)}>
                        <CloseIcon />
                      </button>
                    )}
                  </ModalTitle>
                )}
                <InnerContainer>{children}</InnerContainer>
              </ModalPanelWrapper>
            </ModalPanel>
          </Transition.Child>
        </Dialog>
      </Transition.Root>
    </div>
  );
}

export type CloseableModalProps = ModalProps & {
  title: string;
  onClose?: () => void;
  borderGradient?: string;
};

export function CloseableModal(props: CloseableModalProps) {
  const cancelButtonRef = useRef(null);
  return (
    <ModalBase
      isOpen={props.isOpen}
      setIsOpen={props.setIsOpen}
      onClose={props.onClose}
      initialFocusRef={cancelButtonRef}
      borderGradient={props.borderGradient}
    >
      <div className='w-full flex flex-row items-center justify-between mb-8'>
        <Display size='M' weight='semibold'>
          {props.title}
        </Display>
        <button
          type='button'
          className='w-fit inline-flex justify-center rounded-full
           text-white focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm'
          onClick={() => {
            props.onClose && props.onClose();
            props.setIsOpen(false);
          }}
          ref={cancelButtonRef}
          title='Close'
        >
          <CloseIcon />
        </button>
      </div>
      {props.children}
    </ModalBase>
  );
}

type LoadingModalProps = ModalProps & {
  title: string;
  borderGradient?: string;
};

export function LoadingModal(props: LoadingModalProps) {
  const borderGradient = props.borderGradient || LOADING_BORDER_GRADIENT;
  return (
    <ModalBase isOpen={props.isOpen} setIsOpen={(_open: boolean) => {}} borderGradient={borderGradient}>
      <div className='w-full flex flex-row items-center justify-between mb-8'>
        <Display size='M' weight='semibold'>
          {props.title}
        </Display>
        <LoaderWrapper>
          <Loader />
        </LoaderWrapper>
      </div>
      {props.children}
    </ModalBase>
  );
}

export function FullscreenModal(props: ModalProps) {
  return (
    <ModalBase
      isOpen={props.isOpen}
      setIsOpen={props.setIsOpen}
      backgroundColor='rgba(13, 23, 30, 0.7)'
      borderGradient={DEFAULT_BORDER_GRADIENT}
      fullWidth
      fullHeight
      noPadding={true}
    >
      {props.children}
    </ModalBase>
  );
}

import { Fragment } from 'react';

import { Dialog, Transition } from '@headlessui/react';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { ReactComponent as CloseIcon } from '../../../assets/svg/close_modal.svg';

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
  max-height: 600px;
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

export type PortfolioModalProps = {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  noClose?: boolean;
  maxWidth?: string;
  setIsOpen: (open: boolean) => void;
};

export default function PortfolioModal(props: PortfolioModalProps) {
  const { isOpen, title, children, noClose, maxWidth, setIsOpen } = props;
  function handleClose() {
    if (!noClose) {
      setIsOpen(false);
    }
  }
  return (
    <div>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog open={isOpen} onClose={handleClose} className='fixed inset-0 overflow-y-auto'>
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
                <ModalTitle>
                  <Text size='L'>{title}</Text>
                  {!noClose && (
                    <button type='button' title='Close Modal' onClick={() => setIsOpen(false)}>
                      <CloseIcon />
                    </button>
                  )}
                </ModalTitle>
                <InnerContainer>{children}</InnerContainer>
              </ModalPanelWrapper>
            </ModalPanel>
          </Transition.Child>
        </Dialog>
      </Transition.Root>
    </div>
  );
}

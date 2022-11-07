import { Fragment } from 'react';

import { Dialog, Transition } from '@headlessui/react';
import { is } from 'date-fns/locale';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

const ModalPanel = styled(Dialog.Panel)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateY(-50%) translateX(-50%);
  min-width: 300px;
  max-width: 450px;
  width: 100%;
  background-color: rgba(13, 23, 30, 1);
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const ModalPanelWrapper = styled.div`
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 300px;
  max-height: 600px;
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
  padding: 12px 0px 0px 24px;
`;

const InnerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  padding: 24px;
`;

export type CustomModalProps = {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  setIsOpen: (open: boolean) => void;
};

export default function CustomModal(props: CustomModalProps) {
  const { isOpen, title, children, setIsOpen } = props;
  return (
    <div>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog open={isOpen} onClose={() => setIsOpen(false)} className='fixed inset-0 overflow-y-auto'>
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
              <ModalPanelWrapper>
                <ModalTitle>
                  <Text size='L'>{title}</Text>
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

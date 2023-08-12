import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { BoostCardInfo } from '../../data/Uniboost';
import BoostCard from './BoostCard';

const Container = styled.div`
  display: flex;
  justify-content: space-between;
`;

const EditLeverageContainer = styled.div`
  width: 300px;
  text-align: center;
`;

export type ManageBoostModalProps = {
  uniswapNFTCardInfo?: BoostCardInfo;
  uniqueId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function ManageBoostModal(props: ManageBoostModalProps) {
  const { uniswapNFTCardInfo, uniqueId, isOpen, setIsOpen } = props;
  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={'Manage'}
      maxWidth='640px'
      backgroundColor='rgba(43, 64, 80, 0.1)'
      backdropFilter='blur(40px)'
    >
      {uniswapNFTCardInfo && (
        <Container>
          <BoostCard info={uniswapNFTCardInfo} isDisplayOnly={true} uniqueId={uniqueId} />
          <EditLeverageContainer>
            <Text size='M' weight='bold'>
              Edit Leverage
            </Text>
            <Text size='S'>Coming soon</Text>
          </EditLeverageContainer>
        </Container>
      )}
    </Modal>
  );
}

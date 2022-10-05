import { FilledStylizedButton } from '../../common/Buttons';
import { CloseableModal, MODAL_BLACK_TEXT_COLOR } from '../../common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

export type WelcomeModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
};

export default function WelcomeModal(props: WelcomeModalProps) {
  const { open, setOpen, onConfirm } = props;
  return (
    <CloseableModal open={open} setOpen={setOpen} title='Welcome to our Beta!'>
      <div>
        <Text size='M' weight='medium'>
          To get started, make sure your wallet
          <br />
          is set to Goerli. Have a look around,
          <br />
          and if you have any issues, please reach
          <br />
          out on Discord.
          <br />
          <br />
          Faucets for Goerli ETH:
        </Text>
        <Text size='M' weight='medium' color='royalblue'>
          <a
            href='https://faucet.paradigm.xyz/'
            target='_blank'
            rel='noreferrer noopener'
            className='underline'
          >
            https://faucet.paradigm.xyz/
          </a>
        </Text>
        <Text size='M' weight='medium' color='royalblue'>
          <a
            href='https://goerli-faucet.pk910.de/'
            target='_blank'
            rel='noreferrer noopener'
            className='underline'
          >
            https://goerli-faucet.pk910.de/
          </a>
        </Text>
      </div>
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        color={MODAL_BLACK_TEXT_COLOR}
        className='mt-8'
        onClick={() => {
          setOpen(false);
          onConfirm();
        }}
      >
        Okay!
      </FilledStylizedButton>
    </CloseableModal>
  );
}

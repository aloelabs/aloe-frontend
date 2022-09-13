import { FilledStylizedButton } from '../../common/Buttons';
import { CloseableModal, MODAL_BLACK_TEXT_COLOR } from '../../common/Modal';
import { Text } from '../../common/Typography';

export type WelcomeModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
};

export default function WelcomeModal(props: WelcomeModalProps) {
  const { open, setOpen, onConfirm } = props;
  return (
    <CloseableModal open={open} setOpen={setOpen} title='Welcome to the Beta!'>
      <div>
        <Text size='M' weight='medium'>
          Faucet link:
        </Text>
        <Text size='M' weight='medium' color='royalblue'>
          <a href='https://goerli-faucet.pk910.de/' target='_blank' rel='noreferrer noopener' className='underline'>
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

import { useEffect, useState } from 'react';

import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { SquareInput } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { WARNING } from 'shared/lib/data/constants/Colors';

const MAX_TEMPLATE_NAME_LENGTH = 20;
const MAX_TEMPLATE_DESCRIPTION_LENGTH = 50;

export type SaveTemplateModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (templateName: string, templateDescription: string) => void;
};

export default function SaveTemplateModal(props: SaveTemplateModalProps) {
  const { isOpen, setIsOpen, onSave } = props;

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateNameIsInvalid, setTemplateNameInvalid] = useState(false);
  const [templateDescriptionIsInvalid, setTemplateDescriptionInvalid] = useState(false);

  useEffect(() => {
    setTemplateName('');
    setTemplateDescription('');
    setTemplateNameInvalid(false);
    setTemplateDescriptionInvalid(false);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Save Template'>
      <div className='flex flex-col gap-6'>
        <div className='flex flex-col gap-2'>
          <Text size='M'>Template Name</Text>
          <SquareInput
            size='M'
            onChange={(e) => {
              if (e.target.value.length <= MAX_TEMPLATE_NAME_LENGTH) {
                setTemplateName(e.target.value);
                setTemplateNameInvalid(false);
              }
            }}
            value={templateName}
            placeholder='Name'
            inputClassName={templateNameIsInvalid ? 'outline outline-warning' : ''}
          />
          {templateNameIsInvalid && (
            <Text size='S' color={WARNING}>
              Template name cannot be empty.
            </Text>
          )}
        </div>
        <div className='flex flex-col gap-2'>
          <Text size='M'>Template Description</Text>
          <SquareInput
            size='M'
            onChange={(e) => {
              if (e.target.value.length <= MAX_TEMPLATE_DESCRIPTION_LENGTH) {
                setTemplateDescription(e.target.value);
                setTemplateDescriptionInvalid(false);
              }
            }}
            value={templateDescription}
            placeholder='Description'
            inputClassName={templateDescriptionIsInvalid ? 'outline outline-warning' : ''}
          />
          {templateDescriptionIsInvalid && (
            <Text size='S' color={WARNING}>
              Template description cannot be empty.
            </Text>
          )}
        </div>
        <FilledGradientButton
          size='M'
          className='m-auto'
          onClick={() => {
            if (templateName.length === 0 || templateDescription.length === 0) {
              if (templateName.length === 0) {
                setTemplateNameInvalid(true);
              }
              if (templateDescription.length === 0) {
                setTemplateDescriptionInvalid(true);
              }
              return;
            }
            onSave(templateName, templateDescription);
            setIsOpen(false);
          }}
        >
          Save Template
        </FilledGradientButton>
      </div>
    </Modal>
  );
}

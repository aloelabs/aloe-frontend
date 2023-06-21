import { useState } from 'react';

import { FilledGreyButton } from 'shared/lib/components/common/Buttons';

import { Action } from '../../data/actions/Actions';
import { StoredActionTemplate, storeTemplate } from '../../data/actions/StoredActionTemplate';
import SaveTemplateModal from './modal/SaveTemplateModal';

export type SaveTemplateButtonProps = {
  activeActions: Action[];
  userInputFields: (string[] | undefined)[];
};

export default function SaveTemplateButton(props: SaveTemplateButtonProps) {
  const { activeActions, userInputFields } = props;

  const [saveModalOpen, setSaveModalOpen] = useState(false);

  return (
    <>
      <FilledGreyButton size='M' onClick={() => setSaveModalOpen(true)} disabled={activeActions.length === 0}>
        Save Template
      </FilledGreyButton>
      <SaveTemplateModal
        isOpen={saveModalOpen}
        setIsOpen={setSaveModalOpen}
        onSave={(templateName: string, templateDescription: string) => {
          const template: StoredActionTemplate = {
            name: templateName,
            description: templateDescription,
            actionIDs: activeActions.map((action) => action.id),
            userInputFields: userInputFields,
          };
          storeTemplate(template);
        }}
      />
    </>
  );
}

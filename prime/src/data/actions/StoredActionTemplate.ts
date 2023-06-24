import { ActionID } from './ActionID';
import { ActionTemplate, getAction } from './Actions';

const ACTION_TEMPLATE_PREFIX = 'ACTION_TEMPLATE_';

export const TEMPLATE_STORED_EVENT_STRING = 'templateStored';

export type StoredActionTemplate = {
  name: string;
  description: string;
  actionIDs: Array<ActionID>;
  userInputFields?: (string[] | undefined)[];
};

export function storeTemplate(template: StoredActionTemplate) {
  localStorage.setItem(`${ACTION_TEMPLATE_PREFIX}${template.name}`, JSON.stringify(template));
  window.dispatchEvent(new Event(TEMPLATE_STORED_EVENT_STRING));
}

export function deleteTemplate(name: string) {
  localStorage.removeItem(`${ACTION_TEMPLATE_PREFIX}${name}`);
  window.dispatchEvent(new Event(TEMPLATE_STORED_EVENT_STRING));
}

export function retrieveTemplate(name: string): ActionTemplate | undefined {
  const template = localStorage.getItem(name);
  if (template === null) return undefined;
  const storedTemplate: StoredActionTemplate = JSON.parse(template);
  return {
    name: storedTemplate.name,
    description: storedTemplate.description,
    isLocal: true,
    actions: storedTemplate.actionIDs.map((actionID) => getAction(actionID)),
    userInputFields: storedTemplate.userInputFields,
  };
}

export function retrieveAllTemplates(): ActionTemplate[] {
  const templates: ActionTemplate[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null) continue;
    if (key.startsWith(ACTION_TEMPLATE_PREFIX)) {
      const template = retrieveTemplate(key);
      if (template !== undefined) templates.push(template);
    }
  }
  return templates;
}

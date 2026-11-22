import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { A2uiActionDto, A2uiSurfaceDto } from './dto/a2ui.dto';
export const LEARNING_CATALOG =
  'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
export const LEARNING_COMPONENTS = [
  'Column',
  'Text',
  'Card',
  'Button',
  'CheckBox',
  'ChoicePicker',
  'Divider',
];
export function label(value: unknown, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequestException('Invalid interactive content');
  return value.trim();
}
export class LearningSurface {
  private readonly components: Record<string, unknown>[] = [];
  private readonly children: string[] = [];
  private readonly data: Record<string, unknown> = {};
  private readonly actions: A2uiActionDto[] = [];
  constructor(private readonly title: string) {
    this.text(title);
  }
  node(component: string, properties: Record<string, unknown>) {
    if (
      this.components.length >= 90 ||
      !LEARNING_COMPONENTS.includes(component)
    )
      throw new BadRequestException('Interactive content limit exceeded');
    const id = `n${this.components.length}`;
    this.components.push({ id, component, ...properties });
    return id;
  }
  text(text: string) {
    const id = this.node('Text', { text: label(text, 6000) });
    this.children.push(id);
    return id;
  }
  card(title: string, summary: string, action: A2uiActionDto) {
    const heading = this.node('Text', { text: label(title, 300) });
    const body = this.node('Text', {
      text: label(summary || 'Explore this resource.', 3000),
    });
    const button = this.button(action);
    const column = this.node('Column', { children: [heading, body, button] });
    this.children.push(this.node('Card', { child: column }));
  }
  button(action: A2uiActionDto, context: Record<string, unknown> = {}) {
    const child = this.node('Text', { text: action.label });
    this.actions.push(action);
    return this.node('Button', {
      child,
      variant: 'primary',
      action: { event: { name: action.id, context } },
    });
  }
  followUp(prompt: string, text = 'Explore this step') {
    const action: A2uiActionDto = {
      id: `action${this.actions.length}`,
      type: 'prompt',
      label: label(text, 100),
      prompt: label(prompt, 1000),
    };
    this.children.push(this.button(action));
  }
  checklist(steps: { title: string; prompt: string }[]) {
    const context: Record<string, unknown> = {};
    const fields: string[] = [];
    steps.forEach((step, index) => {
      const field = `step_${index}`;
      fields.push(field);
      this.data[field] = false;
      context[field] = { '@path': `/${field}` };
      this.children.push(
        this.node('CheckBox', {
          label: label(step.title, 300),
          value: { '@path': `/${field}` },
        })
      );
      this.followUp(step.prompt, 'Help with this step');
    });
    this.children.push(
      this.button(
        {
          id: 'save_progress',
          type: 'progress',
          label: 'Save checklist',
          fields,
        },
        context
      )
    );
    this.data['feedback'] =
      'Check off steps as you go, then save your checklist.';
    this.children.push(this.node('Text', { text: { '@path': '/feedback' } }));
  }
  quiz(
    question: string,
    choices: string[],
    correctIndex: number,
    explanation: string
  ) {
    this.text(question);
    this.data['selection'] = [];
    this.data['feedback'] = 'Choose an answer, then check your understanding.';
    this.children.push(
      this.node('ChoicePicker', {
        label: 'Your answer',
        options: choices.map((choice, index) => ({
          label: choice,
          value: String(index),
        })),
        value: { '@path': '/selection' },
        variant: 'mutuallyExclusive',
      })
    );
    this.children.push(
      this.button(
        {
          id: 'check_answer',
          type: 'quiz',
          label: 'Check answer',
          answer: String(correctIndex),
          explanation,
          fields: choices.map((_, index) => String(index)),
        },
        { selection: { '@path': '/selection' } }
      )
    );
    this.children.push(this.node('Text', { text: { '@path': '/feedback' } }));
  }
  build(): A2uiSurfaceDto {
    const surfaceId = randomUUID();
    const components = [
      { id: 'root', component: 'Column', children: this.children },
      ...this.components,
    ];
    return {
      version: '1.0',
      surfaceId,
      revision: 0,
      fallback: this.title,
      actions: this.actions,
      messages: [
        {
          version: '1.0',
          createSurface: {
            surfaceId,
            catalogId: LEARNING_CATALOG,
            components,
            dataModel: this.data,
          },
        },
      ],
    };
  }
}
export function surfaceData(ui: A2uiSurfaceDto): Record<string, unknown> {
  const create = ui.messages[0]?.['createSurface'] as
    | Record<string, unknown>
    | undefined;
  if (
    !create ||
    !create['dataModel'] ||
    typeof create['dataModel'] !== 'object'
  )
    throw new BadRequestException('Invalid saved interactive content');
  return create['dataModel'] as Record<string, unknown>;
}
